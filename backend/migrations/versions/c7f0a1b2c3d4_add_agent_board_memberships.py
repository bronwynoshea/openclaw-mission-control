"""add agent board memberships

Revision ID: c7f0a1b2c3d4
Revises: fa6e83f8d9a1
Create Date: 2026-03-11 14:58:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c7f0a1b2c3d4"
down_revision = "fa6e83f8d9a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_board_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("board_id", sa.Uuid(), nullable=False),
        sa.Column("is_board_lead", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], name="fk_agent_board_memberships_agent_id_agents"),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"], name="fk_agent_board_memberships_board_id_boards"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "agent_id",
            "board_id",
            name="uq_agent_board_memberships_agent_id_board_id",
        ),
    )
    op.create_index(
        "ix_agent_board_memberships_agent_id",
        "agent_board_memberships",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        "ix_agent_board_memberships_board_id",
        "agent_board_memberships",
        ["board_id"],
        unique=False,
    )
    op.create_index(
        "ix_agent_board_memberships_is_board_lead",
        "agent_board_memberships",
        ["is_board_lead"],
        unique=False,
    )

    op.execute(
        """
        insert into agent_board_memberships (id, agent_id, board_id, is_board_lead, created_at, updated_at)
        select gen_random_uuid(), id, board_id, coalesce(is_board_lead, false), now(), now()
        from agents
        where board_id is not null
        """
    )


def downgrade() -> None:
    op.drop_index("ix_agent_board_memberships_is_board_lead", table_name="agent_board_memberships")
    op.drop_index("ix_agent_board_memberships_board_id", table_name="agent_board_memberships")
    op.drop_index("ix_agent_board_memberships_agent_id", table_name="agent_board_memberships")
    op.drop_table("agent_board_memberships")
