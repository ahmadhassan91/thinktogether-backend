import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type AppHandle } from './app';
import { hashToken } from './auth';

const seed = {
  adminEmail: 'admin@thinktogether.local',
  adminPassword: 'ThinkTogether!2026',
};

async function boot() {
  return createApp({
    databaseUrl: process.env.TEST_DATABASE_URL ?? 'postgresql:///think_training_mvp_test',
    seed,
    corsOrigin: 'http://localhost:5173',
    sessionTtlHours: 8,
    resetDatabase: true,
  });
}

describe('Think Together training API', () => {
  let handle: AppHandle | undefined;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it('protects admin data behind authenticated admin sessions', async () => {
    handle = await boot();

    await request(handle.app).get('/api/admin/dashboard').expect(401);
    await request(handle.app).get('/api/admin/learners').expect(401);
    await request(handle.app).post('/api/admin/learners').send({}).expect(401);
    await request(handle.app).get('/api/admin/cohorts').expect(401);
    await request(handle.app).post('/api/admin/cohorts').send({}).expect(401);
    await request(handle.app).get('/api/admin/audit-events').expect(401);
    await request(handle.app).get('/api/admin/source-intelligence/summary').expect(401);
    await request(handle.app).post('/api/surveys/training').send({}).expect(401);

    const login = await request(handle.app)
      .post('/api/auth/login')
      .send({ email: seed.adminEmail, password: seed.adminPassword })
      .expect(200);

    expect(login.body.user.role).toBe('admin');
    expect(login.body.token).toEqual(expect.any(String));

    const dashboard = await request(handle.app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(dashboard.body.kpis.totalLearners).toBeGreaterThan(0);
    expect(dashboard.body.readinessByTrack).toEqual(expect.any(Array));

    const sourceSummary = await request(handle.app)
      .get('/api/admin/source-intelligence/summary')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(sourceSummary.body.totals.artifacts).toBeGreaterThanOrEqual(6);
    expect(sourceSummary.body.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifact: expect.objectContaining({ artifact: 'PBIS PPT Master.pptx' }),
          totalReferences: expect.any(Number),
        }),
      ]),
    );
  });

  it('lists and creates admin-managed learner records', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const initial = await request(handle.app)
      .get('/api/admin/learners')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(initial.body.learners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'learner-1',
          firstName: 'Maya',
          lastName: 'Rivera',
          email: 'maya.rivera@example.org',
          cohortId: 'cohort-pbis-mvp-1',
          cohortName: 'PBIS MVP Pilot',
          region: 'Emerging Region',
          assignedPathIds: ['program-induction-pbis'],
          inviteStatus: 'not_sent',
        }),
      ]),
    );

    const created = await request(handle.app)
      .post('/api/admin/learners')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Jordan',
        lastName: 'Lee',
        email: 'Jordan.Lee@Example.org',
        cohortId: 'cohort-pbis-mvp-1',
        assignedPathIds: ['program-induction-pbis'],
      })
      .expect(201);

    expect(created.body.learner).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        firstName: 'Jordan',
        lastName: 'Lee',
        email: 'jordan.lee@example.org',
        cohortId: 'cohort-pbis-mvp-1',
        cohortName: 'PBIS MVP Pilot',
        region: 'Emerging Region',
        assignedPathIds: ['program-induction-pbis'],
      }),
    );

    const afterCreate = await request(handle.app)
      .get('/api/admin/learners')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterCreate.body.learners.map((learner: { email: string }) => learner.email)).toContain(
      'jordan.lee@example.org',
    );

    const auditEvents = await request(handle.app)
      .get('/api/admin/audit-events')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(auditEvents.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'learner.created',
          entityType: 'learner',
          entityId: created.body.learner.id,
          metadata: expect.objectContaining({ email: 'jordan.lee@example.org' }),
        }),
      ]),
    );

    await request(handle.app)
      .post('/api/admin/learners')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Duplicate',
        lastName: 'Lee',
        email: 'jordan.lee@example.org',
        cohortId: 'cohort-pbis-mvp-1',
        assignedPathIds: ['program-induction-pbis'],
      })
      .expect(409);
  });

  it('surfaces source intelligence search and QA flags for shared artifacts', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const search = await request(handle.app)
      .get('/api/admin/source-intelligence/search')
      .query({ query: '10:2 practice PBIS' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(search.body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifact: expect.objectContaining({ artifact: expect.any(String) }),
          excerpt: expect.any(String),
          relevanceScore: expect.any(Number),
        }),
      ]),
    );

    const qaFlags = await request(handle.app)
      .get('/api/admin/source-intelligence/qa-flags')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(qaFlags.body.modulesWithNoSourceRefs).toEqual([]);
    expect(qaFlags.body.sourceRefsWithoutLibraryArtifact).toEqual([]);
  });

  it('creates and accepts learner invites without storing plaintext tokens', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);

    const invite = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const inviteToken = invite.body.invite.inviteToken;
    expect(inviteToken).toEqual(expect.any(String));
    expect(invite.body.invite.inviteStatus).toBe('pending');
    expect(invite.body.invite.inviteUrl).toContain(`?invite=${encodeURIComponent(inviteToken)}`);
    expect(invite.body.learner.id).toBe('learner-1');
    expect(invite.body.learner.inviteStatus).toBe('pending');

    const inviteRows = await handle.db.query('SELECT token_hash, accepted_at FROM learner_invites WHERE learner_id = $1', [
      'learner-1',
    ]);
    expect(inviteRows.rows).toHaveLength(1);
    expect(inviteRows.rows[0].token_hash).toBe(hashToken(inviteToken));
    expect(inviteRows.rows[0].token_hash).not.toBe(inviteToken);
    expect(inviteRows.rows[0].accepted_at).toBeNull();

    const pending = await request(handle.app)
      .get('/api/admin/learners')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pending.body.learners.find((learner: { id: string }) => learner.id === 'learner-1').inviteStatus).toBe(
      'pending',
    );

    const accepted = await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'LearnerPass!2026' })
      .expect(201);

    expect(accepted.body.token).toEqual(expect.any(String));
    expect(accepted.body.user).toEqual(
      expect.objectContaining({
        email: 'maya.rivera@example.org',
        role: 'learner',
        learnerId: 'learner-1',
      }),
    );
    expect(accepted.body.learner).toEqual(expect.objectContaining({ id: 'learner-1' }));

    await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'LearnerPass!2026' })
      .expect(400);

    const me = await request(handle.app)
      .get('/api/me')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .expect(200);
    expect(me.body.user.learnerId).toBe('learner-1');
    expect(me.body.learner).toEqual(expect.objectContaining({ id: 'learner-1' }));

    const afterAccept = await request(handle.app)
      .get('/api/admin/learners')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterAccept.body.learners.find((learner: { id: string }) => learner.id === 'learner-1').inviteStatus).toBe(
      'accepted',
    );
  });

  it('revokes pending learner invites and blocks revoked token acceptance', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);

    const invite = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const revoked = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(revoked.body.learner.inviteStatus).toBe('revoked');

    await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(400);

    const learners = await request(handle.app)
      .get('/api/admin/learners')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(learners.body.learners.find((learner: { id: string }) => learner.id === 'learner-1').inviteStatus).toBe(
      'revoked',
    );
  });

  it('resends learner invites by revoking previous pending tokens', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);

    const first = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const second = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(second.body.invite.inviteToken).not.toBe(first.body.invite.inviteToken);

    await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: first.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(400);

    await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: second.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(201);
  });

  it('rate limits repeated authentication attempts per credential target', async () => {
    handle = await boot();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(handle.app)
        .post('/api/auth/login')
        .send({ email: seed.adminEmail, password: 'WrongPass!2026' })
        .expect(401);
    }

    await request(handle.app)
      .post('/api/auth/login')
      .send({ email: seed.adminEmail, password: 'WrongPass!2026' })
      .expect(429);
  });

  it('keeps learner-role sessions out of admin endpoints', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);
    const invite = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const accepted = await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(201);

    await request(handle.app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .expect(403);
    await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .expect(403);
    await request(handle.app)
      .post('/api/surveys/training')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pathId: 'program-induction-pbis', score: 4, notes: 'Clear facilitation.' })
      .expect(403);
  });

  it('accepts one learner training survey and includes it in admin reporting metrics', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);

    const created = await request(handle.app)
      .post('/api/admin/learners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Sam',
        lastName: 'Patel',
        email: 'sam.patel@example.org',
        cohortId: 'cohort-pbis-mvp-1',
        assignedPathIds: ['program-induction-pbis'],
      })
      .expect(201);

    const beforeSurvey = await request(handle.app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(beforeSurvey.body.kpis.surveyCompletion).toBe(50);
    expect(beforeSurvey.body.kpis.facilitatorRating).toBe(4.8);

    const invite = await request(handle.app)
      .post(`/api/admin/learners/${created.body.learner.id}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const accepted = await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(201);

    const survey = await request(handle.app)
      .post('/api/surveys/training')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .send({
        pathId: 'program-induction-pbis',
        facilitatorId: 'facilitator-1',
        score: 3.5,
        notes: 'The facilitator connected PBIS practice to real site routines.',
      })
      .expect(201);

    expect(survey.body.survey).toEqual(
      expect.objectContaining({
        learnerId: created.body.learner.id,
        facilitatorId: 'facilitator-1',
        pathId: 'program-induction-pbis',
        rating: 'needs-coaching',
        score: 3.5,
        notes: 'The facilitator connected PBIS practice to real site routines.',
        surveySubmitted: true,
      }),
    );

    const rows = await handle.db.query(
      `SELECT learner_id, facilitator_id, path_id, rating, score::float, notes, survey_submitted
       FROM facilitator_feedback
       WHERE learner_id = $1 AND path_id = $2`,
      [created.body.learner.id, 'program-induction-pbis'],
    );
    expect(rows.rows).toEqual([
      expect.objectContaining({
        learner_id: created.body.learner.id,
        facilitator_id: 'facilitator-1',
        path_id: 'program-induction-pbis',
        rating: 'needs-coaching',
        score: 3.5,
        survey_submitted: true,
      }),
    ]);

    await request(handle.app)
      .post('/api/surveys/training')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .send({ pathId: 'program-induction-pbis', facilitatorId: 'facilitator-1', score: 5, notes: 'Duplicate.' })
      .expect(409);

    const afterSurvey = await request(handle.app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterSurvey.body.kpis).toEqual(
      expect.objectContaining({
        totalLearners: 2,
        surveyCompletion: 100,
        facilitatorRating: 4.2,
      }),
    );
  });

  it('binds progress records to the accepted learner user', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);
    const invite = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const accepted = await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(201);

    const path = await request(handle.app)
      .get('/api/learning-paths/program-induction-pbis')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .expect(200);
    const moduleId = path.body.modules[0].id;

    await request(handle.app)
      .post('/api/progress/module-complete')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .send({ moduleId })
      .expect(200);

    const progressRows = await handle.db.query(
      `SELECT p.user_id, u.learner_id
       FROM progress p
       JOIN users u ON u.id = p.user_id
       WHERE p.module_id = $1`,
      [moduleId],
    );
    expect(progressRows.rows).toEqual([
      expect.objectContaining({
        user_id: accepted.body.user.id,
        learner_id: 'learner-1',
      }),
    ]);
  });

  it('persists completion records and exports completion evidence', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);
    const invite = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const accepted = await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(201);

    const path = await request(handle.app)
      .get('/api/learning-paths/program-induction-pbis')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .expect(200);
    const requiredModules = path.body.modules.filter((module: { requiredForCompletion: boolean }) => module.requiredForCompletion);

    for (const module of requiredModules) {
      await request(handle.app)
        .post('/api/progress/module-complete')
        .set('Authorization', `Bearer ${accepted.body.token}`)
        .send({ moduleId: module.id })
        .expect(200);
    }

    const completionRows = await handle.db.query('SELECT * FROM completion_records WHERE learner_id = $1', ['learner-1']);
    expect(completionRows.rows).toHaveLength(1);
    expect(completionRows.rows[0]).toEqual(
      expect.objectContaining({
        learner_id: 'learner-1',
        path_id: 'program-induction-pbis',
        completed_module_count: requiredModules.length,
        required_module_count: requiredModules.length,
        score: 100,
        pass_fail: 'pass',
        content_version: 'pbis-mvp-2026-05-08',
      }),
    );

    const completionExport = await request(handle.app)
      .get('/api/admin/exports/completions.csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(completionExport.headers['content-type']).toContain('text/csv');
    expect(completionExport.headers['content-disposition']).toContain('think-completion-export.csv');
    expect(completionExport.text).toContain('generated_at,content_version,learner_id');
    expect(completionExport.text).toContain('learner-1');
    expect(completionExport.text).toContain('PBIS-learner-1-');
  });

  it('blocks learner access to paths and modules outside their assignment', async () => {
    handle = await boot();
    const adminToken = await loginToken(handle);
    const invite = await request(handle.app)
      .post('/api/admin/learners/learner-1/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const accepted = await request(handle.app)
      .post('/api/auth/accept-invite')
      .send({ token: invite.body.invite.inviteToken, password: 'LearnerPass!2026' })
      .expect(201);

    const path = await request(handle.app)
      .get('/api/learning-paths/program-induction-pbis')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const moduleId = path.body.modules[0].id;
    const knowledgeItemId = path.body.modules[0].knowledgeCheckItemIds[0];
    const scenarioModule = path.body.modules.find((module: { scenarioIds: string[] }) => module.scenarioIds.length > 0);
    const scenarioId = scenarioModule.scenarioIds[0];

    await handle.db.query("UPDATE learners SET assigned_path_ids = '[]'::jsonb WHERE id = $1", ['learner-1']);

    await request(handle.app)
      .get('/api/learning-paths/program-induction-pbis')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .expect(403);
    await request(handle.app)
      .post('/api/progress/module-complete')
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .send({ moduleId })
      .expect(403);
    await request(handle.app)
      .post(`/api/knowledge-checks/${knowledgeItemId}/answer`)
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .send({ selectedAnswer: 'Consistent support' })
      .expect(403);
    await request(handle.app)
      .post(`/api/scenarios/${scenarioId}/score`)
      .set('Authorization', `Bearer ${accepted.body.token}`)
      .send({ response: 'I would use restorative language and document the behavior with the SPM for safety.' })
      .expect(403);

    await request(handle.app)
      .get('/api/learning-paths/program-induction-pbis')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('reports operational readiness from attendance, clearance, and learner records', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const dashboard = await request(handle.app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.kpis).toEqual(
      expect.objectContaining({
        totalLearners: 1,
        attended: 1,
        clearanceReady: 1,
        blocked: 0,
        makeupRequired: 0,
        averageKnowledgeScore: 0,
        surveyCompletion: 100,
        facilitatorRating: 4.8,
      }),
    );
    expect(dashboard.body.readinessByTrack).toEqual(expect.arrayContaining([
      expect.objectContaining({
        track: 'Program Induction - PBIS',
        enrolled: 1,
        clearanceReady: 1,
      }),
      expect.objectContaining({
        track: 'Site Lead Onboarding v0',
        enrolled: 0,
      }),
    ]));
  });

  it('tracks applied database migrations and exports clearance handoff fields', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const migrations = await handle.db.query('SELECT id, name FROM schema_migrations ORDER BY id');
    expect(migrations.rows).toEqual([
      { id: '001_foundation', name: 'Foundation training schema' },
      { id: '002_identity_columns', name: 'Learner identity and content attempt columns' },
      { id: '003_completion_records', name: 'Durable learner completion records' },
      { id: '004_invite_revocations', name: 'Invite revocation support' },
      { id: '005_feedback_guard', name: 'Learner survey duplicate guard' },
      { id: '006_admin_audit', name: 'Admin audit event trail' },
    ]);

    const clearanceExport = await request(handle.app)
      .get('/api/admin/exports/clearance.csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(clearanceExport.headers['content-type']).toContain('text/csv');
    expect(clearanceExport.headers['content-disposition']).toContain('think-clearance-export.csv');
    expect(clearanceExport.text).toContain('generated_at,content_version,id,first_name,last_name,email');
    expect(clearanceExport.text).toContain('training_clearance_status');
    expect(clearanceExport.text).toContain('maya.rivera@example.org');

    const emptyCompletionExport = await request(handle.app)
      .get('/api/admin/exports/completions.csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(emptyCompletionExport.text).toBe(
      'generated_at,content_version,learner_id,first_name,last_name,email,cohort_name,region,learning_path,completed_module_count,required_module_count,score,pass_fail,confirmation_code,completed_at,exported_to_lms,exported_at,average_knowledge_score,practice_submissions,invite_status\n',
    );
  });

  it('lists and creates admin-managed cohorts', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const initial = await request(handle.app)
      .get('/api/admin/cohorts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(initial.body.cohorts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cohort-pbis-mvp-1',
          name: 'PBIS MVP Pilot',
          region: 'Emerging Region',
          startsAt: '2026-05-08T09:00:00.000Z',
          facilitatorIds: ['facilitator-1'],
          pathIds: ['program-induction-pbis'],
          learnerCount: 1,
        }),
      ]),
    );

    const created = await request(handle.app)
      .post('/api/admin/cohorts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Program Induction June',
        region: 'Bay Area',
        startsAt: '2026-06-12T16:00:00.000Z',
        facilitatorIds: ['facilitator-2'],
        pathIds: ['program-induction-pbis'],
      })
      .expect(201);

    expect(created.body.cohort).toEqual({
      id: expect.any(String),
      name: 'Program Induction June',
      region: 'Bay Area',
      startsAt: '2026-06-12T16:00:00.000Z',
      facilitatorIds: ['facilitator-2'],
      pathIds: ['program-induction-pbis'],
      learnerCount: 0,
    });

    const afterCreate = await request(handle.app)
      .get('/api/admin/cohorts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterCreate.body.cohorts.map((cohort: { name: string }) => cohort.name)).toContain('Program Induction June');
  });

  it('serves seeded training content from the database', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const res = await request(handle.app)
      .get('/api/learning-paths/program-induction-pbis')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.path.title).toContain('Program Induction');
    expect(res.body.modules.length).toBeGreaterThanOrEqual(3);
    expect(res.body.knowledgeChecks.length).toBeGreaterThan(0);
    expect(res.body.scenarios.length).toBeGreaterThan(0);
  });

  it('answers knowledge assistant questions with source-backed evidence', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const response = await request(handle.app)
      .post('/api/knowledge-assistant/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is the main purpose of PBIS in Program Induction?' })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('Teach and reinforce expected behavior proactively'),
        confidence: 'Source-backed',
        status: 'answered',
      }),
    );
    expect(response.body.sourceBasis).toEqual(expect.arrayContaining([expect.stringContaining('PBIS PPT Master.pptx')]));
  });

  it('returns not found when knowledge assistant evidence is weak', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const response = await request(handle.app)
      .post('/api/knowledge-assistant/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What does the district-specific suspension policy require?' })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        answer: 'Not found in the provided Think Together materials.',
        confidence: 'Not found in provided sources',
        sourceBasis: [],
        status: 'not_found',
      }),
    );
  });

  it('generates a source-grounded AI deck outline for admins', async () => {
    handle = await boot();
    const token = await loginToken(handle);
    const previousGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const deckJson = {
      title: 'Effective Lesson Delivery',
      audience: 'Think Together program staff',
      durationMinutes: 45,
      learningObjectives: ['Practice a 10:2 delivery rhythm'],
      slides: [
        {
          title: 'Open with the why',
          objective: 'Connect PBIS to program culture.',
          talkingPoints: ['Name the expectation', 'Model the routine', 'Invite practice'],
          activityPrompt: 'Pair-share one attention getter.',
          facilitatorNotes: 'Keep examples site-specific.',
          sourceRefs: [{ artifact: 'PBIS PPT Master.pptx', locator: 'Slide 4: PBIS objectives' }],
        },
        {
          title: 'Practice the move',
          objective: 'Apply the expected behavior routine.',
          talkingPoints: ['Use concise language', 'Observe response', 'Reinforce quickly'],
          activityPrompt: 'Run a two-minute practice round.',
          facilitatorNotes: 'Debrief with one strength and one adjustment.',
          sourceRefs: [{ artifact: 'SOP_Program Induction.pdf', locator: 'Pages 4-6: facilitation' }],
        },
      ],
      handoffNotes: ['Trainer should review source alignment before export.'],
    };
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          modelVersion: 'gemini-test',
          candidates: [{ content: { parts: [{ text: JSON.stringify(deckJson) }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const response = await request(handle.app)
        .post('/api/ai/deck-outline')
        .set('Authorization', `Bearer ${token}`)
        .send({
          provider: 'gemini',
          topic: 'Effective lesson delivery with 10:2 practice',
          audience: 'Program leaders',
          durationMinutes: 45,
          slideCount: 6,
        })
        .expect(201);

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('generativelanguage.googleapis.com'), expect.any(Object));
      expect(response.body.outline).toEqual(
        expect.objectContaining({
          provider: 'gemini',
          model: 'gemini-test',
          title: 'Effective Lesson Delivery',
          sourceArtifacts: expect.arrayContaining(['PBIS PPT Master.pptx', 'SOP_Program Induction.pdf']),
        }),
      );
      expect(response.body.outline.slides[0].sourceRefs[0].artifact).toBe('PBIS PPT Master.pptx');
    } finally {
      if (previousGeminiKey) process.env.GEMINI_API_KEY = previousGeminiKey;
      else delete process.env.GEMINI_API_KEY;
      vi.unstubAllGlobals();
    }
  });

  it('exports a branded AI-generated PowerPoint for admins', async () => {
    handle = await boot();
    const token = await loginToken(handle);
    const previousGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const deckJson = {
      title: 'PBIS Practice Lab',
      audience: 'Program leaders',
      durationMinutes: 45,
      learningObjectives: ['Practice proactive facilitation'],
      slides: [
        {
          title: 'Set the expectation',
          objective: 'Use explicit PBIS language.',
          layout: 'process',
          talkingPoints: ['Name the routine', 'Model it', 'Practice it'],
          activityPrompt: 'Practice a transition script.',
          facilitatorNotes: 'Keep language positive and observable.',
          sourceRefs: [{ artifact: 'PBIS PPT Master.pptx', locator: 'Slides 27-30' }],
        },
        {
          title: 'Acknowledge behavior',
          objective: 'Reinforce the expected behavior.',
          layout: 'matrix',
          talkingPoints: ['Notice quickly', 'Name the behavior', 'Connect to safety'],
          activityPrompt: 'Write one behavior-specific praise statement.',
          facilitatorNotes: 'Avoid generic praise.',
          sourceRefs: [{ artifact: 'PBIS part 3 PPT Template.pptx', locator: 'Slide 14' }],
        },
      ],
      handoffNotes: ['Review before delivery.'],
    };
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(
        JSON.stringify({
          modelVersion: 'gemini-test',
          candidates: [{ content: { parts: [{ text: JSON.stringify(deckJson) }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ));

    try {
      const response = await request(handle.app)
        .post('/api/ai/deck-pptx')
        .set('Authorization', `Bearer ${token}`)
        .send({
          provider: 'gemini',
          topic: 'PBIS practice lab for program leaders',
          audience: 'Program leaders',
          durationMinutes: 45,
          slideCount: 4,
        })
        .expect(201);

      expect(response.headers['content-type']).toContain('presentationml.presentation');
      expect(response.headers['content-disposition']).toContain('pbis-practice-lab.pptx');
      expect(Number(response.headers['content-length'])).toBeGreaterThan(5000);
    } finally {
      if (previousGeminiKey) process.env.GEMINI_API_KEY = previousGeminiKey;
      else delete process.env.GEMINI_API_KEY;
      vi.unstubAllGlobals();
    }
  });

  it('persists learner progress and scenario submissions', async () => {
    handle = await boot();
    const token = await loginToken(handle);

    const path = await request(handle.app)
      .get('/api/learning-paths/program-induction-pbis')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const moduleId = path.body.modules[0].id;
    const scenarioId = path.body.scenarios[0].id;
    const knowledgeCheck = path.body.knowledgeChecks[0];

    await request(handle.app)
      .post(`/api/knowledge-checks/${knowledgeCheck.id}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedAnswer: knowledgeCheck.correctAnswer })
      .expect(200);

    await request(handle.app)
      .post('/api/progress/module-complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ moduleId })
      .expect(200);

    const scored = await request(handle.app)
      .post(`/api/scenarios/${scenarioId}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        response:
          'I would greet the student calmly, name the expected behavior, offer a positive choice, and document any follow-up for the site lead.',
      })
      .expect(200);

    expect(scored.body.score).toBeGreaterThan(0);
    expect(scored.body.sourceBasis.length).toBeGreaterThan(0);

    const progress = await request(handle.app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(progress.body.completedModuleIds).toContain(moduleId);
    expect(progress.body.practiceSubmissions[0].scenarioId).toBe(scenarioId);

    const attemptRows = await handle.db.query('SELECT content_version FROM knowledge_attempts');
    expect(attemptRows.rows.every((row: { content_version: string }) => row.content_version)).toBe(true);
  });
});

async function loginToken(handle: AppHandle) {
  const login = await request(handle.app)
    .post('/api/auth/login')
    .send({ email: seed.adminEmail, password: seed.adminPassword })
    .expect(200);
  return login.body.token as string;
}
