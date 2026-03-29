---
id: S01
title: "Project setup with Vite, React, and TypeScript"
status: ready
priority: 1
dependencies: []
requirements: [NFR1, NFR6]
owner: fullstack-dev
---

# S01: Project setup with Vite, React, and TypeScript

## Description

Initialize the project with Vite + React + TypeScript scaffolding, including all runtime and dev dependencies identified in the architecture plan. Configure linting, build scripts, and the development server. Establish the directory structure defined in `plan.md` so that subsequent stories have a working project skeleton to build on.

## Acceptance Criteria

1. The system shall produce a production build (`npm run build`) that outputs a static `dist/` directory containing HTML, JS, and CSS files deployable to any static host.
2. When a developer runs `npm run dev`, the system shall start a Vite development server with hot module replacement that serves the application on localhost.
3. The system shall enforce TypeScript strict mode and compile without type errors on a clean project scaffold.
4. The system shall include the following runtime dependencies at the versions specified in the architecture plan: `react`, `react-dom`, `react-router-dom`, `recharts`, `fuse.js`.
5. The system shall include the following dev dependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `tsx`, `vitest`, `@testing-library/react`.

## Technical Context

Refers to D-design-001 (React with Vite) and the Project Directory Structure section in `plan.md`. The directory layout should match the architecture plan's folder hierarchy (`src/pages/`, `src/components/`, `src/hooks/`, `src/services/`, `src/types/`, `scripts/`, `tests/`, `public/data/`).

## Estimated Scope

small -- standard Vite + React scaffolding with known dependencies
