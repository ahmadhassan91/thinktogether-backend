"""phase 2 generated training package reviews

Revision ID: 011_generated_training_packages
Revises: 010_content_library_versions
Create Date: 2026-05-25
"""

from alembic import op


revision: str = "011_generated_training_packages"
down_revision: str | None = "010_content_library_versions"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS generated_training_packages (
          id TEXT PRIMARY KEY,
          content_request_id TEXT REFERENCES content_development_requests(id) ON DELETE SET NULL,
          template_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          title TEXT NOT NULL,
          audience TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
          delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('in-person', 'virtual', 'hybrid')),
          source_artifact_ids JSONB NOT NULL,
          package_payload JSONB NOT NULL,
          review_status TEXT NOT NULL CHECK (review_status IN ('draft', 'review-needed', 'approved', 'published', 'rejected')),
          review_owner TEXT NOT NULL,
          review_notes TEXT NOT NULL DEFAULT '',
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          approved_at TIMESTAMPTZ,
          published_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS generated_training_packages_request_idx
          ON generated_training_packages(content_request_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS generated_training_packages_review_idx
          ON generated_training_packages(review_status, updated_at DESC);
        """
    )
    op.execute(
        """
        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('011_generated_training_packages', 'Phase 2 generated training package reviews', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM schema_migrations WHERE id = '011_generated_training_packages';")
    op.execute("DROP TABLE IF EXISTS generated_training_packages;")
