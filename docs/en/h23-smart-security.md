# h23 — Smart Approvals and Secrets: The v0.19 Security Control Plane

v0.19 moves beyond “prompt for every flagged command.” User deny rules are evaluated first and cannot be bypassed by yolo mode. Deterministically safe actions may be allowed. Ambiguous commands can be reviewed by an independent LLM, but that verdict applies only to the exact command. If uncertainty remains, the user still decides; a denial reason is returned to the agent so it can change course.

The new `SecretSource` interface also moves API keys out of plaintext `.env` files. Bitwarden and 1Password references can be enabled together with deterministic precedence, conflict warnings, and per-variable provenance.

Command authorization and secret resolution are intentionally separate. A reviewer does not need plaintext credentials, and tools receive only the values they need at the controlled execution boundary.

**Official source areas:** `tools/approval.py`, SecretSource providers, and credential-read guards.
