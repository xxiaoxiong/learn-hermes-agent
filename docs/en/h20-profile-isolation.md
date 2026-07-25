# h20 — Profiles: Agent Identity and State Isolation

> Aligned with Hermes Agent v0.19.0. A profile is not a directory shortcut; it is the complete state boundary for an agent identity.

## Why profiles exist

One Hermes installation may serve work, personal, research, or team contexts. Sharing configuration, memory, skills, and sessions would leak knowledge and permissions across those contexts. `HERMES_HOME` scopes the profile's config, memory, session database, skills, cron jobs, gateway state, logs, and secrets.

## Three boundaries to keep separate

| Boundary | Responsibility |
|---|---|
| `HERMES_HOME` | Hermes identity, configuration, and persistent state |
| `terminal.cwd` | Project directory where tools begin executing |
| OS `HOME` | Credentials used by external CLIs such as git, ssh, gh, and npm |

Host profiles share the real OS `HOME` by default so existing CLI credentials continue to work. Strict external-tool isolation is opt-in through `terminal.home_mode: profile`, which also means initializing profile-specific CLI credentials.

## Routing in v0.19

A multiplexed gateway can route a guild, channel, or thread to a selected profile while keeping every profile's state independent. This allows one bot token to front several isolated agents without turning one bad profile configuration into a gateway-wide failure.

**Official source areas:** `hermes_constants.py`, profile configuration, and gateway profile routing.
