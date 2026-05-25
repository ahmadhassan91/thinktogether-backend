"""phase 2 content library versioning

Revision ID: 010_content_library_versions
Revises: 009_notification_queue
Create Date: 2026-05-25
"""

from alembic import op


revision: str = "010_content_library_versions"
down_revision: str | None = "009_notification_queue"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS content_library_versions (
          id TEXT PRIMARY KEY,
          version TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'approved', 'published', 'retired')),
          content_request_id TEXT REFERENCES content_development_requests(id) ON DELETE SET NULL,
          artifact_ids JSONB NOT NULL,
          source_metrics JSONB NOT NULL,
          review_owner TEXT NOT NULL,
          review_notes TEXT NOT NULL DEFAULT '',
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL,
          approved_at TIMESTAMPTZ,
          published_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS content_library_versions_status_idx
          ON content_library_versions(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS content_library_versions_request_idx
          ON content_library_versions(content_request_id);
        """
    )
    op.execute(
        """
        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('010_content_library_versions', 'Phase 2 content library versioning', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM schema_migrations WHERE id = '010_content_library_versions';")
    op.execute("DROP TABLE IF EXISTS content_library_versions;")
