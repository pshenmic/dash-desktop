# AGENTS.md

This file provides repository-specific instructions for Codex and other coding
agents working in this repository. It applies to the entire repository. Follow
the complete project guidance in `CLAUDE.md`; treat it as part of this file.

## Agent-specific rules

- Read `CLAUDE.md` before making changes, reviewing code, or proposing an
  implementation. Its commands, architecture notes, verification gate, and
  house style are authoritative for this repository.
- Interpret references to Claude Code in `CLAUDE.md` as references to the
  current coding agent. The technical rules are tool-agnostic.
- If `AGENTS.md` and `CLAUDE.md` appear to conflict, follow the more specific
  repository rule. Ask the user only when the conflict would materially change
  the result and cannot be resolved from the codebase.
- Keep `AGENTS.md` and `CLAUDE.md` aligned when repository conventions change.
  Do not silently weaken or omit a rule when porting guidance between them.
- Use Yarn for dependency operations. Do not use pnpm, even though a
  `pnpm-lock.yaml` may exist.
- Before declaring an implementation complete, run the full green gate from
  `CLAUDE.md` unless the user explicitly narrows verification or an external
  blocker makes a command impossible. Report any command that was not run or
  did not pass.

