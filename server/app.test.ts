import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
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
    expect(dashboard.body.readinessByTrack).toEqual([
      expect.objectContaining({
        track: 'Program Induction - PBIS',
        enrolled: 1,
        clearanceReady: 1,
      }),
    ]);
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
