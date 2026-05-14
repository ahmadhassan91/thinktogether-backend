import pg from 'pg';
import { randomUUID } from 'node:crypto';
import {
  CONTENT_VERSION,
  cohorts,
  learners,
  participants,
  trainingKnowledgeCheckItems,
  trainingLearningPaths,
  trainingScenarios,
} from '../src/data/trainingData';
import type { KnowledgeCheckItem, LearningPath, Module, Scenario } from '../src/types';
import { hashPassword } from './auth';

const { Pool } = pg;

export type SeedConfig = {
  adminEmail: string;
  adminPassword: string;
};

export type AppDatabase = {
  pool: pg.Pool;
  query: pg.Pool['query'];
  transaction: <T>(callback: (client: pg.PoolClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export type DatabaseOptions = {
  connectionString: string;
  seed: SeedConfig;
  reset?: boolean;
};

export async function createDatabase(options: DatabaseOptions): Promise<AppDatabase> {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const db: AppDatabase = {
    pool,
    query: pool.query.bind(pool),
    transaction: async (callback) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };

  if (options.reset) {
    await dropAll(db);
  }

  await migrate(db);
  await seedDatabase(db, options.seed);
  return db;
}

async function dropAll(db: AppDatabase) {
  await db.query(`
    DROP TABLE IF EXISTS completion_records;
    DROP TABLE IF EXISTS practice_submissions;
    DROP TABLE IF EXISTS knowledge_attempts;
    DROP TABLE IF EXISTS progress;
    DROP TABLE IF EXISTS facilitator_feedback;
    DROP TABLE IF EXISTS admin_audit_events;
    DROP TABLE IF EXISTS clearance_records;
    DROP TABLE IF EXISTS attendance_records;
    DROP TABLE IF EXISTS participants;
    DROP TABLE IF EXISTS learner_invites;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS cohorts;
    DROP TABLE IF EXISTS learners;
    DROP TABLE IF EXISTS knowledge_checks;
    DROP TABLE IF EXISTS scenarios;
    DROP TABLE IF EXISTS modules;
    DROP TABLE IF EXISTS learning_paths;
    DROP TABLE IF EXISTS schema_migrations;
  `);
}

async function migrate(db: AppDatabase) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of migrations) {
    const applied = await db.query('SELECT id FROM schema_migrations WHERE id = $1', [migration.id]);
    if (applied.rows[0]) continue;

    await db.transaction(async (client) => {
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id, name, applied_at) VALUES ($1, $2, NOW())', [
        migration.id,
        migration.name,
      ]);
    });
  }
}

const migrations = [
  {
    id: '001_foundation',
    name: 'Foundation training schema',
    sql: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'learner')),
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS learning_paths (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      audience TEXT NOT NULL,
      content_version TEXT NOT NULL,
      module_ids JSONB NOT NULL,
      source_refs JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      summary TEXT NOT NULL,
      learning_objectives JSONB NOT NULL,
      key_points JSONB NOT NULL,
      source_refs JSONB NOT NULL,
      scenario_ids JSONB NOT NULL,
      knowledge_check_item_ids JSONB NOT NULL,
      required_for_completion BOOLEAN NOT NULL,
      content_version TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS modules_path_order_idx ON modules(path_id, order_index);

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      skill_focus TEXT NOT NULL,
      expected_response_elements JSONB NOT NULL,
      source_refs JSONB NOT NULL,
      content_version TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS scenarios_module_id_idx ON scenarios(module_id);

    CREATE TABLE IF NOT EXISTS knowledge_checks (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      choices JSONB NOT NULL,
      correct_answer TEXT NOT NULL,
      rationale TEXT NOT NULL,
      source_refs JSONB NOT NULL,
      content_version TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS knowledge_checks_module_id_idx ON knowledge_checks(module_id);

    CREATE TABLE IF NOT EXISTS learners (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      cohort_id TEXT NOT NULL,
      employee_id TEXT,
      title TEXT,
      hire_date DATE,
      supervisor TEXT,
      site TEXT,
      verified_in_lms BOOLEAN NOT NULL DEFAULT false,
      exported_to_lms BOOLEAN NOT NULL DEFAULT false,
      assigned_path_ids JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cohorts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      facilitator_ids JSONB NOT NULL,
      path_ids JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learner_invites (
      id UUID PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS learner_invites_learner_id_idx ON learner_invites(learner_id);
    CREATE INDEX IF NOT EXISTS learner_invites_pending_idx
      ON learner_invites(learner_id, expires_at DESC)
      WHERE accepted_at IS NULL;

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
      learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS participants_cohort_id_idx ON participants(cohort_id);
    CREATE INDEX IF NOT EXISTS participants_learner_id_idx ON participants(learner_id);
    CREATE UNIQUE INDEX IF NOT EXISTS participants_cohort_learner_idx ON participants(cohort_id, learner_id);

    CREATE TABLE IF NOT EXISTS attendance_records (
      id UUID PRIMARY KEY,
      cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
      learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      session_date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
      recorded_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE(cohort_id, learner_id, session_date)
    );

    CREATE INDEX IF NOT EXISTS attendance_records_learner_idx ON attendance_records(learner_id);

    CREATE TABLE IF NOT EXISTS clearance_records (
      id UUID PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      clearance_type TEXT NOT NULL CHECK (clearance_type IN ('background-check', 'site-clearance', 'training-clearance')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'cleared', 'blocked')),
      updated_at TIMESTAMPTZ NOT NULL,
      notes TEXT,
      UNIQUE(learner_id, clearance_type)
    );

    CREATE INDEX IF NOT EXISTS clearance_records_status_idx ON clearance_records(status);

    CREATE TABLE IF NOT EXISTS facilitator_feedback (
      id UUID PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      facilitator_id TEXT NOT NULL,
      path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
      rating TEXT NOT NULL CHECK (rating IN ('ready', 'needs-coaching', 'not-ready')),
      score NUMERIC(3,1) NOT NULL CHECK (score >= 0 AND score <= 5),
      notes TEXT NOT NULL,
      survey_submitted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS facilitator_feedback_learner_idx ON facilitator_feedback(learner_id);

    CREATE TABLE IF NOT EXISTS progress (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
      completed_at TIMESTAMPTZ,
      content_version TEXT NOT NULL,
      UNIQUE(user_id, module_id)
    );

    CREATE INDEX IF NOT EXISTS progress_user_id_idx ON progress(user_id);

    CREATE TABLE IF NOT EXISTS knowledge_attempts (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES knowledge_checks(id) ON DELETE CASCADE,
      selected_answer TEXT NOT NULL,
      correct BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      content_version TEXT NOT NULL DEFAULT '${CONTENT_VERSION}'
    );

    CREATE INDEX IF NOT EXISTS knowledge_attempts_user_id_idx ON knowledge_attempts(user_id);

    CREATE TABLE IF NOT EXISTS practice_submissions (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
      response TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 4),
      label TEXT NOT NULL,
      rationale TEXT NOT NULL,
      coaching_note TEXT NOT NULL,
      confidence TEXT NOT NULL,
      source_basis JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      content_version TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS practice_submissions_user_created_idx
      ON practice_submissions(user_id, created_at DESC);
  `,
  },
  {
    id: '002_identity_columns',
    name: 'Learner identity and content attempt columns',
    sql: `
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS employee_id TEXT;
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS hire_date DATE;
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS supervisor TEXT;
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS site TEXT;
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS verified_in_lms BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE learners ADD COLUMN IF NOT EXISTS exported_to_lms BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS learner_id TEXT REFERENCES learners(id) ON DELETE SET NULL;
    ALTER TABLE knowledge_attempts ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT '${CONTENT_VERSION}';
    CREATE UNIQUE INDEX IF NOT EXISTS users_learner_id_unique_idx ON users(learner_id) WHERE learner_id IS NOT NULL;
  `,
  },
  {
    id: '003_completion_records',
    name: 'Durable learner completion records',
    sql: `
    CREATE TABLE IF NOT EXISTS completion_records (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      learner_id TEXT REFERENCES learners(id) ON DELETE SET NULL,
      path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
      completed_module_count INTEGER NOT NULL CHECK (completed_module_count >= 0),
      required_module_count INTEGER NOT NULL CHECK (required_module_count >= 0),
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      pass_fail TEXT NOT NULL CHECK (pass_fail IN ('pass', 'needs-review')),
      confirmation_code TEXT NOT NULL UNIQUE,
      completed_at TIMESTAMPTZ NOT NULL,
      content_version TEXT NOT NULL,
      exported_to_lms BOOLEAN NOT NULL DEFAULT false,
      exported_at TIMESTAMPTZ,
      UNIQUE(user_id, path_id)
    );

    CREATE INDEX IF NOT EXISTS completion_records_learner_idx ON completion_records(learner_id);
    CREATE INDEX IF NOT EXISTS completion_records_path_idx ON completion_records(path_id);
    CREATE INDEX IF NOT EXISTS completion_records_export_idx ON completion_records(exported_to_lms, completed_at);
  `,
  },
  {
    id: '004_invite_revocations',
    name: 'Invite revocation support',
    sql: `
    ALTER TABLE learner_invites ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS learner_invites_revoked_idx ON learner_invites(learner_id, revoked_at);
  `,
  },
  {
    id: '005_facilitator_feedback_survey_guard',
    name: 'Learner survey duplicate guard',
    sql: `
    WITH ranked_surveys AS (
      SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY learner_id, path_id ORDER BY created_at DESC, id DESC) AS row_number
      FROM facilitator_feedback
      WHERE survey_submitted
    )
    UPDATE facilitator_feedback
    SET survey_submitted = false
    FROM ranked_surveys
    WHERE facilitator_feedback.id = ranked_surveys.id
      AND ranked_surveys.row_number > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS facilitator_feedback_unique_submitted_survey_idx
      ON facilitator_feedback(learner_id, path_id)
      WHERE survey_submitted;
  `,
  },
  {
    id: '006_admin_audit_events',
    name: 'Admin audit event trail',
    sql: `
    CREATE TABLE IF NOT EXISTS admin_audit_events (
      id UUID PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS admin_audit_events_created_idx ON admin_audit_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS admin_audit_events_actor_idx ON admin_audit_events(actor_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS admin_audit_events_entity_idx ON admin_audit_events(entity_type, entity_id);
  `,
  },
] satisfies Array<{ id: string; name: string; sql: string }>;

async function seedDatabase(db: AppDatabase, seed: SeedConfig) {
  const now = new Date().toISOString();
  const adminHash = await hashPassword(seed.adminPassword);
  await db.query(
    `INSERT INTO users (id, email, name, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = EXCLUDED.role`,
    ['admin-1', seed.adminEmail.toLowerCase(), 'Think Together Admin', adminHash, 'admin', now],
  );

  for (const path of trainingLearningPaths) {
    await db.query(
      `INSERT INTO learning_paths
        (id, title, description, audience, content_version, module_ids, source_refs)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        audience = EXCLUDED.audience,
        content_version = EXCLUDED.content_version,
        module_ids = EXCLUDED.module_ids,
        source_refs = EXCLUDED.source_refs`,
      [path.id, path.title, path.description, path.audience, path.contentVersion, toJson(path.moduleIds), toJson(path.sourceRefs)],
    );

    for (const moduleItem of path.modules) {
      await db.query(
        `INSERT INTO modules
          (id, path_id, title, order_index, estimated_minutes, summary, learning_objectives,
           key_points, source_refs, scenario_ids, knowledge_check_item_ids, required_for_completion, content_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
          path_id = EXCLUDED.path_id,
          title = EXCLUDED.title,
          order_index = EXCLUDED.order_index,
          estimated_minutes = EXCLUDED.estimated_minutes,
          summary = EXCLUDED.summary,
          learning_objectives = EXCLUDED.learning_objectives,
          key_points = EXCLUDED.key_points,
          source_refs = EXCLUDED.source_refs,
          scenario_ids = EXCLUDED.scenario_ids,
          knowledge_check_item_ids = EXCLUDED.knowledge_check_item_ids,
          required_for_completion = EXCLUDED.required_for_completion,
          content_version = EXCLUDED.content_version`,
        [
          moduleItem.id,
          path.id,
          moduleItem.title,
          moduleItem.order,
          moduleItem.estimatedMinutes,
          moduleItem.content.summary,
          toJson(moduleItem.content.learningObjectives),
          toJson(moduleItem.content.keyPoints),
          toJson(moduleItem.content.sourceRefs),
          toJson(moduleItem.scenarioIds),
          toJson(moduleItem.knowledgeCheckItemIds),
          moduleItem.requiredForCompletion,
          moduleItem.content.contentVersion,
        ],
      );
    }
  }

  for (const scenario of trainingScenarios) {
    await db.query(
      `INSERT INTO scenarios
        (id, module_id, title, prompt, skill_focus, expected_response_elements, source_refs, content_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
        module_id = EXCLUDED.module_id,
        title = EXCLUDED.title,
        prompt = EXCLUDED.prompt,
        skill_focus = EXCLUDED.skill_focus,
        expected_response_elements = EXCLUDED.expected_response_elements,
        source_refs = EXCLUDED.source_refs,
        content_version = EXCLUDED.content_version`,
      [
        scenario.id,
        scenario.moduleId,
        scenario.title,
        scenario.prompt,
        scenario.skillFocus,
        toJson(scenario.expectedResponseElements),
        toJson(scenario.sourceRefs),
        scenario.contentVersion,
      ],
    );
  }

  for (const item of trainingKnowledgeCheckItems) {
    await db.query(
      `INSERT INTO knowledge_checks
        (id, module_id, prompt, choices, correct_answer, rationale, source_refs, content_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
        module_id = EXCLUDED.module_id,
        prompt = EXCLUDED.prompt,
        choices = EXCLUDED.choices,
        correct_answer = EXCLUDED.correct_answer,
        rationale = EXCLUDED.rationale,
        source_refs = EXCLUDED.source_refs,
        content_version = EXCLUDED.content_version`,
      [
        item.id,
        item.moduleId,
        item.prompt,
        toJson(item.choices),
        item.correctAnswer,
        item.rationale,
        toJson(item.sourceRefs),
        item.contentVersion,
      ],
    );
  }

  for (const cohort of cohorts) {
    await db.query(
      `INSERT INTO cohorts (id, name, region, starts_at, facilitator_ids, path_ids)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        region = EXCLUDED.region,
        starts_at = EXCLUDED.starts_at,
        facilitator_ids = EXCLUDED.facilitator_ids,
        path_ids = EXCLUDED.path_ids`,
      [cohort.id, cohort.name, cohort.region, cohort.startsAt, toJson(cohort.facilitatorIds), toJson(cohort.pathIds)],
    );
  }

  for (const learner of learners) {
    await db.query(
      `INSERT INTO learners (id, first_name, last_name, email, cohort_id, assigned_path_ids)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        cohort_id = EXCLUDED.cohort_id,
        assigned_path_ids = EXCLUDED.assigned_path_ids`,
      [
        learner.id,
        learner.firstName,
        learner.lastName,
        learner.email.toLowerCase(),
        learner.cohortId,
        toJson(learner.assignedPathIds),
      ],
    );
  }

  for (const participant of participants) {
    await db.query(
      `INSERT INTO participants (id, cohort_id, learner_id, role, joined_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
        cohort_id = EXCLUDED.cohort_id,
        learner_id = EXCLUDED.learner_id,
        role = EXCLUDED.role,
        joined_at = EXCLUDED.joined_at`,
      [participant.id, participant.cohortId, participant.learnerId, participant.role, participant.joinedAt],
    );
  }

  await seedOperationalReadiness(db);
}

async function seedOperationalReadiness(db: AppDatabase) {
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO attendance_records (id, cohort_id, learner_id, session_date, status, recorded_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (cohort_id, learner_id, session_date)
     DO UPDATE SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by`,
    [randomUUID(), 'cohort-pbis-mvp-1', 'learner-1', '2026-05-08', 'present', 'admin-1', now],
  );
  await db.query(
    `INSERT INTO clearance_records (id, learner_id, clearance_type, status, updated_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (learner_id, clearance_type)
     DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at, notes = EXCLUDED.notes`,
    [randomUUID(), 'learner-1', 'training-clearance', 'cleared', now, 'Seeded MVP pilot readiness record'],
  );
  await db.query(
    `INSERT INTO facilitator_feedback
       (id, learner_id, facilitator_id, path_id, rating, score, notes, survey_submitted, created_at)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
     WHERE NOT EXISTS (
       SELECT 1 FROM facilitator_feedback WHERE learner_id = $2 AND path_id = $4
     )`,
    [
      randomUUID(),
      'learner-1',
      'facilitator-1',
      'program-induction-pbis',
      'ready',
      4.8,
      'Ready for field practice.',
      true,
      now,
    ],
  );
}

export async function readLearningPath(db: AppDatabase, pathId: string) {
  const pathResult = await db.query('SELECT * FROM learning_paths WHERE id = $1', [pathId]);
  const row = pathResult.rows[0] as LearningPathRow | undefined;
  if (!row) return undefined;

  const moduleResult = await db.query('SELECT * FROM modules WHERE path_id = $1 ORDER BY order_index', [pathId]);
  const modules = moduleResult.rows.map((moduleRow) => mapModule(moduleRow as ModuleRow));
  const moduleIds = modules.map((moduleItem) => moduleItem.id);

  const knowledgeResult = moduleIds.length
    ? await db.query('SELECT * FROM knowledge_checks WHERE module_id = ANY($1::text[]) ORDER BY module_id, id', [moduleIds])
    : { rows: [] };
  const scenarioResult = moduleIds.length
    ? await db.query('SELECT * FROM scenarios WHERE module_id = ANY($1::text[]) ORDER BY module_id, id', [moduleIds])
    : { rows: [] };

  const path: LearningPath = {
    id: row.id,
    title: row.title,
    description: row.description,
    audience: row.audience,
    contentVersion: row.content_version,
    moduleIds: row.module_ids,
    modules,
    sourceRefs: row.source_refs,
  };

  return {
    path,
    modules,
    knowledgeChecks: knowledgeResult.rows.map((item) => mapKnowledgeCheck(item as KnowledgeRow)),
    scenarios: scenarioResult.rows.map((scenario) => mapScenario(scenario as ScenarioRow)),
  };
}

function toJson(value: unknown) {
  return JSON.stringify(value);
}

export async function readScenario(db: AppDatabase, scenarioId: string) {
  const result = await db.query('SELECT * FROM scenarios WHERE id = $1', [scenarioId]);
  const row = result.rows[0] as ScenarioRow | undefined;
  return row ? mapScenario(row) : undefined;
}

export async function readKnowledgeCheck(db: AppDatabase, itemId: string) {
  const result = await db.query('SELECT * FROM knowledge_checks WHERE id = $1', [itemId]);
  const row = result.rows[0] as KnowledgeRow | undefined;
  return row ? mapKnowledgeCheck(row) : undefined;
}

function mapModule(row: ModuleRow): Module {
  return {
    id: row.id,
    title: row.title,
    order: row.order_index,
    estimatedMinutes: row.estimated_minutes,
    content: {
      moduleId: row.id,
      contentVersion: row.content_version,
      summary: row.summary,
      learningObjectives: row.learning_objectives,
      keyPoints: row.key_points,
      sourceRefs: row.source_refs,
    },
    scenarioIds: row.scenario_ids,
    knowledgeCheckItemIds: row.knowledge_check_item_ids,
    requiredForCompletion: row.required_for_completion,
  };
}

function mapScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    prompt: row.prompt,
    skillFocus: row.skill_focus,
    expectedResponseElements: row.expected_response_elements,
    sourceRefs: row.source_refs,
    contentVersion: row.content_version,
  };
}

function mapKnowledgeCheck(row: KnowledgeRow): KnowledgeCheckItem {
  return {
    id: row.id,
    moduleId: row.module_id,
    prompt: row.prompt,
    choices: row.choices,
    correctAnswer: row.correct_answer,
    rationale: row.rationale,
    sourceRefs: row.source_refs,
    contentVersion: row.content_version,
  };
}

export { CONTENT_VERSION };

type LearningPathRow = {
  id: string;
  title: string;
  description: string;
  audience: string;
  content_version: string;
  module_ids: string[];
  source_refs: LearningPath['sourceRefs'];
};

type ModuleRow = {
  id: string;
  title: string;
  order_index: number;
  estimated_minutes: number;
  summary: string;
  learning_objectives: string[];
  key_points: string[];
  source_refs: Module['content']['sourceRefs'];
  scenario_ids: string[];
  knowledge_check_item_ids: string[];
  required_for_completion: boolean;
  content_version: string;
};

type ScenarioRow = {
  id: string;
  module_id: string;
  title: string;
  prompt: string;
  skill_focus: string;
  expected_response_elements: string[];
  source_refs: Scenario['sourceRefs'];
  content_version: string;
};

type KnowledgeRow = {
  id: string;
  module_id: string;
  prompt: string;
  choices: string[];
  correct_answer: string;
  rationale: string;
  source_refs: KnowledgeCheckItem['sourceRefs'];
  content_version: string;
};
