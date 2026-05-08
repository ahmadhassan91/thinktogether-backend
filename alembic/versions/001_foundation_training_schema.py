"""Foundation training schema.

Revision ID: 001_foundation
Revises:
Create Date: 2026-05-08 00:00:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "001_foundation"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def run_many(sql: str) -> None:
    for statement in sql.split(";"):
        statement = statement.strip()
        if statement:
            op.execute(statement)


def upgrade() -> None:
    run_many(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

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
          content_version TEXT NOT NULL DEFAULT 'pbis-mvp-2026-05-08'
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

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('001_foundation', 'Foundation training schema', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    run_many(
        """
        DELETE FROM schema_migrations WHERE id = '001_foundation';
        DROP TABLE IF EXISTS practice_submissions;
        DROP TABLE IF EXISTS knowledge_attempts;
        DROP TABLE IF EXISTS progress;
        DROP TABLE IF EXISTS facilitator_feedback;
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
        """
    )
