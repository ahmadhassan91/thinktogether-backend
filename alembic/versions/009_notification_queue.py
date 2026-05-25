"""phase 2 notification queue

Revision ID: 009_notification_queue
Revises: 008_auto_assignment_rules
Create Date: 2026-05-25
"""

from alembic import op


revision: str = "009_notification_queue"
down_revision: str | None = "008_auto_assignment_rules"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_queue (
          id UUID PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('learner_invite', 'completion_digest', 'coaching_nudge', 'makeup_review', 'content_review', 'content_published')),
          recipient_name TEXT NOT NULL,
          recipient_email TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          owner TEXT NOT NULL,
          priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
          status TEXT NOT NULL CHECK (status IN ('draft', 'queued', 'sent', 'dismissed')),
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          scheduled_for TIMESTAMPTZ,
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          UNIQUE(type, entity_type, entity_id, recipient_email)
        );

        CREATE INDEX IF NOT EXISTS notification_queue_status_priority_idx
          ON notification_queue(status, priority, updated_at DESC);
        CREATE INDEX IF NOT EXISTS notification_queue_entity_idx
          ON notification_queue(entity_type, entity_id);
        """
    )
    op.execute(
        """
        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('009_notification_queue', 'Phase 2 notification queue', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM schema_migrations WHERE id = '009_notification_queue';")
    op.execute("DROP TABLE IF EXISTS notification_queue;")
