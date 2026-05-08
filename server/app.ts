import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { scoreScenarioResponse } from '../src/features/coach/coachEngine';
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

const scenarioScoreSchema = z.object({
  response: z.string().min(20).max(4000),
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

  app.get('/api/admin/learners', authenticate, requireAdmin, async (_req, res) => {
    const result = await db.query(adminLearnersQuery());
    res.json({ learners: (result.rows as AdminLearnerRow[]).map(mapAdminLearner) });
  });

  app.post('/api/admin/learners', authenticate, requireAdmin, async (req, res) => {
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

    res.json({ learner: { ...learner, inviteStatus: 'revoked' } });
  });

  app.get('/api/admin/cohorts', authenticate, requireAdmin, async (_req, res) => {
    const result = await db.query(adminCohortsQuery());
    res.json({ cohorts: (result.rows as AdminCohortRow[]).map(mapAdminCohort) });
  });

  app.post('/api/admin/cohorts', authenticate, requireAdmin, async (req, res) => {
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
    feedback AS (
      SELECT
        COALESCE(ROUND(AVG(score)::numeric, 1), 0)::float AS facilitator_rating,
        COALESCE(ROUND((COUNT(*) FILTER (WHERE survey_submitted)::numeric / NULLIF(COUNT(*), 0)) * 100)::int, 0)
          AS survey_completion
      FROM facilitator_feedback
    ),
    completed AS (
      SELECT COUNT(*)::int AS completed_modules FROM progress WHERE status = 'completed'
    ),
    practice AS (
      SELECT COUNT(*)::int AS practice_submissions FROM practice_submissions
    ),
    module_count AS (
      SELECT COUNT(*)::int AS modules FROM modules
    )
    SELECT *
    FROM learner_count, attendance, clearance, attempts, feedback, completed, practice, module_count
  `);
  const row = result.rows[0] as AdminKpiRow;
  const completionRate = row.modules > 0 ? Math.round((row.completed_modules / row.modules) * 100) : 0;
  return {
    totalLearners: row.total_learners,
    attended: row.attended ?? 0,
    completedModules: row.completed_modules,
    clearanceReady: row.clearance_ready ?? 0,
    blocked: row.blocked ?? 0,
    makeupRequired: row.makeup_required ?? 0,
    averageKnowledgeScore: row.average_knowledge_score,
    surveyCompletion: row.survey_completion,
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

type AdminCohortRow = {
  id: string;
  name: string;
  region: string;
  starts_at: Date;
  facilitator_ids: string[];
  path_ids: string[];
  learner_count: number | string;
};

type AdminKpiRow = {
  total_learners: number;
  attended: number | null;
  makeup_required: number | null;
  clearance_ready: number | null;
  blocked: number | null;
  average_knowledge_score: number;
  facilitator_rating: number;
  survey_completion: number;
  completed_modules: number;
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
