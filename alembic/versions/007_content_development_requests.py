"""phase 2 content development requests

Revision ID: 007_content_development_requests
Revises: 006_admin_audit
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_content_development_requests"
down_revision: Union[str, None] = "006_admin_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS content_development_requests (
          id TEXT PRIMARY KEY,
          request TEXT NOT NULL,
          audience TEXT NOT NULL,
          delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('in-person', 'virtual', 'hybrid')),
          status TEXT NOT NULL CHECK (status IN ('intake', 'source-mapped', 'draft-ready', 'review-needed', 'approved', 'published')),
          artifacts_needed JSONB NOT NULL,
          outputs JSONB NOT NULL,
          review_owner TEXT NOT NULL,
          review_notes TEXT NOT NULL DEFAULT '',
          requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          approved_at TIMESTAMPTZ,
          published_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS content_development_requests_status_idx
          ON content_development_requests(status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS content_development_requests_requested_by_idx
          ON content_development_requests(requested_by, created_at DESC);

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('007_content_development_requests', 'Phase 2 content development requests', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM schema_migrations WHERE id = '007_content_development_requests';
        DROP TABLE IF EXISTS content_development_requests;
        """
    )
