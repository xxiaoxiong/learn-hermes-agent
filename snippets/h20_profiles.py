"""
h20 — Profile isolation (Hermes Agent v0.19 architecture sketch)

Official source map:
  hermes_constants.py
  hermes_cli/profile_config.py
  gateway/profile_router.py

This compact teaching excerpt preserves the current control boundary without
copying unstable implementation details from the upstream repository.
"""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProfilePaths:
    hermes_home: Path
    config: Path
    memory: Path
    sessions: Path
    skills: Path
    secrets: Path


def resolve_profile(root: Path, profile: str | None) -> ProfilePaths:
    """HERMES_HOME scopes Hermes identity; cwd and OS HOME are separate."""
    hermes_home = root if not profile else root / "profiles" / profile
    return ProfilePaths(
        hermes_home=hermes_home,
        config=hermes_home / "config.yaml",
        memory=hermes_home / "memories",
        sessions=hermes_home / "state.db",
        skills=hermes_home / "skills",
        secrets=hermes_home / ".env",
    )


def route_message(route_table: dict[str, str], target: str) -> str:
    """A multiplexed gateway can route channels or threads to profiles."""
    return route_table.get(target, "default")
