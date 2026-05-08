"""Invite revocation support.

Revision ID: 004_invite_revocations
Revises: 003_completion_records
Create Date: 2026-05-08 00:03:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "004_invite_revocations"
down_revision: Union[str, Sequence[str], None] = "003_completion_records"
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
        ALTER TABLE learner_invites ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS learner_invites_revoked_idx ON learner_invites(learner_id, revoked_at);

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('004_invite_revocations', 'Invite revocation support', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    run_many(
        """
        DELETE FROM schema_migrations WHERE id = '004_invite_revocations';
        DROP INDEX IF EXISTS learner_invites_revoked_idx;
        ALTER TABLE learner_invites DROP COLUMN IF EXISTS revoked_at;
        """
    )
