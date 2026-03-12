"""Audit agent/board memberships against agent records."""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from typing import Iterable

from sqlmodel import col, select

from app.core.logging import get_logger
from app.db.session import async_session_maker
from app.models.agent_board_memberships import AgentBoardMembership
from app.models.agents import Agent
from app.models.boards import Board

logger = get_logger(__name__)


@dataclass
class AuditFinding:
    kind: str
    message: str


async def _load_agents(session) -> list[Agent]:
    return list((await session.exec(select(Agent))).all())


async def _load_memberships(session) -> list[AgentBoardMembership]:
    return list((await session.exec(select(AgentBoardMembership))).all())


async def _load_boards(session) -> set[str]:
    rows = await session.exec(select(Board.id))
    return {str(board_id) for board_id in rows}


def _summarize(findings: Iterable[AuditFinding]) -> None:
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.kind] = counts.get(finding.kind, 0) + 1
    if not counts:
        logger.info("No findings detected.")
        return
    logger.info("Findings summary:")
    for kind, count in sorted(counts.items()):
        logger.info("- %s: %s", kind, count)


async def audit() -> int:
    findings: list[AuditFinding] = []
    async with async_session_maker() as session:
        agents = await _load_agents(session)
        memberships = await _load_memberships(session)
        board_ids = await _load_boards(session)

    memberships_by_agent: dict[str, list[AgentBoardMembership]] = {}
    for membership in memberships:
        memberships_by_agent.setdefault(str(membership.agent_id), []).append(membership)

    for agent in agents:
        key = str(agent.id)
        rows = memberships_by_agent.get(key, [])
        if agent.board_id and not rows:
            findings.append(
                AuditFinding(
                    kind="missing_membership",
                    message=f"Agent {agent.id} missing membership for board {agent.board_id}",
                )
            )
        if agent.board_id is None and rows:
            findings.append(
                AuditFinding(
                    kind="stale_membership",
                    message=f"Agent {agent.id} has memberships but no board_id",
                )
            )
        if agent.is_board_lead and not any(row.is_board_lead for row in rows):
            if agent.board_id:
                findings.append(
                    AuditFinding(
                        kind="lead_mismatch",
                        message=f"Agent {agent.id} lead flag missing on membership for board {agent.board_id}",
                    )
                )
        if agent.board_id and rows:
            if not any(row.board_id == agent.board_id for row in rows):
                findings.append(
                    AuditFinding(
                        kind="board_mismatch",
                        message=(
                            f"Agent {agent.id} board_id={agent.board_id}"
                            " does not match any membership rows"
                        ),
                    )
                )

    agent_ids = {str(agent.id) for agent in agents}
    for membership in memberships:
        if str(membership.agent_id) not in agent_ids:
            findings.append(
                AuditFinding(
                    kind="orphan_membership",
                    message=f"Membership {membership.id} references missing agent {membership.agent_id}",
                )
            )
        if str(membership.board_id) not in board_ids:
            findings.append(
                AuditFinding(
                    kind="orphan_board",
                    message=f"Membership {membership.id} references missing board {membership.board_id}",
                )
            )

    for finding in findings:
        logger.warning("%s: %s", finding.kind, finding.message)

    _summarize(findings)
    return 1 if findings else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit agent board memberships.")
    _ = parser.parse_args()
    raise SystemExit(asyncio.run(audit()))


if __name__ == "__main__":
    main()
