"""
h24 — Durable delivery and observability (v0.19 architecture sketch)

Generation is not completion. The final response is persisted as a delivery
obligation before the platform send, then acknowledged or retried after restart.
"""

from dataclasses import dataclass
from enum import Enum


class DeliveryState(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    ACKED = "acked"


@dataclass
class DeliveryObligation:
    idempotency_key: str
    platform: str
    target: str
    payload: str
    state: DeliveryState = DeliveryState.PENDING


def deliver(store, adapter, obligation: DeliveryObligation) -> None:
    store.upsert(obligation)  # durable before side effect
    adapter.send(
        target=obligation.target,
        text=obligation.payload,
        idempotency_key=obligation.idempotency_key,
    )
    obligation.state = DeliveryState.ACKED
    store.upsert(obligation)


def recover(store, adapter) -> None:
    for obligation in store.unacknowledged():
        deliver(store, adapter, obligation)
