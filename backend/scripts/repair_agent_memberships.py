"""Repair agent/board memberships against agent records."""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass

from sqlmodel import col, select

from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.models.agent_board_memberships import AgentBoardMembership
from app.models.agents import Agent
from app.models.boards import Board

logger = get_logger(__name__)


@dataclass
class RepairPlan:
    create: list[AgentBoardMembership]
    update_lead: list[AgentBoardMembership]
    delete: list[AgentBoardMembership]


async def build_plan() -> RepairPlan:
    async with async_session_maker() as session:
        agents = list((await session.exec(select(Agent))).all())
        memberships = list((await session.exec(select(AgentBoardMembership))).all())
        boards = {str(board_id) for board_id in (await session.exec(select(Board.id)))}

    memberships_by_agent: dict[str, list[AgentBoardMembership]] = {}
    for membership in memberships:
        memberships_by_agent.setdefault(str(membership.agent_id), []).append(membership)

    create: list[AgentBoardMembership] = []
    update_lead: list[AgentBoardMembership] = []
    delete: list[AgentBoardMembership] = []

    for agent in agents:
        rows = memberships_by_agent.get(str(agent.id), [])
        if agent.board_id and not rows:
            create.append(
                AgentBoardMembership(
                    agent_id=agent.id,
                    board_id=agent.board_id,
                    is_board_lead=agent.is_board_lead,
                )
            )
        if agent.board_id is None and rows:
            delete.extend(rows)
        if agent.is_board_lead and rows:
            for row in rows:
                if row.board_id == agent.board_id and not row.is_board_lead:
                    row.is_board_lead = True
                    row.updated_at = utcnow()
                    update_lead.append(row)

    agent_ids = {str(agent.id) for agent in agents}
    for membership in memberships:
        if str(membership.agent_id) not in agent_ids:
            delete.append(membership)
        if str(membership.board_id) not in boards:
            delete.append(membership)

    return RepairPlan(create=create, update_lead=update_lead, delete=delete)


async def apply_plan(plan: RepairPlan, *, apply: bool) -> None:
    if not any([plan.create, plan.update_lead, plan.delete]):
        logger.info("No membership changes required.")
        return
    logger.info(
        "Plan: create=%s update_lead=%s delete=%s",
        len(plan.create),
        len(plan.update_lead),
        len(plan.delete),
    )
    if not apply:
        logger.info("Dry run enabled; no changes applied.")
        return

    async with async_session_maker() as session:
        for membership in plan.create:
            session.add(membership)
        for membership in plan.update_lead:
            session.add(membership)
        for membership in plan.delete:
            await session.delete(membership)
        await session.commit()
    logger.info("Membership repairs applied.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Repair agent board memberships.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes (default is dry-run).",
    )
    args = parser.parse_args()
    plan = asyncio.run(build_plan())
    asyncio.run(apply_plan(plan, apply=args.apply))


if __name__ == "__main__":
    main()
