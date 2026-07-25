"""
h23 — Smart approvals and secret sources (v0.19 architecture sketch)

Precedence matters:
  user deny rule -> deterministic allow -> exact-command smart review -> ask
Secret values are resolved separately and retain source provenance.
"""

from dataclasses import dataclass
from typing import Protocol


class SecretSource(Protocol):
    name: str
    def resolve(self, key: str) -> str | None: ...


@dataclass(frozen=True)
class SecretValue:
    value: str
    source: str


def decide(command: str, deny_rules, allow_rules, smart_reviewer) -> str:
    if any(rule.matches(command) for rule in deny_rules):
        return "deny"  # cannot be bypassed by convenience/yolo modes
    if any(rule.matches(command) for rule in allow_rules):
        return "allow"
    return smart_reviewer.review_exact_command(command)


def resolve_secret(key: str, sources: list[SecretSource]) -> SecretValue:
    for source in sources:
        if value := source.resolve(key):
            return SecretValue(value=value, source=source.name)
    raise KeyError(key)
