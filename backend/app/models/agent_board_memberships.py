"""Agent/board membership association rows."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)


class AgentBoardMembership(QueryModel, table=True):
    """Association row mapping agents to boards."""

    __tablename__ = "agent_board_memberships"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint(
            "agent_id",
            "board_id",
            name="uq_agent_board_memberships_agent_id_board_id",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    agent_id: UUID = Field(foreign_key="agents.id", index=True)
    board_id: UUID = Field(foreign_key="boards.id", index=True)
    is_board_lead: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
