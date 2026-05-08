"""Learner identity and content attempt columns.

Revision ID: 002_identity_columns
Revises: 001_foundation
Create Date: 2026-05-08 00:01:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "002_identity_columns"
down_revision: Union[str, Sequence[str], None] = "001_foundation"
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
        ALTER TABLE learners ADD COLUMN IF NOT EXISTS employee_id TEXT;
        ALTER TABLE learners ADD COLUMN IF NOT EXISTS title TEXT;
        ALTER TABLE learners ADD COLUMN IF NOT EXISTS hire_date DATE;
        ALTER TABLE learners ADD COLUMN IF NOT EXISTS supervisor TEXT;
        ALTER TABLE learners ADD COLUMN IF NOT EXISTS site TEXT;
        ALTER TABLE learners ADD COLUMN IF NOT EXISTS verified_in_lms BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE learners ADD COLUMN IF NOT EXISTS exported_to_lms BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS learner_id TEXT REFERENCES learners(id) ON DELETE SET NULL;
        ALTER TABLE knowledge_attempts ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT 'pbis-mvp-2026-05-08';
        CREATE UNIQUE INDEX IF NOT EXISTS users_learner_id_unique_idx ON users(learner_id) WHERE learner_id IS NOT NULL;

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('002_identity_columns', 'Learner identity and content attempt columns', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    run_many(
        """
        DELETE FROM schema_migrations WHERE id = '002_identity_columns';
        DROP INDEX IF EXISTS users_learner_id_unique_idx;
        ALTER TABLE users DROP COLUMN IF EXISTS learner_id;
        ALTER TABLE learners DROP COLUMN IF EXISTS exported_to_lms;
        ALTER TABLE learners DROP COLUMN IF EXISTS verified_in_lms;
        ALTER TABLE learners DROP COLUMN IF EXISTS site;
        ALTER TABLE learners DROP COLUMN IF EXISTS supervisor;
        ALTER TABLE learners DROP COLUMN IF EXISTS hire_date;
        ALTER TABLE learners DROP COLUMN IF EXISTS title;
        ALTER TABLE learners DROP COLUMN IF EXISTS employee_id;
        """
    )
