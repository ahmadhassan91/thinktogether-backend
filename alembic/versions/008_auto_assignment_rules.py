"""phase 2 auto-assignment rules

Revision ID: 008_auto_assignment_rules
Revises: 007_content_development_requests
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "008_auto_assignment_rules"
down_revision: Union[str, None] = "007_content_development_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS auto_assignment_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          priority INTEGER NOT NULL CHECK (priority >= 0),
          active BOOLEAN NOT NULL DEFAULT true,
          match_criteria JSONB NOT NULL,
          cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
          path_ids JSONB NOT NULL,
          review_gate TEXT NOT NULL,
          notification_template TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE INDEX IF NOT EXISTS auto_assignment_rules_active_priority_idx
          ON auto_assignment_rules(active, priority, updated_at DESC);

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('008_auto_assignment_rules', 'Phase 2 auto-assignment rules', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM schema_migrations WHERE id = '008_auto_assignment_rules';
        DROP TABLE IF EXISTS auto_assignment_rules;
        """
    )
