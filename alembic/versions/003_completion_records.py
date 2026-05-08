"""Durable learner completion records.

Revision ID: 003_completion_records
Revises: 002_identity_columns
Create Date: 2026-05-08 00:02:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "003_completion_records"
down_revision: Union[str, Sequence[str], None] = "002_identity_columns"
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

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('003_completion_records', 'Durable learner completion records', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    run_many(
        """
        DELETE FROM schema_migrations WHERE id = '003_completion_records';
        DROP TABLE IF EXISTS completion_records;
        """
    )
