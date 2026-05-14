"""admin audit event trail

Revision ID: 006_admin_audit_events
Revises: 005_facilitator_feedback_survey_guard
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op

revision: str = "006_admin_audit_events"
down_revision: Union[str, None] = "005_facilitator_feedback_survey_guard"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
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

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('006_admin_audit_events', 'Admin audit event trail', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM schema_migrations WHERE id = '006_admin_audit_events';
        DROP TABLE IF EXISTS admin_audit_events;
        """
    )
