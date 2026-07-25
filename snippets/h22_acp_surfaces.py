"""
h22 — ACP and agent surfaces (Hermes Agent v0.19 architecture sketch)

CLI, TUI, Desktop, Gateway, API Server, Python Library, and ACP are adapters.
They normalize input and consume events from the same AIAgent core.
"""

from dataclasses import dataclass
from typing import AsyncIterator, Protocol


@dataclass
class AgentRequest:
    session_id: str
    text: str
    surface: str


class Surface(Protocol):
    async def receive(self) -> AgentRequest: ...
    async def emit(self, event: dict) -> None: ...


async def bridge(surface: Surface, agent) -> None:
    request = await surface.receive()
    async for event in agent.run_conversation(
        request.text,
        session_id=request.session_id,
    ):
        await surface.emit(event)


async def acp_events(json_rpc_stream) -> AsyncIterator[dict]:
    """ACP maps stdio/JSON-RPC messages into the shared event model."""
    async for message in json_rpc_stream:
        yield {"type": "agent_request", "payload": message}
