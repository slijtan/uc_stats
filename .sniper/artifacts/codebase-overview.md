# Codebase Overview: uc_stats

**Protocol:** SNPR-20260328-9d62
**Date:** 2026-03-28
**Author:** Analyst Agent

---

## Status: Greenfield Project

This is a greenfield project. There is no existing application code to analyze.

### Current Project Contents

```
uc_stats/
  CLAUDE.md              -- Project instructions and SNIPER configuration reference
  .claude/               -- Claude Code agent definitions and settings
  .sniper/               -- SNIPER framework configuration
    config.yaml          -- Project config (TypeScript, npm, SaaS type)
    artifacts/           -- Protocol artifacts (this file, discovery brief)
    checklists/          -- Protocol checklists
    checkpoints/         -- Phase checkpoint snapshots
    gates/               -- Gate review results
    knowledge/           -- Project knowledge base
    live-status.yaml     -- Real-time protocol progress
    memory/              -- Agent memory
    protocols/           -- Protocol definitions
    retros/              -- Retrospective reports
    self-reviews/        -- Self-review artifacts
```

### Stack Configuration (from config.yaml)

- **Language:** TypeScript
- **Package manager:** npm
- **Frontend framework:** Not yet specified
- **Backend framework:** Not yet specified
- **Database:** Not yet specified
- **Test runner:** Not yet specified
- **Build/lint/test commands:** Not yet configured

### Ownership Boundaries (from config.yaml)

The config defines ownership zones for future code:
- **Backend:** `src/backend/`, `src/api/`, `src/services/`, `src/db/`
- **Frontend:** `src/frontend/`, `src/components/`, `src/hooks/`, `src/styles/`, `src/pages/`
- **Infrastructure:** `docker/`, `.github/`, `infra/`, `scripts/`
- **Tests:** `tests/`, `__tests__/`, `*.test.*`, `*.spec.*`
- **Docs:** `docs/`

### Conventions

No code conventions established yet. These will be defined by the architect during the design phase.

### Technical Debt

None (greenfield).

### Dependencies

None installed yet. `package.json` does not exist.
