"""add board hierarchy and agent roles

Revision ID: f9b8c7d6e5a4
Revises: f4d2b649e93a
Create Date: 2026-03-11 20:25:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f9b8c7d6e5a4"
down_revision = "f4d2b649e93a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "boards",
        sa.Column("parent_board_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        "ix_boards_parent_board_id",
        "boards",
        ["parent_board_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_boards_parent_board_id_boards",
        "boards",
        "boards",
        ["parent_board_id"],
        ["id"],
    )

    op.add_column(
        "agents",
        sa.Column("is_board_group_lead", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "agents",
        sa.Column("board_group_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "agents",
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_agents_is_board_group_lead",
        "agents",
        ["is_board_group_lead"],
        unique=False,
    )
    op.create_index(
        "ix_agents_board_group_id",
        "agents",
        ["board_group_id"],
        unique=False,
    )
    op.create_index(
        "ix_agents_is_super_admin",
        "agents",
        ["is_super_admin"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_agents_board_group_id_board_groups",
        "agents",
        "board_groups",
        ["board_group_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_agents_board_group_id_board_groups", "agents", type_="foreignkey")
    op.drop_index("ix_agents_is_super_admin", table_name="agents")
    op.drop_index("ix_agents_board_group_id", table_name="agents")
    op.drop_index("ix_agents_is_board_group_lead", table_name="agents")
    op.drop_column("agents", "is_super_admin")
    op.drop_column("agents", "board_group_id")
    op.drop_column("agents", "is_board_group_lead")

    op.drop_constraint("fk_boards_parent_board_id_boards", "boards", type_="foreignkey")
    op.drop_index("ix_boards_parent_board_id", table_name="boards")
    op.drop_column("boards", "parent_board_id")
