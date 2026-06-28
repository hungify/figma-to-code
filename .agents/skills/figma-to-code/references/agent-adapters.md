# Agent Adapters

Core workflow is portable across Codex, Claude Code, and Cursor. Keep canonical rules in `.agents/skills/figma-to-code` and generated `AGENTS.md` files.

## Codex

- Read `AGENTS.md` hierarchy and this skill.
- Use `apply_patch` for manual edits.
- Use Figma MCP tools when available.
- Ask human in chat for visual accept/override.

## Claude Code

- If Claude does not auto-load `.agents/skills`, link/copy skill folder into its skill directory.
- Keep generated project context in `AGENTS.md`; only add `CLAUDE.md` if project already uses it.
- Ask human in chat for visual accept/override.

## Cursor

- Keep generated project context in `AGENTS.md`.
- Add `.cursor/rules/*.mdc` only if cursor-specific activation/globs are required.
- Do not fork core rules into Cursor-only files unless user asks.

## Shared Behavior

- One source of truth for feature/screen docs: nested `AGENTS.md`.
- `.figma/artifacts` stores evidence and gate outputs only.
- If Code Connect is unavailable, warn and use repo component discovery manually.
