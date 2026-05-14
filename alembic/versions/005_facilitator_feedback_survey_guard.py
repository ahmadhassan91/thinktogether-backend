"""Learner survey duplicate guard.

Revision ID: 005_facilitator_feedback_survey_guard
Revises: 004_invite_revocations
Create Date: 2026-05-13 00:05:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "005_facilitator_feedback_survey_guard"
down_revision: Union[str, Sequence[str], None] = "004_invite_revocations"
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
        WITH ranked_surveys AS (
          SELECT
            id,
            ROW_NUMBER() OVER (PARTITION BY learner_id, path_id ORDER BY created_at DESC, id DESC) AS row_number
          FROM facilitator_feedback
          WHERE survey_submitted
        )
        UPDATE facilitator_feedback
        SET survey_submitted = false
        FROM ranked_surveys
        WHERE facilitator_feedback.id = ranked_surveys.id
          AND ranked_surveys.row_number > 1;

        CREATE UNIQUE INDEX IF NOT EXISTS facilitator_feedback_unique_submitted_survey_idx
          ON facilitator_feedback(learner_id, path_id)
          WHERE survey_submitted;

        INSERT INTO schema_migrations (id, name, applied_at)
        VALUES ('005_facilitator_feedback_survey_guard', 'Learner survey duplicate guard', NOW())
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    run_many(
        """
        DELETE FROM schema_migrations WHERE id = '005_facilitator_feedback_survey_guard';
        DROP INDEX IF EXISTS facilitator_feedback_unique_submitted_survey_idx;
        """
    )
