import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { SOURCE_LIBRARY_VERSION, trainingLearningPaths, trainingSourceLibrary } from '../src/data/trainingData';
import { scoreScenarioResponse } from '../src/features/coach/coachEngine';
import {
  generateContentStudioPackage,
  generateDeckOutline,
  getContentStudioTemplates,
  getAiProviderStatuses,
  type ContentStudioPackage,
  type DeckOutline,
} from './aiDeck';
import { createInviteToken, createSessionToken, hashPassword, hashToken, verifyPassword } from './auth';
import {
  CONTENT_VERSION,
  createDatabase,
  readKnowledgeCheck,
  readLearningPath,
  readScenario,
  type AppDatabase,
  type SeedConfig,
} from './db';
import { answerKnowledgeAssistantQuestion } from './knowledgeAssistant';
import { renderDeckPptx } from './pptxDeck';
import {
  computeSourceQaFlags,
  searchSourceIntelligence,
  summarizeSourceUsage,
} from './sourceIntelligence';

export type AppOptions = {
  databaseUrl: string;
  seed: SeedConfig;
  corsOrigin: string;
  sessionTtlHours: number;
  resetDatabase?: boolean;
};

export type AppHandle = {
  app: express.Express;
  db: AppDatabase;
  close: () => Promise<void>;
};

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'learner';
  learnerId: string | null;
};

type AuthedRequest = Request & { user?: User; db?: AppDatabase };
const authRateLimits = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 10;
const DECK_JOB_TTL_MS = 15 * 60 * 1000;

type DeckJob = {
  id: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
  filename?: string;
  provider?: string;
  model?: string;
  outline?: DeckOutline;
  pptx?: Buffer;
  error?: string;
};

const deckJobs = new Map<string, DeckJob>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const acceptInviteSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

const moduleCompleteSchema = z.object({
  moduleId: z.string().min(1),
});

const knowledgeAnswerSchema = z.object({
  selectedAnswer: z.string().min(1),
});

const knowledgeAssistantQuestionSchema = z.object({
  question: z.string().trim().min(4).max(500),
});

const scenarioScoreSchema = z.object({
  response: z.string().min(20).max(4000),
});

const learnerSurveySchema = z.object({
  pathId: z.string().trim().min(1),
  facilitatorId: z.string().trim().min(1).max(120).optional(),
  score: z.coerce.number().min(1).max(5),
  notes: z.string().trim().max(2000).default(''),
});

const adminCreateLearnerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  cohortId: z.string().trim().min(1),
  assignedPathIds: z.array(z.string().trim().min(1)).min(1),
});

const adminCreateCohortSchema = z.object({
  name: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(120),
  startsAt: z.string().datetime(),
  facilitatorIds: z.array(z.string().trim().min(1)).default([]),
  pathIds: z.array(z.string().trim().min(1)).min(1),
});

const aiDeckOutlineSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'claude']).default('openai'),
  topic: z.string().trim().min(8).max(180),
  audience: z.string().trim().min(3).max(120).default('Think Together program staff'),
  durationMinutes: z.coerce.number().int().min(10).max(180).default(45),
  slideCount: z.coerce.number().int().min(4).max(14).default(8),
});

const contentStudioPackageSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'claude']).optional(),
  contentRequestId: z.string().trim().min(1).optional(),
  templateId: z.string().trim().min(1).optional(),
  topic: z.string().trim().min(8).max(180),
  audience: z.string().trim().min(3).max(120).default('Think Together program staff'),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
  deliveryMode: z.enum(['in-person', 'virtual', 'hybrid']).default('in-person'),
  sourceArtifactIds: z.array(z.string().trim().min(1)).max(12).default([]),
});

const contentRequestStatusSchema = z.enum(['intake', 'source-mapped', 'draft-ready', 'review-needed', 'approved', 'published']);

const adminContentRequestSchema = z.object({
  request: z.string().trim().min(8).max(220),
  audience: z.string().trim().min(3).max(160),
  deliveryMode: z.enum(['in-person', 'virtual', 'hybrid']).default('hybrid'),
  artifactsNeeded: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  outputs: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  reviewOwner: z.string().trim().min(2).max(120).default('Program Training & Development'),
  reviewNotes: z.string().trim().max(1200).default(''),
});

const adminContentRequestStatusSchema = z.object({
  status: contentRequestStatusSchema,
  reviewNotes: z.string().trim().max(1200).default(''),
});

const generatedPackageReviewSchema = z.object({
  status: z.enum(['review-needed', 'approved', 'published', 'rejected']),
  reviewNotes: z.string().trim().max(1200).default(''),
});

const notificationStatusSchema = z.object({
  status: z.enum(['draft', 'queued', 'sent', 'dismissed']),
});

const sourceSearchSchema = z.object({
  query: z.string().trim().min(2).max(160),
});

const assignmentRosterPreviewSchema = z.object({
  csvText: z.string().trim().min(10).max(20_000),
});

export async function createApp(options: AppOptions): Promise<AppHandle> {
  const db = await createDatabase({
    connectionString: options.databaseUrl,
    seed: options.seed,
    reset: options.resetDatabase,
  });
  authRateLimits.clear();
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: options.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use((req: AuthedRequest, _res, next) => {
    req.db = db;
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, contentVersion: CONTENT_VERSION });
  });

  app.post('/api/auth/login', rateLimitAuth('login'), async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const result = await db.query('SELECT id, email, name, role, learner_id, password_hash FROM users WHERE email = $1', [
      payload.email.toLowerCase(),
    ]);
    const row = result.rows[0] as (UserRow & { password_hash: string }) | undefined;

    if (!row || !(await verifyPassword(payload.password, row.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + options.sessionTtlHours * 60 * 60 * 1000).toISOString();
    await db.query('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)', [
      hashToken(token),
      row.id,
      expiresAt,
      new Date().toISOString(),
    ]);

    const user = mapUser(row);
    return res.json({ token, expiresAt, user });
  });

  app.post('/api/auth/accept-invite', rateLimitAuth('accept-invite'), async (req, res) => {
    const payload = acceptInviteSchema.parse(req.body);
    const tokenHash = hashToken(payload.token);
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(Date.now() + options.sessionTtlHours * 60 * 60 * 1000).toISOString();
    const sessionToken = createSessionToken();

    const accepted = await db.transaction(async (client) => {
      const inviteResult = await client.query(
        `SELECT
           i.id,
           i.learner_id,
           i.email,
           i.expires_at,
           i.accepted_at,
           i.revoked_at,
           l.first_name,
           l.last_name,
           l.cohort_id,
           l.assigned_path_ids,
           c.name AS cohort_name,
           c.region
         FROM learner_invites i
         JOIN learners l ON l.id = i.learner_id
         JOIN cohorts c ON c.id = l.cohort_id
         WHERE i.token_hash = $1
         FOR UPDATE OF i`,
        [tokenHash],
      );
      const invite = inviteResult.rows[0] as InviteAcceptanceRow | undefined;
      if (!invite || invite.accepted_at || invite.revoked_at || invite.expires_at.getTime() <= now.getTime()) {
        return undefined;
      }

      const passwordHash = await hashPassword(payload.password);
      const userId = randomUUID();
      const userName = `${invite.first_name} ${invite.last_name}`;
      const userResult = await client.query(
        `INSERT INTO users (id, email, name, password_hash, role, learner_id, created_at)
         VALUES ($1, $2, $3, $4, 'learner', $5, $6)
         ON CONFLICT (email)
         DO UPDATE SET
           name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = 'learner',
           learner_id = EXCLUDED.learner_id
         RETURNING id, email, name, role, learner_id`,
        [userId, invite.email.toLowerCase(), userName, passwordHash, invite.learner_id, nowIso],
      );
      const user = mapUser(userResult.rows[0] as UserRow);

      await client.query('UPDATE learner_invites SET accepted_at = $1 WHERE id = $2', [nowIso, invite.id]);
      await client.query('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)', [
        hashToken(sessionToken),
        user.id,
        expiresAt,
        nowIso,
      ]);

      return {
        token: sessionToken,
        expiresAt,
        user,
        learner: mapLearnerFromInvite(invite),
      };
    });

    if (!accepted) return res.status(400).json({ error: 'Invite is invalid or expired' });
    return res.status(201).json(accepted);
  });

  app.post('/api/auth/logout', authenticate, async (req: AuthedRequest, res) => {
    const token = bearerToken(req);
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token ?? '')]);
    res.status(204).end();
  });

  app.get('/api/me', authenticate, async (req: AuthedRequest, res) => {
    const learner = req.user?.learnerId ? await readLearnerForUser(db, req.user.learnerId) : undefined;
    res.json({ user: req.user, ...(learner ? { learner } : {}) });
  });

  app.get('/api/learning-paths/:pathId', authenticate, async (req, res) => {
    const content = await readLearningPath(db, String(req.params.pathId));
    if (!content) return res.status(404).json({ error: 'Learning path not found' });
    if (!(await canUserAccessPath(db, (req as AuthedRequest).user, content.path.id))) {
      return res.status(403).json({ error: 'Learning path is not assigned to this learner' });
    }
    return res.json(content);
  });

  app.get('/api/source-library', authenticate, async (_req, res) => {
    res.json({
      sourceLibraryVersion: SOURCE_LIBRARY_VERSION,
      artifacts: trainingSourceLibrary,
      releases: await readContentLibraryVersions(db),
      learningPaths: trainingLearningPaths.map((path) => ({
        id: path.id,
        title: path.title,
        audience: path.audience,
        contentVersion: path.contentVersion,
        moduleCount: path.modules.length,
        sourceRefs: path.sourceRefs,
      })),
    });
  });

  app.get('/api/admin/source-intelligence/summary', authenticate, requireAdmin, (_req, res) => {
    res.json(summarizeSourceUsage());
  });

  app.get('/api/admin/source-intelligence/qa-flags', authenticate, requireAdmin, (_req, res) => {
    res.json(computeSourceQaFlags());
  });

  app.get('/api/admin/source-intelligence/search', authenticate, requireAdmin, (req, res) => {
    const payload = sourceSearchSchema.parse(req.query);
    res.json({ results: searchSourceIntelligence(payload.query) });
  });

  app.get('/api/progress', authenticate, async (req: AuthedRequest, res) => {
    const userId = req.user?.id;
    const progressResult = await db.query(
      'SELECT module_id, status, completed_at FROM progress WHERE user_id = $1 ORDER BY completed_at',
      [userId],
    );
    const practiceResult = await db.query(
      `SELECT id, scenario_id, response, score, label, rationale, coaching_note, confidence,
              source_basis, created_at, content_version
       FROM practice_submissions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    const progressRows = progressResult.rows as Array<{ module_id: string; status: string; completed_at: Date | null }>;
    const practiceRows = practiceResult.rows as PracticeRow[];

    res.json({
      completedModuleIds: progressRows.filter((row) => row.status === 'completed').map((row) => row.module_id),
      progress: progressRows.map((row) => ({
        moduleId: row.module_id,
        status: row.status,
        completedAt: row.completed_at,
      })),
      practiceSubmissions: practiceRows.map(mapPracticeSubmission),
    });
  });

  app.post('/api/progress/module-complete', authenticate, async (req: AuthedRequest, res) => {
    const payload = moduleCompleteSchema.parse(req.body);
    const moduleResult = await db.query('SELECT id, path_id FROM modules WHERE id = $1', [payload.moduleId]);
    const moduleRow = moduleResult.rows[0] as { id: string; path_id: string } | undefined;
    if (!moduleRow) return res.status(404).json({ error: 'Module not found' });
    if (!(await canUserAccessPath(db, req.user, moduleRow.path_id))) {
      return res.status(403).json({ error: 'Module is not assigned to this learner' });
    }

    const completedAt = new Date().toISOString();
    await db.query(
      `INSERT INTO progress (id, user_id, module_id, status, completed_at, content_version)
       VALUES ($1, $2, $3, 'completed', $4, $5)
       ON CONFLICT(user_id, module_id)
       DO UPDATE SET status = 'completed', completed_at = excluded.completed_at, content_version = excluded.content_version`,
      [randomUUID(), req.user?.id, payload.moduleId, completedAt, CONTENT_VERSION],
    );

    const completionRecord = await upsertCompletionRecordIfReady(db, req.user, moduleRow.path_id, completedAt);
    if (completionRecord?.learnerId) {
      await enqueueCompletionNotification(db, completionRecord.learnerId, moduleRow.path_id);
    }

    res.json({ moduleId: payload.moduleId, status: 'completed', completedAt, completionRecord });
  });

  app.post('/api/knowledge-checks/:itemId/answer', authenticate, async (req: AuthedRequest, res) => {
    const payload = knowledgeAnswerSchema.parse(req.body);
    const item = await readKnowledgeCheck(db, String(req.params.itemId));
    if (!item) return res.status(404).json({ error: 'Knowledge check not found' });
    if (!(await canUserAccessModule(db, req.user, item.moduleId))) {
      return res.status(403).json({ error: 'Knowledge check is not assigned to this learner' });
    }

    const correct = payload.selectedAnswer === item.correctAnswer;
    await db.query(
      `INSERT INTO knowledge_attempts (id, user_id, item_id, selected_answer, correct, created_at, content_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), req.user?.id, item.id, payload.selectedAnswer, correct, new Date().toISOString(), item.contentVersion],
    );

    res.json({
      itemId: item.id,
      correct,
      correctAnswer: item.correctAnswer,
      rationale: item.rationale,
      sourceRefs: item.sourceRefs,
    });
  });

  app.post('/api/knowledge-assistant/answer', authenticate, (req, res) => {
    const payload = knowledgeAssistantQuestionSchema.parse(req.body);
    res.json(answerKnowledgeAssistantQuestion(payload.question));
  });

  app.post('/api/scenarios/:scenarioId/score', authenticate, async (req: AuthedRequest, res) => {
    const payload = scenarioScoreSchema.parse(req.body);
    const scenario = await readScenario(db, String(req.params.scenarioId));
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    if (!(await canUserAccessModule(db, req.user, scenario.moduleId))) {
      return res.status(403).json({ error: 'Scenario is not assigned to this learner' });
    }

    const scored = scoreScenarioResponse(
      {
        id: scenario.id,
        title: scenario.title,
        brief: scenario.prompt,
        expectedAnchors: scenario.expectedResponseElements,
      },
      payload.response,
    );
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.query(
      `INSERT INTO practice_submissions
        (id, user_id, scenario_id, response, score, label, rationale, coaching_note,
         confidence, source_basis, created_at, content_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        req.user?.id,
        scenario.id,
        payload.response,
        scored.score,
        scored.label,
        scored.rationale,
        scored.coachingNote,
        scored.confidence,
        JSON.stringify(scored.sourceBasis),
        createdAt,
        scenario.contentVersion,
      ],
    );

    res.json({ id, scenarioId: scenario.id, createdAt, ...scored });
  });

  app.post('/api/surveys/training', authenticate, async (req: AuthedRequest, res) => {
    if (req.user?.role !== 'learner' || !req.user.learnerId) {
      return res.status(403).json({ error: 'Learner role required' });
    }

    const payload = learnerSurveySchema.parse(req.body);
    const pathResult = await db.query('SELECT id FROM learning_paths WHERE id = $1', [payload.pathId]);
    if (!pathResult.rows[0]) return res.status(404).json({ error: 'Learning path not found' });

    const learnerResult = await db.query(
      `SELECT l.id, l.assigned_path_ids, c.facilitator_ids
       FROM learners l
       JOIN cohorts c ON c.id = l.cohort_id
       WHERE l.id = $1`,
      [req.user.learnerId],
    );
    const learnerRow = learnerResult.rows[0] as LearnerSurveyAccessRow | undefined;
    if (!learnerRow || !learnerRow.assigned_path_ids.includes(payload.pathId)) {
      return res.status(403).json({ error: 'Learning path is not assigned to this learner' });
    }

    const facilitatorId = payload.facilitatorId ?? learnerRow.facilitator_ids[0];
    if (!facilitatorId) {
      return res.status(400).json({ error: 'A facilitator is required for survey submission' });
    }
    if (payload.facilitatorId && learnerRow.facilitator_ids.length > 0 && !learnerRow.facilitator_ids.includes(payload.facilitatorId)) {
      return res.status(400).json({ error: 'Facilitator is not assigned to this learner cohort' });
    }

    const createdAt = new Date().toISOString();
    const surveyResult = await db.query(
      `INSERT INTO facilitator_feedback
         (id, learner_id, facilitator_id, path_id, rating, score, notes, survey_submitted, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       ON CONFLICT (learner_id, path_id) WHERE survey_submitted DO NOTHING
       RETURNING id, learner_id, facilitator_id, path_id, rating, score, notes, survey_submitted, created_at`,
      [
        randomUUID(),
        req.user.learnerId,
        facilitatorId,
        payload.pathId,
        surveyRatingFromScore(payload.score),
        payload.score,
        payload.notes,
        createdAt,
      ],
    );
    const row = surveyResult.rows[0] as FacilitatorFeedbackRow | undefined;
    if (!row) return res.status(409).json({ error: 'Training survey has already been submitted for this learning path' });

    return res.status(201).json({ survey: mapFacilitatorFeedback(row) });
  });

  app.get('/api/admin/dashboard', authenticate, requireAdmin, async (_req, res) => {
    const kpis = await readAdminKpis(db);
    const cohortResult = await db.query(
      `SELECT c.id, c.name, c.region, COUNT(p.id) AS participants
       FROM cohorts c
       LEFT JOIN participants p ON p.cohort_id = c.id
       GROUP BY c.id, c.name, c.region, c.starts_at
       ORDER BY c.starts_at DESC`,
    );
    const cohortRows = cohortResult.rows as Array<{ id: string; name: string; region: string; participants: string }>;

    res.json({
      kpis,
      readinessByTrack: await readReadinessByTrack(db),
      cohorts: cohortRows.map((row) => ({ ...row, participants: Number(row.participants) })),
    });
  });

  app.get('/api/admin/supervisor-report', authenticate, requireAdmin, async (_req, res) => {
    res.json(await readSupervisorReport(db));
  });

  app.get('/api/admin/notifications', authenticate, requireAdmin, async (_req, res) => {
    res.json({ notifications: await readNotificationQueue(db) });
  });

  app.patch('/api/admin/notifications/:notificationId/status', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = notificationStatusSchema.parse(req.body);
    const now = new Date().toISOString();
    const result = await db.query(
      `UPDATE notification_queue
       SET status = $2,
           sent_at = CASE WHEN $2 = 'sent' THEN $3::timestamptz ELSE sent_at END,
           updated_at = $3
       WHERE id = $1
       RETURNING *`,
      [String(req.params.notificationId), payload.status, now],
    );
    const row = result.rows[0] as NotificationQueueRow | undefined;
    if (!row) return res.status(404).json({ error: 'Notification not found' });

    await recordAuditEvent(db, req.user, 'notification.status_updated', 'notification', row.id, {
      status: payload.status,
      type: row.type,
      entityType: row.entity_type,
      entityId: row.entity_id,
    });

    res.json({ notification: mapNotificationQueueItem(row) });
  });

  app.get('/api/admin/assignment-rules', authenticate, requireAdmin, async (_req, res) => {
    res.json({ rules: await readAutoAssignmentRules(db) });
  });

  app.post('/api/admin/assignment-preview', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = assignmentRosterPreviewSchema.parse(req.body);
    const rules = await readAutoAssignmentRules(db);
    const rosterRows = parseRosterCsv(payload.csvText);
    if (!rosterRows.length) return res.status(400).json({ error: 'Roster CSV needs at least one data row' });

    const emails = rosterRows.flatMap((row) => (row.email ? [row.email] : []));
    const existingResult = emails.length
      ? await db.query('SELECT email FROM learners WHERE email = ANY($1::text[])', [emails.map((email) => email.toLowerCase())])
      : { rows: [] };
    const existingEmails = new Set((existingResult.rows as Array<{ email: string }>).map((row) => row.email.toLowerCase()));
    const previewRows = rosterRows.map((row, index) => previewAssignmentRow(row, index + 1, rules, existingEmails));

    await recordAuditEvent(db, req.user, 'assignment_preview.generated', 'assignment_preview', randomUUID(), {
      rowCount: previewRows.length,
      autoAssignable: previewRows.filter((row) => row.status === 'auto_assign').length,
      needsReview: previewRows.filter((row) => row.status === 'needs_review').length,
      duplicate: previewRows.filter((row) => row.status === 'duplicate').length,
      noRule: previewRows.filter((row) => row.status === 'no_rule').length,
    });

    res.status(201).json({
      generatedAt: new Date().toISOString(),
      rules,
      rows: previewRows,
      summary: {
        totalRows: previewRows.length,
        autoAssignable: previewRows.filter((row) => row.status === 'auto_assign').length,
        needsReview: previewRows.filter((row) => row.status === 'needs_review').length,
        duplicate: previewRows.filter((row) => row.status === 'duplicate').length,
        noRule: previewRows.filter((row) => row.status === 'no_rule').length,
      },
    });
  });

  app.get('/api/admin/content-requests', authenticate, requireAdmin, async (_req, res) => {
    res.json({ requests: await readContentDevelopmentRequests(db) });
  });

  app.post('/api/admin/content-requests', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = adminContentRequestSchema.parse(req.body);
    const id = slugify(`${payload.request}-${randomUUID().slice(0, 8)}`);
    const now = new Date().toISOString();
    const result = await db.query(
      `INSERT INTO content_development_requests
        (id, request, audience, delivery_mode, status, artifacts_needed, outputs,
         review_owner, review_notes, requested_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING *`,
      [
        id,
        payload.request,
        payload.audience,
        payload.deliveryMode,
        'intake',
        JSON.stringify(payload.artifactsNeeded),
        JSON.stringify(payload.outputs),
        payload.reviewOwner,
        payload.reviewNotes,
        req.user?.id ?? null,
        now,
      ],
    );

    await recordAuditEvent(db, req.user, 'content_request.created', 'content_request', id, {
      request: payload.request,
      audience: payload.audience,
      deliveryMode: payload.deliveryMode,
      outputs: payload.outputs,
    });

    res.status(201).json({ request: mapContentDevelopmentRequest(result.rows[0] as ContentDevelopmentRequestRow) });
  });

  app.patch('/api/admin/content-requests/:requestId/status', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = adminContentRequestStatusSchema.parse(req.body);
    const now = new Date().toISOString();
    const result = await db.query(
      `UPDATE content_development_requests
       SET status = $2,
           review_notes = CASE WHEN $3 = '' THEN review_notes ELSE $3 END,
           updated_at = $4,
           approved_at = CASE WHEN $2 = 'approved' THEN $4::timestamptz ELSE approved_at END,
           published_at = CASE WHEN $2 = 'published' THEN $4::timestamptz ELSE published_at END
       WHERE id = $1
       RETURNING *`,
      [String(req.params.requestId), payload.status, payload.reviewNotes, now],
    );
    const row = result.rows[0] as ContentDevelopmentRequestRow | undefined;
    if (!row) return res.status(404).json({ error: 'Content request not found' });

    await recordAuditEvent(db, req.user, 'content_request.status_updated', 'content_request', row.id, {
      status: payload.status,
      reviewNotes: payload.reviewNotes,
    });
    if (row.status === 'approved' || row.status === 'published') {
      await syncContentLibraryVersionForRequest(db, row, req.user);
    }
    await enqueueContentRequestNotification(db, row, req.user);

    res.json({ request: mapContentDevelopmentRequest(row) });
  });

  app.get('/api/admin/audit-events', authenticate, requireAdmin, async (_req, res) => {
    const result = await db.query(
      `SELECT
         e.id,
         e.actor_user_id,
         u.email AS actor_email,
         u.name AS actor_name,
         e.action,
         e.entity_type,
         e.entity_id,
         e.metadata,
         e.created_at
       FROM admin_audit_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
       ORDER BY e.created_at DESC
       LIMIT 50`,
    );
    res.json({ events: (result.rows as AdminAuditEventRow[]).map(mapAdminAuditEvent) });
  });

  app.get('/api/admin/exports/clearance.csv', authenticate, requireAdmin, async (_req, res) => {
    const result = await db.query(
      `SELECT
         NOW() AS generated_at,
         $1 AS content_version,
         l.id,
         l.first_name,
         l.last_name,
         l.email,
         c.name AS cohort_name,
         c.region,
         l.employee_id,
         l.title,
         l.hire_date,
         l.supervisor,
         l.site,
         l.verified_in_lms,
         l.exported_to_lms,
         COALESCE(training_clearance.status, 'pending') AS training_clearance_status,
         COALESCE(background.status, 'pending') AS background_check_status,
         COALESCE(site_clearance.status, 'pending') AS site_clearance_status
       FROM learners l
       JOIN cohorts c ON c.id = l.cohort_id
       LEFT JOIN clearance_records training_clearance
         ON training_clearance.learner_id = l.id AND training_clearance.clearance_type = 'training-clearance'
       LEFT JOIN clearance_records background
         ON background.learner_id = l.id AND background.clearance_type = 'background-check'
       LEFT JOIN clearance_records site_clearance
         ON site_clearance.learner_id = l.id AND site_clearance.clearance_type = 'site-clearance'
       ORDER BY l.last_name, l.first_name`,
      [CONTENT_VERSION],
    );
    sendCsv(res, 'think-clearance-export.csv', result.rows as Array<Record<string, unknown>>, clearanceExportHeaders);
  });

  app.get('/api/admin/exports/completions.csv', authenticate, requireAdmin, async (_req, res) => {
    const result = await db.query(
      `SELECT
         NOW() AS generated_at,
         cr.content_version,
         l.id AS learner_id,
         l.first_name,
         l.last_name,
         l.email,
         c.name AS cohort_name,
         c.region,
         lp.title AS learning_path,
         cr.completed_module_count,
         cr.required_module_count,
         cr.score,
         cr.pass_fail,
         cr.confirmation_code,
         cr.completed_at,
         cr.exported_to_lms,
         cr.exported_at,
         COALESCE(knowledge.average_knowledge_score, 0) AS average_knowledge_score,
         COALESCE(practice.practice_submissions, 0) AS practice_submissions,
         COALESCE(invite_status.invite_status, 'not_sent') AS invite_status
       FROM completion_records cr
       JOIN users u ON u.id = cr.user_id
       LEFT JOIN learners l ON l.id = cr.learner_id
       LEFT JOIN cohorts c ON c.id = l.cohort_id
       JOIN learning_paths lp ON lp.id = cr.path_id
       LEFT JOIN LATERAL (
         SELECT ROUND(AVG(CASE WHEN ka.correct THEN 100 ELSE 0 END))::int AS average_knowledge_score
         FROM knowledge_attempts ka
         JOIN knowledge_checks kc ON kc.id = ka.item_id
         JOIN modules m ON m.id = kc.module_id
         WHERE ka.user_id = cr.user_id AND m.path_id = cr.path_id
       ) knowledge ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS practice_submissions
         FROM practice_submissions ps
         JOIN scenarios s ON s.id = ps.scenario_id
         JOIN modules m ON m.id = s.module_id
         WHERE ps.user_id = cr.user_id AND m.path_id = cr.path_id
       ) practice ON true
       LEFT JOIN LATERAL (
         SELECT CASE
           WHEN EXISTS (SELECT 1 FROM learner_invites li WHERE li.learner_id = cr.learner_id AND li.accepted_at IS NOT NULL) THEN 'accepted'
           WHEN EXISTS (SELECT 1 FROM learner_invites li WHERE li.learner_id = cr.learner_id AND li.accepted_at IS NULL AND li.revoked_at IS NULL AND li.expires_at > NOW()) THEN 'pending'
           WHEN EXISTS (SELECT 1 FROM learner_invites li WHERE li.learner_id = cr.learner_id AND li.accepted_at IS NULL AND li.revoked_at IS NOT NULL) THEN 'revoked'
           WHEN EXISTS (SELECT 1 FROM learner_invites li WHERE li.learner_id = cr.learner_id AND li.accepted_at IS NULL AND li.revoked_at IS NULL AND li.expires_at <= NOW()) THEN 'expired'
           ELSE 'not_sent'
         END AS invite_status
       ) invite_status ON true
       ORDER BY cr.completed_at DESC, l.last_name, l.first_name`,
    );
    sendCsv(res, 'think-completion-export.csv', result.rows as Array<Record<string, unknown>>, completionExportHeaders);
  });

  app.get('/api/admin/exports/supervisor-digest.csv', authenticate, requireAdmin, async (_req, res) => {
    const report = await readSupervisorReport(db);
    const rows = buildSupervisorDigestExportRows(report);
    sendCsv(res, 'think-supervisor-digest.csv', rows, supervisorDigestExportHeaders);
  });

  app.get('/api/admin/exports/content-operations.csv', authenticate, requireAdmin, async (_req, res) => {
    const report = await readSupervisorReport(db);
    const rows = buildContentOperationsExportRows(report);
    sendCsv(res, 'think-content-operations-export.csv', rows, contentOperationsExportHeaders);
  });

  app.get('/api/admin/learners', authenticate, requireAdmin, async (_req, res) => {
    const result = await db.query(adminLearnersQuery());
    res.json({ learners: (result.rows as AdminLearnerRow[]).map(mapAdminLearner) });
  });

  app.post('/api/admin/learners', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = adminCreateLearnerSchema.parse(req.body);
    const cohort = await readAdminCohort(db, payload.cohortId);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found' });

    const existing = await db.query('SELECT id FROM learners WHERE email = $1', [payload.email.toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Learner email already exists' });

    const id = randomUUID();
    await db.transaction(async (client) => {
      await client.query(
        `INSERT INTO learners (id, first_name, last_name, email, cohort_id, assigned_path_ids)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          payload.firstName,
          payload.lastName,
          payload.email.toLowerCase(),
          payload.cohortId,
          JSON.stringify(payload.assignedPathIds),
        ],
      );

      await client.query(
        `INSERT INTO participants (id, cohort_id, learner_id, role, joined_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cohort_id, learner_id) DO NOTHING`,
        [randomUUID(), payload.cohortId, id, 'learner', new Date().toISOString()],
      );
    });

    await recordAuditEvent(db, req.user, 'learner.created', 'learner', id, {
      email: payload.email.toLowerCase(),
      cohortId: payload.cohortId,
      assignedPathIds: payload.assignedPathIds,
    });

    res.status(201).json({
      learner: {
        id,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email.toLowerCase(),
        cohortId: payload.cohortId,
        cohortName: cohort.name,
        region: cohort.region,
        assignedPathIds: payload.assignedPathIds,
      },
    });
  });

  app.post('/api/admin/learners/:learnerId/invite', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const learner = await readLearnerForUser(db, String(req.params.learnerId));
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const token = createInviteToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.transaction(async (client) => {
      await client.query(
        `UPDATE learner_invites
         SET revoked_at = $1
         WHERE learner_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
        [now.toISOString(), learner.id],
      );
      await client.query(
        `INSERT INTO learner_invites (id, token_hash, learner_id, email, expires_at, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), hashToken(token), learner.id, learner.email.toLowerCase(), expiresAt, req.user?.id, now.toISOString()],
      );
    });

    await recordAuditEvent(db, req.user, 'learner_invite.created', 'learner', learner.id, {
      email: learner.email,
      expiresAt,
      inviteStatus: 'pending',
    });

    const origin = req.get('origin') ?? `${req.protocol}://${req.get('host')}`;
    res.status(201).json({
      invite: {
        learnerId: learner.id,
        inviteStatus: 'pending',
        inviteToken: token,
        inviteUrl: `${origin}/?invite=${encodeURIComponent(token)}`,
        expiresAt,
      },
      learner: { ...learner, inviteStatus: 'pending' },
    });
  });

  app.post('/api/admin/learners/:learnerId/invite/revoke', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const learner = await readLearnerForUser(db, String(req.params.learnerId));
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    await db.query(
      `UPDATE learner_invites
       SET revoked_at = $1
       WHERE learner_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [new Date().toISOString(), learner.id],
    );

    await recordAuditEvent(db, req.user, 'learner_invite.revoked', 'learner', learner.id, {
      email: learner.email,
      inviteStatus: 'revoked',
    });

    res.json({ learner: { ...learner, inviteStatus: 'revoked' } });
  });

  app.get('/api/admin/cohorts', authenticate, requireAdmin, async (_req, res) => {
    const result = await db.query(adminCohortsQuery());
    res.json({ cohorts: (result.rows as AdminCohortRow[]).map(mapAdminCohort) });
  });

  app.post('/api/admin/cohorts', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = adminCreateCohortSchema.parse(req.body);
    const id = randomUUID();
    await db.query(
      `INSERT INTO cohorts (id, name, region, starts_at, facilitator_ids, path_ids)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        payload.name,
        payload.region,
        payload.startsAt,
        JSON.stringify(payload.facilitatorIds),
        JSON.stringify(payload.pathIds),
      ],
    );

    await recordAuditEvent(db, req.user, 'cohort.created', 'cohort', id, {
      name: payload.name,
      region: payload.region,
      pathIds: payload.pathIds,
      facilitatorIds: payload.facilitatorIds,
    });

    res.status(201).json({
      cohort: {
        id,
        name: payload.name,
        region: payload.region,
        startsAt: payload.startsAt,
        facilitatorIds: payload.facilitatorIds,
        pathIds: payload.pathIds,
        learnerCount: 0,
      },
    });
  });

  app.get('/api/ai/providers', authenticate, requireAdmin, async (_req, res) => {
    res.json({ providers: getAiProviderStatuses() });
  });

  app.get('/api/content-studio/templates', authenticate, requireAdmin, async (_req, res) => {
    res.json({ templates: getContentStudioTemplates() });
  });

  app.post('/api/content-studio/packages', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = contentStudioPackageSchema.parse(req.body);
    const contentRequest = payload.contentRequestId
      ? await readContentDevelopmentRequestRow(db, payload.contentRequestId)
      : undefined;
    if (payload.contentRequestId && !contentRequest) return res.status(404).json({ error: 'Content request not found' });

    try {
      const trainingPackage = await generateContentStudioPackage(payload);
      const generatedPackage = contentRequest
        ? await persistGeneratedTrainingPackage(db, contentRequest, trainingPackage, payload, req.user)
        : null;
      await recordAuditEvent(db, req.user, 'content_studio_package.generated', 'content_studio_package', generatedPackage?.id ?? slugify(trainingPackage.title), {
        provider: trainingPackage.provider,
        model: trainingPackage.model,
        topic: payload.topic,
        audience: payload.audience,
        deliveryMode: payload.deliveryMode,
        durationMinutes: payload.durationMinutes,
        sourceArtifactIds: payload.sourceArtifactIds,
        contentRequestId: payload.contentRequestId ?? null,
        generatedPackageId: generatedPackage?.id ?? null,
      });
      res.status(201).json({ package: trainingPackage, generatedPackage });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Content Studio package generation failed';
      res.status(502).json({ error: message });
    }
  });

  app.patch('/api/admin/generated-packages/:packageId/status', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = generatedPackageReviewSchema.parse(req.body);
    const now = new Date().toISOString();
    const result = await db.query(
      `UPDATE generated_training_packages
       SET review_status = $2,
           review_notes = CASE WHEN $3 = '' THEN review_notes ELSE $3 END,
           updated_at = $4,
           approved_at = CASE WHEN $2 = 'approved' THEN $4::timestamptz ELSE approved_at END,
           published_at = CASE WHEN $2 = 'published' THEN $4::timestamptz ELSE published_at END
       WHERE id = $1
       RETURNING *`,
      [String(req.params.packageId), payload.status, payload.reviewNotes, now],
    );
    const packageRow = result.rows[0] as GeneratedTrainingPackageRow | undefined;
    if (!packageRow) return res.status(404).json({ error: 'Generated package not found' });

    if (packageRow.content_request_id) {
      const requestStatus = generatedPackageStatusToContentRequestStatus(packageRow.review_status);
      if (requestStatus) {
        await setContentRequestStatus(db, packageRow.content_request_id, requestStatus, packageRow.review_notes, req.user);
      }
    }

    await recordAuditEvent(db, req.user, 'generated_package.status_updated', 'generated_package', packageRow.id, {
      status: payload.status,
      contentRequestId: packageRow.content_request_id,
    });

    res.json({
      generatedPackage: mapGeneratedTrainingPackage(packageRow),
      supervisorReport: await readSupervisorReport(db),
    });
  });

  app.post('/api/ai/deck-outline', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = aiDeckOutlineSchema.parse(req.body);
    const providers = getAiProviderStatuses();
    const selected = providers.find((provider) => provider.id === payload.provider);
    if (!selected?.configured) return res.status(503).json({ error: `${selected?.label ?? payload.provider} is not configured` });

    try {
      const outline = await generateDeckOutline(payload);
      res.status(201).json({ outline, provider: selected });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI deck generation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/deck-outline-jobs', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = aiDeckOutlineSchema.parse(req.body);
    const providers = getAiProviderStatuses();
    const selected = providers.find((provider) => provider.id === payload.provider);
    if (!selected?.configured) return res.status(503).json({ error: `${selected?.label ?? payload.provider} is not configured` });

    sweepDeckJobs();
    const now = new Date().toISOString();
    const job: DeckJob = {
      id: randomUUID(),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      expiresAt: Date.now() + DECK_JOB_TTL_MS,
      provider: selected.id,
    };
    deckJobs.set(job.id, job);
    await recordAuditEvent(db, req.user, 'ai_deck_outline_job.created', 'deck_job', job.id, {
      provider: selected.id,
      topic: payload.topic,
      slideCount: payload.slideCount,
      durationMinutes: payload.durationMinutes,
    });

    void (async () => {
      updateDeckJob(job.id, { status: 'running' });
      try {
        const outline = await generateDeckOutline(payload);
        updateDeckJob(job.id, {
          status: 'ready',
          model: outline.model,
          outline,
        });
      } catch (error) {
        updateDeckJob(job.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'AI deck generation failed',
        });
      }
    })();

    res.status(202).json({ job: publicDeckJob(job) });
  });

  app.get('/api/ai/deck-outline-jobs/:jobId', authenticate, requireAdmin, async (req, res) => {
    sweepDeckJobs();
    const job = deckJobs.get(String(req.params.jobId));
    if (!job) return res.status(404).json({ error: 'Deck job not found or expired' });
    if (job.status === 'failed') return res.status(502).json({ job: publicDeckJob(job), error: job.error ?? 'AI deck generation failed' });
    if (job.status !== 'ready' || !job.outline) return res.json({ job: publicDeckJob(job) });

    const provider = getAiProviderStatuses().find((item) => item.id === job.provider);
    res.json({ job: publicDeckJob(job), outline: job.outline, provider });
  });

  app.post('/api/ai/deck-pptx', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = aiDeckOutlineSchema.parse(req.body);
    const providers = getAiProviderStatuses();
    const selected = providers.find((provider) => provider.id === payload.provider);
    if (!selected?.configured) return res.status(503).json({ error: `${selected?.label ?? payload.provider} is not configured` });

    try {
      const outline = await generateDeckOutline(payload);
      const pptx = await renderDeckPptx(outline);
      const filename = `${slugify(outline.title)}.pptx`;
      res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('content-disposition', `attachment; filename="${filename}"`);
      res.setHeader('x-ai-provider', selected.id);
      res.setHeader('x-ai-model', outline.model);
      res.status(201).send(pptx);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI PPTX generation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/deck-jobs', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
    const payload = aiDeckOutlineSchema.parse(req.body);
    const providers = getAiProviderStatuses();
    const selected = providers.find((provider) => provider.id === payload.provider);
    if (!selected?.configured) return res.status(503).json({ error: `${selected?.label ?? payload.provider} is not configured` });

    sweepDeckJobs();
    const now = new Date().toISOString();
    const job: DeckJob = {
      id: randomUUID(),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      expiresAt: Date.now() + DECK_JOB_TTL_MS,
      provider: selected.id,
    };
    deckJobs.set(job.id, job);
    await recordAuditEvent(db, req.user, 'ai_deck_pptx_job.created', 'deck_job', job.id, {
      provider: selected.id,
      topic: payload.topic,
      slideCount: payload.slideCount,
      durationMinutes: payload.durationMinutes,
    });

    void (async () => {
      updateDeckJob(job.id, { status: 'running' });
      try {
        const outline = await generateDeckOutline(payload);
        const pptx = await renderDeckPptx(outline);
        updateDeckJob(job.id, {
          status: 'ready',
          filename: `${slugify(outline.title)}.pptx`,
          model: outline.model,
          pptx,
        });
      } catch (error) {
        updateDeckJob(job.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'AI PPTX generation failed',
        });
      }
    })();

    res.status(202).json({ job: publicDeckJob(job) });
  });

  app.get('/api/ai/deck-jobs/:jobId', authenticate, requireAdmin, async (req, res) => {
    sweepDeckJobs();
    const job = deckJobs.get(String(req.params.jobId));
    if (!job) return res.status(404).json({ error: 'Deck job not found or expired' });
    res.json({ job: publicDeckJob(job) });
  });

  app.get('/api/ai/deck-jobs/:jobId/pptx', authenticate, requireAdmin, async (req, res) => {
    sweepDeckJobs();
    const job = deckJobs.get(String(req.params.jobId));
    if (!job) return res.status(404).json({ error: 'Deck job not found or expired' });
    if (job.status === 'failed') return res.status(502).json({ error: job.error ?? 'AI PPTX generation failed' });
    if (job.status !== 'ready' || !job.pptx) return res.status(202).json({ job: publicDeckJob(job) });

    res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('content-disposition', `attachment; filename="${job.filename ?? 'think-together-training-deck.pptx'}"`);
    if (job.provider) res.setHeader('x-ai-provider', job.provider);
    if (job.model) res.setHeader('x-ai-model', job.model);
    res.status(200).send(job.pptx);
  });

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return {
    app,
    db,
    close: () => db.close(),
  };
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return slug || 'think-together-training-deck';
}

function updateDeckJob(jobId: string, patch: Partial<DeckJob>) {
  const job = deckJobs.get(jobId);
  if (!job) return;
  deckJobs.set(jobId, {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + DECK_JOB_TTL_MS,
  });
}

function publicDeckJob(job: DeckJob) {
  return {
    id: job.id,
    status: job.status,
    provider: job.provider,
    model: job.model,
    filename: job.filename,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function sweepDeckJobs() {
  const now = Date.now();
  for (const [id, job] of deckJobs) {
    if (job.expiresAt <= now) deckJobs.delete(id);
  }
}

async function recordAuditEvent(
  db: AppDatabase,
  actor: User | undefined,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.query(
    `INSERT INTO admin_audit_events
     (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      actor?.id ?? null,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      new Date().toISOString(),
    ],
  );
}

function mapAdminAuditEvent(row: AdminAuditEventRow) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

async function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const db = req.db;
  const token = bearerToken(req);
  if (!db || !token) return res.status(401).json({ error: 'Authentication required' });

  const result = await db.query(
    `SELECT u.id, u.email, u.name, u.role, u.learner_id, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [hashToken(token)],
  );
  const row = result.rows[0] as (UserRow & { expires_at: Date }) | undefined;

  if (!row || row.expires_at.getTime() < Date.now()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = mapUser(row);
  return next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  return next();
}

function rateLimitAuth(action: 'login' | 'accept-invite') {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : undefined;
    const token = typeof req.body?.token === 'string' ? hashToken(req.body.token).slice(0, 18) : undefined;
    const identifier = email ?? token ?? 'anonymous';
    const key = `${action}:${req.ip}:${identifier}`;
    const existing = authRateLimits.get(key);

    if (!existing || existing.resetAt <= now) {
      authRateLimits.set(key, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
      return next();
    }

    if (existing.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    existing.count += 1;
    return next();
  };
}

async function canUserAccessPath(db: AppDatabase, user: User | undefined, pathId: string) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.learnerId) return false;

  const result = await db.query('SELECT 1 FROM learners WHERE id = $1 AND assigned_path_ids ? $2', [
    user.learnerId,
    pathId,
  ]);
  return Boolean(result.rows[0]);
}

async function canUserAccessModule(db: AppDatabase, user: User | undefined, moduleId: string) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.learnerId) return false;

  const result = await db.query(
    `SELECT 1
     FROM modules m
     JOIN learners l ON l.id = $1
     WHERE m.id = $2 AND l.assigned_path_ids ? m.path_id`,
    [user.learnerId, moduleId],
  );
  return Boolean(result.rows[0]);
}

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

async function readAdminKpis(db: AppDatabase) {
  const result = await db.query(`
    WITH learner_count AS (
      SELECT COUNT(*)::int AS total_learners FROM learners
    ),
    attendance AS (
      SELECT
        COUNT(DISTINCT learner_id) FILTER (WHERE status = 'present')::int AS attended,
        COUNT(DISTINCT learner_id) FILTER (WHERE status IN ('absent', 'excused'))::int AS makeup_required
      FROM attendance_records
    ),
    clearance AS (
      SELECT
        COUNT(DISTINCT learner_id) FILTER (WHERE status = 'cleared')::int AS clearance_ready,
        COUNT(DISTINCT learner_id) FILTER (WHERE status = 'blocked')::int AS blocked
      FROM clearance_records
    ),
    attempts AS (
      SELECT
        COALESCE(ROUND(AVG(CASE WHEN correct THEN 100 ELSE 0 END))::int, 0) AS average_knowledge_score
      FROM knowledge_attempts
    ),
    learner_assignments AS (
      SELECT COALESCE(SUM(jsonb_array_length(assigned_path_ids)), 0)::int AS assigned_surveys
      FROM learners
    ),
    feedback AS (
      SELECT
        COALESCE(ROUND(AVG(score) FILTER (WHERE survey_submitted), 1), 0)::float AS facilitator_rating,
        COUNT(DISTINCT (learner_id, path_id)) FILTER (WHERE survey_submitted)::int AS submitted_surveys
      FROM facilitator_feedback
    ),
    completed AS (
      SELECT COUNT(*)::int AS completed_modules FROM progress WHERE status = 'completed'
    ),
    completed_required AS (
      SELECT COUNT(DISTINCT (u.learner_id, p.module_id))::int AS completed_required_modules
      FROM progress p
      JOIN users u ON u.id = p.user_id AND u.learner_id IS NOT NULL
      JOIN modules m ON m.id = p.module_id AND m.required_for_completion
      WHERE p.status = 'completed'
    ),
    assigned_required AS (
      SELECT COUNT(*)::int AS assigned_required_modules
      FROM learners l
      JOIN modules m ON l.assigned_path_ids ? m.path_id AND m.required_for_completion
    ),
    practice AS (
      SELECT COUNT(*)::int AS practice_submissions FROM practice_submissions
    ),
    module_count AS (
      SELECT COUNT(*)::int AS modules FROM modules
    )
    SELECT *
    FROM learner_count, attendance, clearance, attempts, learner_assignments, feedback, completed, practice, module_count
  `);
  const row = result.rows[0] as AdminKpiRow;
  const completionRate = row.assigned_required_modules > 0
    ? Math.min(100, Math.round((row.completed_required_modules / row.assigned_required_modules) * 100))
    : 0;
  const surveyCompletion = row.assigned_surveys > 0 ? Math.round((row.submitted_surveys / row.assigned_surveys) * 100) : 0;
  return {
    totalLearners: row.total_learners,
    attended: row.attended ?? 0,
    completedModules: row.completed_modules,
    clearanceReady: row.clearance_ready ?? 0,
    blocked: row.blocked ?? 0,
    makeupRequired: row.makeup_required ?? 0,
    averageKnowledgeScore: row.average_knowledge_score,
    surveyCompletion,
    facilitatorRating: row.facilitator_rating,
    practiceSubmissions: row.practice_submissions,
    completionRate,
  };
}

async function readReadinessByTrack(db: AppDatabase) {
  const result = await db.query(`
    SELECT
      lp.title AS track,
      COUNT(DISTINCT l.id)::int AS enrolled,
      COUNT(DISTINCT l.id) FILTER (WHERE cr.status = 'cleared')::int AS clearance_ready,
      COUNT(DISTINCT l.id) FILTER (WHERE ff.rating = 'needs-coaching')::int AS needs_coaching,
      COUNT(DISTINCT l.id) FILTER (WHERE cr.status = 'blocked')::int AS blocked
    FROM learning_paths lp
    LEFT JOIN learners l ON l.assigned_path_ids ? lp.id
    LEFT JOIN clearance_records cr ON cr.learner_id = l.id AND cr.clearance_type = 'training-clearance'
    LEFT JOIN facilitator_feedback ff ON ff.learner_id = l.id AND ff.path_id = lp.id
    GROUP BY lp.id, lp.title
    ORDER BY lp.title
  `);
  return (result.rows as ReadinessRow[]).map((row) => ({
    track: row.track,
    enrolled: row.enrolled,
    clearanceReady: row.clearance_ready,
    needsCoaching: row.needs_coaching,
    blocked: row.blocked,
  }));
}

async function readSupervisorReport(db: AppDatabase) {
  const result = await db.query(`
    WITH learner_paths AS (
      SELECT
        l.id AS learner_id,
        l.first_name,
        l.last_name,
        l.email,
        NULLIF(l.supervisor, '') AS supervisor,
        l.title,
        l.site,
        c.id AS cohort_id,
        c.name AS cohort_name,
        c.region,
        c.facilitator_ids,
        assigned_path.path_id
      FROM learners l
      JOIN cohorts c ON c.id = l.cohort_id
      CROSS JOIN LATERAL jsonb_array_elements_text(l.assigned_path_ids) AS assigned_path(path_id)
    )
    SELECT
      lp.learner_id,
      lp.first_name,
      lp.last_name,
      lp.email,
      lp.supervisor,
      lp.title,
      lp.site,
      lp.cohort_id,
      lp.cohort_name,
      lp.region,
      lp.facilitator_ids,
      lp.path_id,
      learning_paths.title AS path_title,
      COALESCE(required_modules.required_module_count, 0)::int AS required_module_count,
      COALESCE(progress.completed_module_count, 0)::int AS completed_module_count,
      COALESCE(knowledge.average_knowledge_score, 0)::int AS average_knowledge_score,
      COALESCE(practice.average_practice_score, 0)::float AS average_practice_score,
      COALESCE(practice.practice_submissions, 0)::int AS practice_submissions,
      completion_records.score AS completion_score,
      completion_records.pass_fail,
      completion_records.confirmation_code,
      completion_records.completed_at,
      completion_records.exported_to_lms,
      completion_records.exported_at
    FROM learner_paths lp
    JOIN learning_paths ON learning_paths.id = lp.path_id
    LEFT JOIN users u ON u.learner_id = lp.learner_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS required_module_count
      FROM modules
      WHERE modules.path_id = lp.path_id AND modules.required_for_completion
    ) required_modules ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT progress.module_id)::int AS completed_module_count
      FROM progress
      JOIN modules ON modules.id = progress.module_id
      WHERE progress.user_id = u.id
        AND progress.status = 'completed'
        AND modules.path_id = lp.path_id
        AND modules.required_for_completion
    ) progress ON true
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(CASE WHEN knowledge_attempts.correct THEN 100 ELSE 0 END))::int AS average_knowledge_score
      FROM knowledge_attempts
      JOIN knowledge_checks ON knowledge_checks.id = knowledge_attempts.item_id
      JOIN modules ON modules.id = knowledge_checks.module_id
      WHERE knowledge_attempts.user_id = u.id AND modules.path_id = lp.path_id
    ) knowledge ON true
    LEFT JOIN LATERAL (
      SELECT
        ROUND(AVG(practice_submissions.score)::numeric, 1) AS average_practice_score,
        COUNT(*)::int AS practice_submissions
      FROM practice_submissions
      JOIN scenarios ON scenarios.id = practice_submissions.scenario_id
      JOIN modules ON modules.id = scenarios.module_id
      WHERE practice_submissions.user_id = u.id AND modules.path_id = lp.path_id
    ) practice ON true
    LEFT JOIN completion_records
      ON completion_records.learner_id = lp.learner_id AND completion_records.path_id = lp.path_id
    ORDER BY COALESCE(lp.supervisor, 'Unassigned'), lp.cohort_name, lp.last_name, lp.first_name, learning_paths.title
  `);

  const learners = (result.rows as SupervisorReportRow[]).map(mapSupervisorReportLearner);
  const contentDevelopmentRequests = await readContentDevelopmentRequests(db);
  const generatedTrainingPackages = await readGeneratedTrainingPackages(db);
  const notificationQueue = await readNotificationQueue(db);
  return {
    generatedAt: new Date().toISOString(),
    groups: {
      supervisors: groupSupervisorReportLearners(learners, 'supervisor'),
      facilitators: groupSupervisorReportLearners(learners, 'facilitator'),
      cohorts: groupSupervisorReportLearners(learners, 'cohort'),
    },
    actionQueue: buildSupervisorActionQueue(learners),
    assignmentAutomation: await buildAssignmentAutomationPreview(db, learners),
    integrationReadiness: buildIntegrationReadiness(learners),
    contentDevelopmentRequests,
    generatedTrainingPackages,
    notificationQueue,
    rolloutForecast: buildRolloutForecast(learners),
    completionNotifications: buildCompletionNotificationPreviews(learners),
  };
}

type SupervisorReportLearner = ReturnType<typeof mapSupervisorReportLearner>;
type SupervisorReportPayload = Awaited<ReturnType<typeof readSupervisorReport>>;

async function readAutoAssignmentRules(db: AppDatabase) {
  const result = await db.query(
    `SELECT
       r.id,
       r.name,
       r.priority,
       r.active,
       r.match_criteria,
       r.cohort_id,
       c.name AS cohort_name,
       c.region AS cohort_region,
       r.path_ids,
       COALESCE(path_titles.titles, ARRAY[]::text[]) AS path_titles,
       r.review_gate,
       r.notification_template,
       r.created_at,
       r.updated_at
     FROM auto_assignment_rules r
     JOIN cohorts c ON c.id = r.cohort_id
     LEFT JOIN LATERAL (
       SELECT ARRAY_AGG(lp.title ORDER BY lp.title) AS titles
       FROM jsonb_array_elements_text(r.path_ids) AS path_id(value)
       JOIN learning_paths lp ON lp.id = path_id.value
     ) path_titles ON true
     ORDER BY r.active DESC, r.priority ASC, r.updated_at DESC`,
  );
  return (result.rows as AutoAssignmentRuleRow[]).map(mapAutoAssignmentRule);
}

function mapAutoAssignmentRule(row: AutoAssignmentRuleRow) {
  const criteria = normalizeMatchCriteria(row.match_criteria);
  return {
    id: row.id,
    name: row.name,
    priority: Number(row.priority),
    active: row.active,
    matchCriteria: criteria,
    cohort: {
      id: row.cohort_id,
      name: row.cohort_name,
      region: row.cohort_region,
    },
    pathIds: row.path_ids,
    pathTitles: row.path_titles,
    reviewGate: row.review_gate,
    notificationTemplate: row.notification_template,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

type AutoAssignmentRule = ReturnType<typeof mapAutoAssignmentRule>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeMatchCriteria(value: unknown) {
  const record = isRecord(value) ? value : {};
  return {
    titleKeywords: stringArray(record.titleKeywords),
    requiredFields: stringArray(record.requiredFields),
  };
}

function parseRosterCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine).map(normalizeRosterHeader);

  return dataLines
    .map((line) => {
      const cells = parseCsvLine(line);
      const row: RosterPreviewInputRow = {};
      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = (cells[index] ?? '').trim();
      });
      if (row.email) row.email = row.email.toLowerCase();
      return row;
    })
    .filter((row) => Object.values(row).some(Boolean));
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function normalizeRosterHeader(value: string): keyof RosterPreviewInputRow | '' {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const headerMap: Record<string, keyof RosterPreviewInputRow> = {
    firstname: 'firstName',
    fname: 'firstName',
    lastname: 'lastName',
    lname: 'lastName',
    email: 'email',
    workemail: 'email',
    employeeid: 'employeeId',
    empid: 'employeeId',
    title: 'title',
    jobtitle: 'title',
    role: 'title',
    region: 'region',
    site: 'site',
    supervisor: 'supervisor',
    manager: 'supervisor',
    hiredate: 'hireDate',
    startdate: 'hireDate',
  };
  return headerMap[normalized] ?? '';
}

function previewAssignmentRow(
  row: RosterPreviewInputRow,
  rowNumber: number,
  rules: AutoAssignmentRule[],
  existingEmails: Set<string>,
) {
  const matchedRule = rules.find((rule) => rule.active && rowMatchesAssignmentRule(row, rule));
  const missingFields = matchedRule
    ? matchedRule.matchCriteria.requiredFields.filter((field) => !String(row[field as keyof RosterPreviewInputRow] ?? '').trim())
    : [];
  const reviewReasons: string[] = [];
  const normalizedEmail = row.email?.toLowerCase() ?? '';

  if (normalizedEmail && existingEmails.has(normalizedEmail)) {
    reviewReasons.push('Learner email already exists in the platform.');
  }
  if (!matchedRule) {
    reviewReasons.push('No active rule matched this title or role.');
  }
  if (missingFields.length) {
    reviewReasons.push(`Missing ${missingFields.map(humanizeRosterField).join(', ')}.`);
  }
  if (!normalizedEmail) {
    reviewReasons.push('Missing email.');
  }

  const status = normalizedEmail && existingEmails.has(normalizedEmail)
    ? 'duplicate' as const
    : !matchedRule
      ? 'no_rule' as const
      : missingFields.length || !normalizedEmail
        ? 'needs_review' as const
        : 'auto_assign' as const;

  return {
    rowNumber,
    status,
    learner: {
      firstName: row.firstName ?? '',
      lastName: row.lastName ?? '',
      email: normalizedEmail,
      employeeId: row.employeeId ?? '',
      title: row.title ?? '',
      region: row.region ?? '',
      site: row.site ?? '',
      supervisor: row.supervisor ?? '',
      hireDate: row.hireDate ?? '',
    },
    matchedRule: matchedRule
      ? {
          id: matchedRule.id,
          name: matchedRule.name,
          reviewGate: matchedRule.reviewGate,
        }
      : null,
    suggestedAssignment: matchedRule
      ? {
          cohortId: matchedRule.cohort.id,
          cohortName: matchedRule.cohort.name,
          pathIds: matchedRule.pathIds,
          pathTitles: matchedRule.pathTitles,
          notificationTemplate: matchedRule.notificationTemplate,
        }
      : null,
    missingFields,
    reviewReasons,
    inviteAction: status === 'auto_assign'
      ? 'queue_invite' as const
      : status === 'duplicate'
        ? 'skip_existing_learner' as const
        : 'hold_for_training_ops_review' as const,
  };
}

function rowMatchesAssignmentRule(row: RosterPreviewInputRow, rule: AutoAssignmentRule) {
  const title = String(row.title ?? '').toLowerCase();
  return rule.matchCriteria.titleKeywords.some((keyword) => title.includes(keyword.toLowerCase()));
}

function humanizeRosterField(value: string) {
  const labels: Record<string, string> = {
    email: 'email',
    region: 'region',
    site: 'site',
    supervisor: 'supervisor',
    hireDate: 'hire date',
  };
  return labels[value] ?? value;
}

function buildRolloutForecast(learners: SupervisorReportLearner[]) {
  const learnersWithAssignmentData = learners.filter((learner) =>
    learner.email && learner.cohort.id && learner.cohort.region && learner.path.id,
  ).length;
  const completedLearners = learners.filter((learner) => learner.completion.status === 'completed');
  const supervisorRecipients = new Set(learners.map((learner) => learner.supervisor).filter((item) => item !== 'Unassigned'));

  return {
    weeklyNewHires: 50,
    autoAssignablePercent: learners.length ? Math.round((learnersWithAssignmentData / learners.length) * 100) : 0,
    supervisorDigestRecipients: supervisorRecipients.size || 1,
    lmsRowsReady: completedLearners.filter((learner) => !learner.completion.exportedToLms).length,
    estimatedTrainerHoursSaved: 12,
  };
}

function buildCompletionNotificationPreviews(learners: SupervisorReportLearner[]) {
  return learners
    .filter((learner) => learner.completion.completedAt || learner.completion.status === 'in_progress' || learner.completion.status === 'needs_review')
    .map((learner) => {
      const digestType = learner.completion.status === 'completed'
        ? 'completion' as const
        : learner.completion.status === 'needs_review'
          ? 'makeup' as const
          : 'coaching' as const;
      const recipientName = learner.supervisor !== 'Unassigned' ? learner.supervisor : learner.facilitatorIds[0] ?? 'Training Ops';
      const recipientEmail = recipientName === 'Unassigned'
        ? 'training-ops@thinktogether.local'
        : `${slugify(recipientName).replaceAll('-', '.')}@thinktogether.local`;
      const subject = digestType === 'completion'
        ? `${learner.name} completed ${learner.path.title}`
        : digestType === 'makeup'
          ? `${learner.name} needs makeup review for ${learner.path.title}`
          : `${learner.name} is ready for a practice nudge`;
      const body = digestType === 'completion'
        ? `${learner.name} completed ${learner.path.title} for ${learner.cohort.name} with ${learner.progressPercent}% progress and score ${learner.scores.completionScore}%. Confirmation: ${learner.completion.confirmationCode ?? 'pending'}.`
        : digestType === 'makeup'
          ? `${learner.name} has activity in ${learner.path.title} but is not clearance-ready. Review attendance, practice evidence, and makeup option before the next cohort closeout.`
          : `${learner.name} is ${learner.progressPercent}% complete in ${learner.path.title}. Send a short coaching reminder to finish practice, knowledge check, and commitment evidence.`;

      return {
        learnerId: learner.id,
        learnerName: learner.name,
        email: learner.email,
        recipientEmail,
        supervisor: learner.supervisor,
        facilitatorIds: learner.facilitatorIds,
        cohortId: learner.cohort.id,
        cohortName: learner.cohort.name,
        pathId: learner.path.id,
        pathTitle: learner.path.title,
        completionStatus: learner.completion.status,
        progressPercent: learner.progressPercent,
        score: learner.scores.completionScore,
        confirmationCode: learner.completion.confirmationCode,
        completedAt: learner.completion.completedAt,
        exportedToLms: learner.completion.exportedToLms,
        exportedAt: learner.completion.exportedAt,
        subject,
        body,
        digestType,
        preview: `${recipientName}: ${subject}`,
      };
    });
}

function buildSupervisorDigestExportRows(report: SupervisorReportPayload) {
  const generatedAt = report.generatedAt;
  const actionRows = report.actionQueue.map((item) => ({
    generated_at: generatedAt,
    row_type: 'action',
    owner: item.owner,
    learner_id: item.learnerId,
    learner_name: item.learnerName,
    learner_email: '',
    cohort_name: '',
    learning_path: '',
    status: item.status,
    priority: item.priority,
    progress_percent: '',
    score: '',
    subject: item.title,
    message: item.detail,
    exported_to_lms: '',
  }));
  const notificationRows = report.completionNotifications.map((item) => ({
    generated_at: generatedAt,
    row_type: item.digestType,
    owner: item.supervisor !== 'Unassigned' ? item.supervisor : item.facilitatorIds[0] ?? 'Training Ops',
    learner_id: item.learnerId,
    learner_name: item.learnerName,
    learner_email: item.email,
    cohort_name: item.cohortName,
    learning_path: item.pathTitle,
    status: item.completionStatus,
    priority: item.digestType === 'completion' ? 'medium' : 'low',
    progress_percent: item.progressPercent,
    score: item.score,
    subject: item.subject,
    message: item.body,
    exported_to_lms: item.exportedToLms,
  }));
  return [...actionRows, ...notificationRows];
}

function buildContentOperationsExportRows(report: SupervisorReportPayload) {
  const generatedAt = report.generatedAt;
  const packagesByRequest = new Map<string, typeof report.generatedTrainingPackages>();
  for (const item of report.generatedTrainingPackages) {
    if (!item.contentRequestId) continue;
    const list = packagesByRequest.get(item.contentRequestId) ?? [];
    list.push(item);
    packagesByRequest.set(item.contentRequestId, list);
  }

  const requestRows = report.contentDevelopmentRequests.map((item) => {
    const packages = packagesByRequest.get(item.id) ?? [];
    return {
      generated_at: generatedAt,
      row_type: 'content_request',
      content_request_id: item.id,
      generated_package_id: '',
      title: item.request,
      audience: item.audience,
      delivery_mode: item.deliveryMode,
      request_status: item.status,
      package_status: '',
      review_owner: item.reviewOwner,
      review_notes: item.reviewNotes,
      outputs: item.outputs.join('; '),
      source_artifacts: item.artifactsNeeded.join('; '),
      template_id: '',
      provider: '',
      model: '',
      required_outputs: '',
      package_count: packages.length,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      approved_at: item.approvedAt ?? '',
      published_at: item.publishedAt ?? '',
    };
  });

  const packageRows = report.generatedTrainingPackages.map((item) => ({
    generated_at: generatedAt,
    row_type: 'generated_package',
    content_request_id: item.contentRequestId ?? '',
    generated_package_id: item.id,
    title: item.title,
    audience: item.audience,
    delivery_mode: item.deliveryMode,
    request_status: report.contentDevelopmentRequests.find((requestItem) => requestItem.id === item.contentRequestId)?.status ?? '',
    package_status: item.reviewStatus,
    review_owner: item.reviewOwner,
    review_notes: item.reviewNotes,
    outputs: item.package.template.requiredOutputs.join('; '),
    source_artifacts: item.sourceArtifactIds.join('; '),
    template_id: item.templateId,
    provider: item.provider,
    model: item.model,
    required_outputs: item.package.template.requiredOutputs.join('; '),
    package_count: '',
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    approved_at: item.approvedAt ?? '',
    published_at: item.publishedAt ?? '',
  }));

  return [...requestRows, ...packageRows];
}

async function readContentDevelopmentRequests(db: AppDatabase) {
  const result = await db.query(
    `SELECT *
     FROM content_development_requests
     ORDER BY
       CASE status
        WHEN 'review-needed' THEN 0
        WHEN 'draft-ready' THEN 1
        WHEN 'source-mapped' THEN 2
        WHEN 'intake' THEN 3
        WHEN 'approved' THEN 4
        ELSE 5
       END,
       updated_at DESC`,
  );
  return (result.rows as ContentDevelopmentRequestRow[]).map(mapContentDevelopmentRequest);
}

async function readContentDevelopmentRequestRow(db: AppDatabase, requestId: string) {
  const result = await db.query('SELECT * FROM content_development_requests WHERE id = $1', [requestId]);
  return result.rows[0] as ContentDevelopmentRequestRow | undefined;
}

function mapContentDevelopmentRequest(row: ContentDevelopmentRequestRow) {
  return {
    id: row.id,
    request: row.request,
    audience: row.audience,
    deliveryMode: row.delivery_mode,
    status: row.status,
    artifactsNeeded: row.artifacts_needed,
    outputs: row.outputs,
    reviewOwner: row.review_owner,
    reviewNotes: row.review_notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    approvedAt: row.approved_at?.toISOString() ?? null,
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

async function readGeneratedTrainingPackages(db: AppDatabase) {
  const result = await db.query(
    `SELECT *
     FROM generated_training_packages
     ORDER BY
       CASE review_status
        WHEN 'review-needed' THEN 0
        WHEN 'draft' THEN 1
        WHEN 'approved' THEN 2
        WHEN 'published' THEN 3
        ELSE 4
       END,
       updated_at DESC`,
  );
  return (result.rows as GeneratedTrainingPackageRow[]).map(mapGeneratedTrainingPackage);
}

function mapGeneratedTrainingPackage(row: GeneratedTrainingPackageRow) {
  return {
    id: row.id,
    contentRequestId: row.content_request_id,
    templateId: row.template_id,
    provider: row.provider,
    model: row.model,
    title: row.title,
    audience: row.audience,
    durationMinutes: row.duration_minutes,
    deliveryMode: row.delivery_mode,
    sourceArtifactIds: row.source_artifact_ids,
    package: row.package_payload,
    reviewStatus: row.review_status,
    reviewOwner: row.review_owner,
    reviewNotes: row.review_notes,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    approvedAt: row.approved_at?.toISOString() ?? null,
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

async function persistGeneratedTrainingPackage(
  db: AppDatabase,
  contentRequest: ContentDevelopmentRequestRow,
  trainingPackage: ContentStudioPackage,
  request: z.infer<typeof contentStudioPackageSchema>,
  actor: User | undefined,
) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const reviewNotes = `AI draft generated from ${trainingPackage.sourceArtifacts.length} source artifacts. Human review required before facilitation.`;
  const result = await db.transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO generated_training_packages
        (id, content_request_id, template_id, provider, model, title, audience,
         duration_minutes, delivery_mode, source_artifact_ids, package_payload,
         review_status, review_owner, review_notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               'draft', $12, $13, $14, $15, $15)
       RETURNING *`,
      [
        id,
        contentRequest.id,
        trainingPackage.template.id,
        trainingPackage.provider,
        trainingPackage.model,
        trainingPackage.title,
        trainingPackage.audience,
        trainingPackage.durationMinutes,
        request.deliveryMode,
        JSON.stringify(trainingPackage.sourceArtifacts),
        JSON.stringify(trainingPackage),
        contentRequest.review_owner,
        reviewNotes,
        actor?.id ?? null,
        now,
      ],
    );

    await client.query(
      `UPDATE content_development_requests
       SET status = 'draft-ready',
           review_notes = $2,
           updated_at = $3
       WHERE id = $1`,
      [
        contentRequest.id,
        `${contentRequest.review_notes ? `${contentRequest.review_notes} ` : ''}Draft package ${id} generated and ready for review.`,
        now,
      ],
    );

    return inserted.rows[0] as GeneratedTrainingPackageRow;
  });

  return mapGeneratedTrainingPackage(result);
}

async function setContentRequestStatus(
  db: AppDatabase,
  requestId: string,
  status: ContentDevelopmentRequestRow['status'],
  reviewNotes: string,
  actor: User | undefined,
) {
  const now = new Date().toISOString();
  const result = await db.query(
    `UPDATE content_development_requests
     SET status = $2,
         review_notes = CASE WHEN $3 = '' THEN review_notes ELSE $3 END,
         updated_at = $4,
         approved_at = CASE WHEN $2 = 'approved' THEN $4::timestamptz ELSE approved_at END,
         published_at = CASE WHEN $2 = 'published' THEN $4::timestamptz ELSE published_at END
     WHERE id = $1
     RETURNING *`,
    [requestId, status, reviewNotes, now],
  );
  const row = result.rows[0] as ContentDevelopmentRequestRow | undefined;
  if (!row) return undefined;
  if (row.status === 'approved' || row.status === 'published') {
    await syncContentLibraryVersionForRequest(db, row, actor);
  }
  await enqueueContentRequestNotification(db, row, actor);
  return row;
}

function generatedPackageStatusToContentRequestStatus(status: GeneratedTrainingPackageRow['review_status']) {
  if (status === 'review-needed') return 'review-needed' as const;
  if (status === 'approved') return 'approved' as const;
  if (status === 'published') return 'published' as const;
  if (status === 'rejected') return 'draft-ready' as const;
  return null;
}

async function readContentLibraryVersions(db: AppDatabase) {
  const result = await db.query(
    `SELECT *
     FROM content_library_versions
     ORDER BY
       CASE status
        WHEN 'published' THEN 0
        WHEN 'approved' THEN 1
        WHEN 'review' THEN 2
        WHEN 'draft' THEN 3
        ELSE 4
       END,
       COALESCE(published_at, approved_at, created_at) DESC`,
  );
  return (result.rows as ContentLibraryVersionRow[]).map(mapContentLibraryVersion);
}

function mapContentLibraryVersion(row: ContentLibraryVersionRow) {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    status: row.status,
    contentRequestId: row.content_request_id,
    artifactIds: row.artifact_ids,
    sourceMetrics: row.source_metrics,
    reviewOwner: row.review_owner,
    reviewNotes: row.review_notes,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    approvedAt: row.approved_at?.toISOString() ?? null,
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

async function syncContentLibraryVersionForRequest(db: AppDatabase, row: ContentDevelopmentRequestRow, actor: User | undefined) {
  const status = row.status === 'published' ? 'published' : 'approved';
  const version = `${SOURCE_LIBRARY_VERSION}-${row.id}`;
  await db.query(
    `INSERT INTO content_library_versions
       (id, version, title, status, content_request_id, artifact_ids, source_metrics,
        review_owner, review_notes, created_by, created_at, approved_at, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             CASE WHEN $4 IN ('approved', 'published') THEN $11::timestamptz ELSE NULL END,
             CASE WHEN $4 = 'published' THEN $11::timestamptz ELSE NULL END)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       artifact_ids = EXCLUDED.artifact_ids,
       source_metrics = EXCLUDED.source_metrics,
       review_owner = EXCLUDED.review_owner,
       review_notes = EXCLUDED.review_notes,
       approved_at = COALESCE(content_library_versions.approved_at, EXCLUDED.approved_at),
       published_at = CASE WHEN EXCLUDED.status = 'published' THEN EXCLUDED.published_at ELSE content_library_versions.published_at END`,
    [
      `content-request-${row.id}`,
      version,
      row.request,
      status,
      row.id,
      JSON.stringify(row.artifacts_needed),
      JSON.stringify({
        outputs: row.outputs.length,
        artifacts: row.artifacts_needed.length,
        deliveryMode: row.delivery_mode,
        sourceLibraryVersion: SOURCE_LIBRARY_VERSION,
      }),
      row.review_owner,
      row.review_notes || contentRequestNextLibraryNote(row.status),
      actor?.id ?? null,
      row.updated_at.toISOString(),
    ],
  );
}

function contentRequestNextLibraryNote(status: ContentDevelopmentRequestRow['status']) {
  if (status === 'published') return 'Published after human review; ready for rollout planning and assignment mapping.';
  if (status === 'approved') return 'Approved by reviewer; waiting for publish decision before broad rollout.';
  return 'Content library version pending review.';
}

async function readNotificationQueue(db: AppDatabase) {
  const result = await db.query(
    `SELECT *
     FROM notification_queue
     ORDER BY
       CASE status
        WHEN 'queued' THEN 0
        WHEN 'draft' THEN 1
        WHEN 'sent' THEN 2
        ELSE 3
       END,
       CASE priority
        WHEN 'high' THEN 0
        WHEN 'medium' THEN 1
        ELSE 2
       END,
       updated_at DESC`,
  );
  return (result.rows as NotificationQueueRow[]).map(mapNotificationQueueItem);
}

function mapNotificationQueueItem(row: NotificationQueueRow) {
  return {
    id: row.id,
    type: row.type,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    body: row.body,
    owner: row.owner,
    priority: row.priority,
    status: row.status,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    scheduledFor: row.scheduled_for?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function enqueueCompletionNotification(db: AppDatabase, learnerId: string, pathId: string) {
  const result = await db.query(
    `SELECT l.id AS learner_id, l.first_name, l.last_name, l.email, l.supervisor,
            c.id AS cohort_id, c.name AS cohort_name, c.facilitator_ids,
            lp.id AS path_id, lp.title AS path_title,
            cr.score, cr.confirmation_code, cr.completed_at, cr.exported_to_lms
     FROM learners l
     JOIN cohorts c ON c.id = l.cohort_id
     JOIN learning_paths lp ON lp.id = $2
     JOIN completion_records cr ON cr.learner_id = l.id AND cr.path_id = lp.id
     WHERE l.id = $1`,
    [learnerId, pathId],
  );
  const row = result.rows[0] as CompletionNotificationSourceRow | undefined;
  if (!row) return;

  const learnerName = `${row.first_name} ${row.last_name}`;
  const recipientName = row.supervisor || row.facilitator_ids[0] || 'Training Ops';
  const recipientEmail = notificationRecipientEmail(recipientName);
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO notification_queue
       (id, type, recipient_name, recipient_email, subject, body, owner, priority, status,
        entity_type, entity_id, metadata, scheduled_for, created_at, updated_at)
     VALUES ($1, 'completion_digest', $2, $3, $4, $5, $6, 'medium', 'queued',
             'completion_record', $7, $8, $9, $9, $9)
     ON CONFLICT (type, entity_type, entity_id, recipient_email)
     DO UPDATE SET
       subject = EXCLUDED.subject,
       body = EXCLUDED.body,
       owner = EXCLUDED.owner,
       priority = EXCLUDED.priority,
       status = CASE WHEN notification_queue.status = 'sent' THEN notification_queue.status ELSE EXCLUDED.status END,
       metadata = EXCLUDED.metadata,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      randomUUID(),
      recipientName,
      recipientEmail,
      `${learnerName} completed ${row.path_title}`,
      `${learnerName} completed ${row.path_title} for ${row.cohort_name} with score ${row.score}%. Confirmation: ${row.confirmation_code}. Review LMS export status and supervisor follow-up.`,
      recipientName,
      `${row.learner_id}:${row.path_id}`,
      JSON.stringify({
        learnerId: row.learner_id,
        learnerName,
        learnerEmail: row.email,
        cohortId: row.cohort_id,
        cohortName: row.cohort_name,
        pathId: row.path_id,
        score: row.score,
        confirmationCode: row.confirmation_code,
        completedAt: row.completed_at?.toISOString() ?? null,
        exportedToLms: row.exported_to_lms,
      }),
      now,
    ],
  );
}

async function enqueueContentRequestNotification(db: AppDatabase, row: ContentDevelopmentRequestRow, actor: User | undefined) {
  if (row.status !== 'review-needed' && row.status !== 'published') return;

  const type = row.status === 'published' ? 'content_published' : 'content_review';
  const subject = row.status === 'published'
    ? `Published training package: ${row.request}`
    : `Review needed: ${row.request}`;
  const body = row.status === 'published'
    ? `${row.request} is published for ${row.audience}. Outputs: ${row.outputs.join(', ')}. Confirm assignment and reporting plan before broad rollout.`
    : `${row.request} needs human review by ${row.review_owner}. Delivery: ${row.delivery_mode}. Outputs: ${row.outputs.join(', ')}. Notes: ${row.review_notes || 'No notes provided.'}`;
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO notification_queue
       (id, type, recipient_name, recipient_email, subject, body, owner, priority, status,
        entity_type, entity_id, metadata, scheduled_for, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $3, $7, 'queued',
             'content_request', $8, $9, $10, $10, $10)
     ON CONFLICT (type, entity_type, entity_id, recipient_email)
     DO UPDATE SET
       subject = EXCLUDED.subject,
       body = EXCLUDED.body,
       priority = EXCLUDED.priority,
       status = CASE WHEN notification_queue.status = 'sent' THEN notification_queue.status ELSE EXCLUDED.status END,
       metadata = EXCLUDED.metadata,
       updated_at = EXCLUDED.updated_at`,
    [
      randomUUID(),
      type,
      row.review_owner,
      notificationRecipientEmail(row.review_owner),
      subject,
      body,
      row.status === 'published' ? 'medium' : 'high',
      row.id,
      JSON.stringify({
        requestId: row.id,
        request: row.request,
        audience: row.audience,
        deliveryMode: row.delivery_mode,
        status: row.status,
        outputs: row.outputs,
        artifactsNeeded: row.artifacts_needed,
        reviewNotes: row.review_notes,
        actorEmail: actor?.email ?? null,
      }),
      now,
    ],
  );
}

function notificationRecipientEmail(name: string) {
  const normalized = name && name !== 'Unassigned' ? slugify(name).replaceAll('-', '.') : 'training.ops';
  return `${normalized}@thinktogether.local`;
}

function buildIntegrationReadiness(learners: SupervisorReportLearner[]) {
  const hasMissingSupervisor = learners.some((learner) => learner.supervisor === 'Unassigned');
  const hasCompletedNotExported = learners.some((learner) => learner.completion.status === 'completed' && !learner.completion.exportedToLms);

  return [
    {
      id: 'adp-roster-import',
      system: 'HR/ADP' as const,
      status: hasMissingSupervisor ? 'needs_mapping' as const : 'ready' as const,
      owner: 'HR + Training Ops',
      nextStep: hasMissingSupervisor
        ? 'Map supervisor, title, region, site, and hire date fields before automatic assignment.'
        : 'Pilot weekly CSV import before moving to API sync.',
    },
    {
      id: 'lms-clearance-export',
      system: 'LMS' as const,
      status: hasCompletedNotExported ? 'needs_approval' as const : 'ready' as const,
      owner: 'Training Ops',
      nextStep: hasCompletedNotExported
        ? 'Review completion rows and approve LMS export handoff.'
        : 'Keep LMS as source of record; export timestamp and content version stay in this tool.',
    },
    {
      id: 'supervisor-email-digest',
      system: 'Email' as const,
      status: 'needs_approval' as const,
      owner: 'Program Training & Development',
      nextStep: 'Approve digest wording for completion alerts, coaching nudges, and makeup reminders.',
    },
    {
      id: 'source-library-governance',
      system: 'Content Library' as const,
      status: 'ready' as const,
      owner: 'Program Training & Development',
      nextStep: 'Route generated decks, checks, and handouts through human review before facilitation.',
    },
  ];
}

function buildSupervisorActionQueue(learners: SupervisorReportLearner[]) {
  return learners
    .flatMap((learner) => {
      const owner = learner.supervisor !== 'Unassigned' ? learner.supervisor : learner.facilitatorIds[0] ?? 'Training Ops';
      const items: Array<{
        id: string;
        type: 'completion_alert' | 'lms_export' | 'coaching_nudge' | 'makeup_review';
        learnerId: string;
        learnerName: string;
        owner: string;
        priority: 'high' | 'medium' | 'low';
        status: 'ready' | 'review' | 'queued';
        title: string;
        detail: string;
      }> = [];

      if (learner.completion.status === 'completed') {
        items.push({
          id: `${learner.id}-${learner.path.id}-completion-alert`,
          type: 'completion_alert',
          learnerId: learner.id,
          learnerName: learner.name,
          owner,
          priority: 'medium',
          status: 'ready',
          title: 'Supervisor completion alert',
          detail: `${learner.name} passed ${learner.path.title} with ${learner.scores.completionScore}% and can be included in the next supervisor digest.`,
        });
      }

      if (learner.completion.status === 'completed' && !learner.completion.exportedToLms) {
        items.push({
          id: `${learner.id}-${learner.path.id}-lms-export`,
          type: 'lms_export',
          learnerId: learner.id,
          learnerName: learner.name,
          owner: 'Training Ops',
          priority: 'high',
          status: 'review',
          title: 'LMS clearance export pending',
          detail: `${learner.name} has a confirmation code but has not been marked exported to LMS yet.`,
        });
      }

      if (learner.completion.status === 'in_progress' && learner.progressPercent >= 50) {
        items.push({
          id: `${learner.id}-${learner.path.id}-coaching-nudge`,
          type: 'coaching_nudge',
          learnerId: learner.id,
          learnerName: learner.name,
          owner,
          priority: 'low',
          status: 'queued',
          title: 'Practice coaching nudge',
          detail: `${learner.name} is ${learner.progressPercent}% complete; send a short practice reminder before the final check.`,
        });
      }

      if (learner.completion.status === 'needs_review' || (learner.progressPercent < 100 && learner.practiceSubmissions > 0)) {
        items.push({
          id: `${learner.id}-${learner.path.id}-makeup-review`,
          type: 'makeup_review',
          learnerId: learner.id,
          learnerName: learner.name,
          owner,
          priority: 'medium',
          status: 'review',
          title: 'Makeup or review follow-up',
          detail: `${learner.name} has practice activity but is not clearance-ready. Review whether makeup support is needed.`,
        });
      }

      return items;
    })
    .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority))
    .slice(0, 12);
}

async function buildAssignmentAutomationPreview(db: AppDatabase, learners: SupervisorReportLearner[]) {
  const rules = await readAutoAssignmentRules(db);
  const hasSiteLeadPath = learners.some((learner) => learner.title?.toLowerCase().includes('site lead'));
  return {
    rules: rules.map((rule) => ({
      id: rule.id,
      trigger: `${rule.matchCriteria.titleKeywords.join(', ')} title match`,
      assignment: `Auto-enroll in ${rule.pathTitles.join(' + ')} for ${rule.cohort.name}`,
      reviewGate: rule.reviewGate,
    })),
    readyForPilot: learners.length > 0,
    nextIntegration: hasSiteLeadPath
      ? 'Map ADP title and site fields to automatic Program Induction and Site Lead Onboarding enrollment.'
      : 'Start with CSV/ADP export import, then promote title/region matching to automatic cohort assignment.',
  };
}

function priorityRank(priority: 'high' | 'medium' | 'low') {
  return priority === 'high' ? 0 : priority === 'medium' ? 1 : 2;
}

function mapSupervisorReportLearner(row: SupervisorReportRow) {
  const requiredModuleCount = Number(row.required_module_count);
  const completedModuleCount = Number(row.completed_module_count);
  const progressPercent = requiredModuleCount > 0 ? Math.round((completedModuleCount / requiredModuleCount) * 100) : 0;
  const completionStatus = supervisorCompletionStatus(row, progressPercent);
  const completedAt = row.completed_at?.toISOString() ?? null;
  return {
    id: row.learner_id,
    name: `${row.first_name} ${row.last_name}`,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    supervisor: row.supervisor ?? 'Unassigned',
    facilitatorIds: row.facilitator_ids.length > 0 ? row.facilitator_ids : ['Unassigned'],
    title: row.title,
    site: row.site,
    cohort: {
      id: row.cohort_id,
      name: row.cohort_name,
      region: row.region,
    },
    path: {
      id: row.path_id,
      title: row.path_title,
    },
    progressPercent,
    scores: {
      knowledgeScore: Number(row.average_knowledge_score),
      practiceScore: Number(row.average_practice_score),
      completionScore: row.completion_score === null ? progressPercent : Number(row.completion_score),
    },
    completion: {
      status: completionStatus,
      completedModuleCount,
      requiredModuleCount,
      passFail: row.pass_fail,
      confirmationCode: row.confirmation_code,
      completedAt,
      exportedToLms: row.exported_to_lms ?? false,
      exportedAt: row.exported_at?.toISOString() ?? null,
    },
    practiceSubmissions: Number(row.practice_submissions),
  };
}

function supervisorCompletionStatus(row: SupervisorReportRow, progressPercent: number) {
  if (row.pass_fail === 'needs-review') return 'needs_review';
  if (row.pass_fail === 'pass' || row.completed_at) return 'completed';
  if (progressPercent > 0 || Number(row.average_knowledge_score) > 0 || Number(row.practice_submissions) > 0) return 'in_progress';
  return 'not_started';
}

function groupSupervisorReportLearners(
  learners: SupervisorReportLearner[],
  groupBy: 'supervisor' | 'facilitator' | 'cohort',
) {
  const groups = new Map<string, { label: string; learners: SupervisorReportLearner[]; cohortIds: Set<string> }>();
  for (const learner of learners) {
    const keys =
      groupBy === 'supervisor'
        ? [learner.supervisor]
        : groupBy === 'facilitator'
          ? learner.facilitatorIds
          : [learner.cohort.id];

    for (const key of keys) {
      const label = groupBy === 'cohort' ? learner.cohort.name : key;
      const existing = groups.get(key) ?? { label, learners: [], cohortIds: new Set<string>() };
      existing.learners.push(learner);
      existing.cohortIds.add(learner.cohort.id);
      groups.set(key, existing);
    }
  }

  return Array.from(groups.entries()).map(([id, group]) => {
    const completed = group.learners.filter((learner) => learner.completion.status === 'completed').length;
    const totalProgress = group.learners.reduce((sum, learner) => sum + learner.progressPercent, 0);
    return {
      id,
      label: group.label,
      learnerCount: group.learners.length,
      cohortIds: Array.from(group.cohortIds).sort(),
      averageProgressPercent: group.learners.length ? Math.round(totalProgress / group.learners.length) : 0,
      completionRate: group.learners.length ? Math.round((completed / group.learners.length) * 100) : 0,
      learners: group.learners,
    };
  });
}

async function upsertCompletionRecordIfReady(
  db: AppDatabase,
  user: User | undefined,
  pathId: string,
  completedAt: string,
) {
  if (!user) return undefined;

  const result = await db.query(
    `WITH required_modules AS (
       SELECT id
       FROM modules
       WHERE path_id = $2 AND required_for_completion
     ),
     counts AS (
       SELECT
         (SELECT COUNT(*)::int FROM required_modules) AS required_module_count,
         (
           SELECT COUNT(DISTINCT p.module_id)::int
           FROM progress p
           JOIN required_modules rm ON rm.id = p.module_id
           WHERE p.user_id = $1 AND p.status = 'completed'
         ) AS completed_module_count
     )
     SELECT required_module_count, completed_module_count
     FROM counts`,
    [user.id, pathId],
  );
  const counts = result.rows[0] as { required_module_count: number; completed_module_count: number } | undefined;
  if (!counts || counts.required_module_count === 0 || counts.completed_module_count < counts.required_module_count) {
    return undefined;
  }

  const score = Math.round((counts.completed_module_count / counts.required_module_count) * 100);
  const passFail = score >= 80 ? 'pass' : 'needs-review';
  const confirmationCode = `PBIS-${user.learnerId ?? user.id}-${Date.parse(completedAt)}`;
  const completionResult = await db.query(
    `INSERT INTO completion_records
       (id, user_id, learner_id, path_id, completed_module_count, required_module_count, score,
        pass_fail, confirmation_code, completed_at, content_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, path_id)
     DO UPDATE SET
       learner_id = EXCLUDED.learner_id,
       completed_module_count = EXCLUDED.completed_module_count,
       required_module_count = EXCLUDED.required_module_count,
       score = EXCLUDED.score,
       pass_fail = EXCLUDED.pass_fail,
       completed_at = EXCLUDED.completed_at,
       content_version = EXCLUDED.content_version
     RETURNING id, learner_id, path_id, completed_module_count, required_module_count, score,
       pass_fail, confirmation_code, completed_at, content_version, exported_to_lms, exported_at`,
    [
      randomUUID(),
      user.id,
      user.learnerId,
      pathId,
      counts.completed_module_count,
      counts.required_module_count,
      score,
      passFail,
      confirmationCode,
      completedAt,
      CONTENT_VERSION,
    ],
  );
  return mapCompletionRecord(completionResult.rows[0] as CompletionRecordRow);
}

function mapCompletionRecord(row: CompletionRecordRow) {
  return {
    id: row.id,
    learnerId: row.learner_id,
    pathId: row.path_id,
    completedModuleCount: row.completed_module_count,
    requiredModuleCount: row.required_module_count,
    score: row.score,
    passFail: row.pass_fail,
    confirmationCode: row.confirmation_code,
    completedAt: row.completed_at,
    contentVersion: row.content_version,
    exportedToLms: row.exported_to_lms,
    exportedAt: row.exported_at,
  };
}

function mapPracticeSubmission(row: PracticeRow) {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    response: row.response,
    score: row.score,
    label: row.label,
    rationale: row.rationale,
    coachingNote: row.coaching_note,
    confidence: row.confidence,
    sourceBasis: row.source_basis,
    submittedAt: row.created_at,
    contentVersion: row.content_version,
  };
}

function surveyRatingFromScore(score: number): FacilitatorFeedbackRow['rating'] {
  if (score >= 4) return 'ready';
  if (score >= 3) return 'needs-coaching';
  return 'not-ready';
}

function mapFacilitatorFeedback(row: FacilitatorFeedbackRow) {
  return {
    id: row.id,
    learnerId: row.learner_id,
    facilitatorId: row.facilitator_id,
    pathId: row.path_id,
    rating: row.rating,
    score: Number(row.score),
    notes: row.notes,
    surveySubmitted: row.survey_submitted,
    submittedAt: row.created_at,
  };
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    learnerId: row.learner_id,
  };
}

async function readLearnerForUser(db: AppDatabase, learnerId: string) {
  const result = await db.query(
    `SELECT l.id, l.first_name, l.last_name, l.email, l.cohort_id, l.assigned_path_ids,
            c.name AS cohort_name, c.region
     FROM learners l
     JOIN cohorts c ON c.id = l.cohort_id
     WHERE l.id = $1`,
    [learnerId],
  );
  const row = result.rows[0] as LearnerRow | undefined;
  return row ? mapLearner(row) : undefined;
}

function mapLearner(row: LearnerRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    cohortId: row.cohort_id,
    cohortName: row.cohort_name,
    region: row.region,
    assignedPathIds: row.assigned_path_ids,
  };
}

function mapLearnerFromInvite(row: InviteAcceptanceRow) {
  return {
    id: row.learner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    cohortId: row.cohort_id,
    cohortName: row.cohort_name,
    region: row.region,
    assignedPathIds: row.assigned_path_ids,
  };
}

const clearanceExportHeaders = [
  'generated_at',
  'content_version',
  'id',
  'first_name',
  'last_name',
  'email',
  'cohort_name',
  'region',
  'employee_id',
  'title',
  'hire_date',
  'supervisor',
  'site',
  'verified_in_lms',
  'exported_to_lms',
  'training_clearance_status',
  'background_check_status',
  'site_clearance_status',
];

const completionExportHeaders = [
  'generated_at',
  'content_version',
  'learner_id',
  'first_name',
  'last_name',
  'email',
  'cohort_name',
  'region',
  'learning_path',
  'completed_module_count',
  'required_module_count',
  'score',
  'pass_fail',
  'confirmation_code',
  'completed_at',
  'exported_to_lms',
  'exported_at',
  'average_knowledge_score',
  'practice_submissions',
  'invite_status',
];

const supervisorDigestExportHeaders = [
  'generated_at',
  'row_type',
  'owner',
  'learner_id',
  'learner_name',
  'learner_email',
  'cohort_name',
  'learning_path',
  'status',
  'priority',
  'progress_percent',
  'score',
  'subject',
  'message',
  'exported_to_lms',
];

const contentOperationsExportHeaders = [
  'generated_at',
  'row_type',
  'content_request_id',
  'generated_package_id',
  'title',
  'audience',
  'delivery_mode',
  'request_status',
  'package_status',
  'review_owner',
  'review_notes',
  'outputs',
  'source_artifacts',
  'template_id',
  'provider',
  'model',
  'required_outputs',
  'package_count',
  'created_at',
  'updated_at',
  'approved_at',
  'published_at',
];

function toCsv(rows: Array<Record<string, unknown>>, headers = rows[0] ? Object.keys(rows[0]) : []) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sendCsv(res: Response, filename: string, rows: Array<Record<string, unknown>>, headers?: string[]) {
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(rows, headers));
}

function adminLearnersQuery() {
  return `SELECT l.id, l.first_name, l.last_name, l.email, l.cohort_id, l.assigned_path_ids,
                 c.name AS cohort_name, c.region,
                 CASE
                   WHEN accepted_invite.id IS NOT NULL THEN 'accepted'
                   WHEN pending_invite.id IS NOT NULL THEN 'pending'
                   WHEN revoked_invite.id IS NOT NULL THEN 'revoked'
                   WHEN expired_invite.id IS NOT NULL THEN 'expired'
                   ELSE 'not_sent'
                 END AS invite_status
          FROM learners l
          JOIN cohorts c ON c.id = l.cohort_id
          LEFT JOIN LATERAL (
            SELECT id FROM learner_invites
            WHERE learner_id = l.id AND accepted_at IS NOT NULL
            ORDER BY accepted_at DESC
            LIMIT 1
          ) accepted_invite ON true
          LEFT JOIN LATERAL (
            SELECT id FROM learner_invites
            WHERE learner_id = l.id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
            ORDER BY expires_at DESC
            LIMIT 1
          ) pending_invite ON true
          LEFT JOIN LATERAL (
            SELECT id FROM learner_invites
            WHERE learner_id = l.id AND accepted_at IS NULL AND revoked_at IS NOT NULL
            ORDER BY revoked_at DESC
            LIMIT 1
          ) revoked_invite ON true
          LEFT JOIN LATERAL (
            SELECT id FROM learner_invites
            WHERE learner_id = l.id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= NOW()
            ORDER BY expires_at DESC
            LIMIT 1
          ) expired_invite ON true
          ORDER BY l.last_name, l.first_name`;
}

function adminCohortsQuery() {
  return `SELECT c.id, c.name, c.region, c.starts_at, c.facilitator_ids, c.path_ids,
                 COUNT(l.id)::int AS learner_count
          FROM cohorts c
          LEFT JOIN learners l ON l.cohort_id = c.id
          GROUP BY c.id, c.name, c.region, c.starts_at, c.facilitator_ids, c.path_ids
          ORDER BY c.starts_at DESC`;
}

async function readAdminCohort(db: AppDatabase, cohortId: string) {
  const result = await db.query('SELECT id, name, region FROM cohorts WHERE id = $1', [cohortId]);
  return result.rows[0] as Pick<AdminCohortRow, 'id' | 'name' | 'region'> | undefined;
}

function mapAdminLearner(row: AdminLearnerRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    cohortId: row.cohort_id,
    cohortName: row.cohort_name,
    region: row.region,
    assignedPathIds: row.assigned_path_ids,
    inviteStatus: row.invite_status,
  };
}

function mapAdminCohort(row: AdminCohortRow) {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    startsAt: row.starts_at.toISOString(),
    facilitatorIds: row.facilitator_ids,
    pathIds: row.path_ids,
    learnerCount: Number(row.learner_count),
  };
}

type AdminLearnerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cohort_id: string;
  assigned_path_ids: string[];
  cohort_name: string;
  region: string;
  invite_status: 'not_sent' | 'pending' | 'accepted' | 'expired' | 'revoked';
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'learner';
  learner_id: string | null;
};

type LearnerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cohort_id: string;
  assigned_path_ids: string[];
  cohort_name: string;
  region: string;
};

type LearnerSurveyAccessRow = {
  id: string;
  assigned_path_ids: string[];
  facilitator_ids: string[];
};

type FacilitatorFeedbackRow = {
  id: string;
  learner_id: string;
  facilitator_id: string;
  path_id: string;
  rating: 'ready' | 'needs-coaching' | 'not-ready';
  score: string | number;
  notes: string;
  survey_submitted: boolean;
  created_at: Date;
};

type InviteAcceptanceRow = {
  id: string;
  learner_id: string;
  email: string;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  first_name: string;
  last_name: string;
  cohort_id: string;
  assigned_path_ids: string[];
  cohort_name: string;
  region: string;
};

type AdminAuditEventRow = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

type AdminCohortRow = {
  id: string;
  name: string;
  region: string;
  starts_at: Date;
  facilitator_ids: string[];
  path_ids: string[];
  learner_count: number | string;
};

type AutoAssignmentRuleRow = {
  id: string;
  name: string;
  priority: number | string;
  active: boolean;
  match_criteria: unknown;
  cohort_id: string;
  cohort_name: string;
  cohort_region: string;
  path_ids: string[];
  path_titles: string[];
  review_gate: string;
  notification_template: string;
  created_at: Date;
  updated_at: Date;
};

type RosterPreviewInputRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  employeeId?: string;
  title?: string;
  region?: string;
  site?: string;
  supervisor?: string;
  hireDate?: string;
};

type AdminKpiRow = {
  total_learners: number;
  attended: number | null;
  makeup_required: number | null;
  clearance_ready: number | null;
  blocked: number | null;
  average_knowledge_score: number;
  facilitator_rating: number;
  assigned_surveys: number;
  submitted_surveys: number;
  completed_modules: number;
  completed_required_modules: number;
  assigned_required_modules: number;
  practice_submissions: number;
  modules: number;
};

type ReadinessRow = {
  track: string;
  enrolled: number;
  clearance_ready: number;
  needs_coaching: number;
  blocked: number;
};

type SupervisorReportRow = {
  learner_id: string;
  first_name: string;
  last_name: string;
  email: string;
  supervisor: string | null;
  title: string | null;
  site: string | null;
  cohort_id: string;
  cohort_name: string;
  region: string;
  facilitator_ids: string[];
  path_id: string;
  path_title: string;
  required_module_count: number;
  completed_module_count: number;
  average_knowledge_score: number | string;
  average_practice_score: number | string;
  practice_submissions: number;
  completion_score: number | null;
  pass_fail: 'pass' | 'needs-review' | null;
  confirmation_code: string | null;
  completed_at: Date | null;
  exported_to_lms: boolean | null;
  exported_at: Date | null;
};

type ContentDevelopmentRequestRow = {
  id: string;
  request: string;
  audience: string;
  delivery_mode: 'in-person' | 'virtual' | 'hybrid';
  status: 'intake' | 'source-mapped' | 'draft-ready' | 'review-needed' | 'approved' | 'published';
  artifacts_needed: string[];
  outputs: string[];
  review_owner: string;
  review_notes: string;
  requested_by: string | null;
  created_at: Date;
  updated_at: Date;
  approved_at: Date | null;
  published_at: Date | null;
};

type NotificationQueueRow = {
  id: string;
  type: 'learner_invite' | 'completion_digest' | 'coaching_nudge' | 'makeup_review' | 'content_review' | 'content_published';
  recipient_name: string;
  recipient_email: string;
  subject: string;
  body: string;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'queued' | 'sent' | 'dismissed';
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  scheduled_for: Date | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ContentLibraryVersionRow = {
  id: string;
  version: string;
  title: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'retired';
  content_request_id: string | null;
  artifact_ids: string[];
  source_metrics: Record<string, unknown>;
  review_owner: string;
  review_notes: string;
  created_by: string | null;
  created_at: Date;
  approved_at: Date | null;
  published_at: Date | null;
};

type GeneratedTrainingPackageRow = {
  id: string;
  content_request_id: string | null;
  template_id: string;
  provider: string;
  model: string;
  title: string;
  audience: string;
  duration_minutes: number;
  delivery_mode: 'in-person' | 'virtual' | 'hybrid';
  source_artifact_ids: string[];
  package_payload: ContentStudioPackage;
  review_status: 'draft' | 'review-needed' | 'approved' | 'published' | 'rejected';
  review_owner: string;
  review_notes: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  approved_at: Date | null;
  published_at: Date | null;
};

type CompletionNotificationSourceRow = {
  learner_id: string;
  first_name: string;
  last_name: string;
  email: string;
  supervisor: string | null;
  cohort_id: string;
  cohort_name: string;
  facilitator_ids: string[];
  path_id: string;
  path_title: string;
  score: number;
  confirmation_code: string;
  completed_at: Date | null;
  exported_to_lms: boolean;
};

type CompletionRecordRow = {
  id: string;
  learner_id: string | null;
  path_id: string;
  completed_module_count: number;
  required_module_count: number;
  score: number;
  pass_fail: 'pass' | 'needs-review';
  confirmation_code: string;
  completed_at: Date;
  content_version: string;
  exported_to_lms: boolean;
  exported_at: Date | null;
};

type PracticeRow = {
  id: string;
  scenario_id: string;
  response: string;
  score: number;
  label: string;
  rationale: string;
  coaching_note: string;
  confidence: string;
  source_basis: string[];
  created_at: Date;
  content_version: string;
};
