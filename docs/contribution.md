# Redigg Contribution Guidelines

Thank you for your interest in contributing to Redigg! This document outlines our development standards and practices.

## 1. Project Overview

Redigg is an autonomous research agent platform built with a modular architecture:
- **Language**: TypeScript (Node.js >= 22)
- **Database**: SQLite (better-sqlite3)
- **Testing**: Vitest
- **LLM Interface**: OpenAI-compatible API

## 2. Directory Structure

- `src/app`: Application Layer (Evolution Systems)
  - `memory-evo/`: Memory Evolution System
  - `skill-evo/`: Skill Evolution System (Planned)
- `src/core`: Core Logic
  - `agent/`: Agent implementation
  - `memory/`: Memory Management
  - `llm/`: LLM Client interfaces
- `src/infra`: Infrastructure
  - `storage/`: Database access
  - `gateway/`: API Gateway
- `src/scheduling/`: Cron & Scheduled Tasks
- `docs/`: Documentation
  - `SCHEDULED_TASKS.md`:定时任务规划文档
- `tests/`: Integration tests

## 3. Coding Standards

### 3.1 TypeScript
- Use `interface` for data structures and public APIs.
- Use `type` for unions and primitives.
- Explicitly type function arguments and return values.
- Prefer `async/await` over raw Promises.

### 3.2 Naming Conventions
- **Files**: `PascalCase.ts` for classes/components, `kebab-case.ts` for utilities.
- **Classes**: `PascalCase`
- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

### 3.3 Database
- All SQL queries should be parameterized to prevent injection.
- Use `better-sqlite3`'s synchronous API for local operations where appropriate.

## 4. Git Workflow

- **Branching**: Create feature branches from `main` (e.g., `feature/memory-evo`, `fix/gateway-bug`).
- **Commits**: Follow Conventional Commits:
  - `feat:` New features
  - `fix:` Bug fixes
  - `docs:` Documentation changes
  - `refactor:` Code restructuring
  - `test:` Adding tests
  - `chore:` Build/dependency updates

## 5. Testing

- Run tests before pushing: `npm test`
- Write unit tests for all new core logic.
- Place test files alongside source files (e.g., `MemoryManager.test.ts`).

## 6. Development Loop

1.  **Setup**: `npm install`
2.  **Config**: Copy `.env.example` to `.env` and set your API keys.
3.  **Run**: `npm run dev` (starts development server)
4.  **CLI Test**: `npx tsx src/cli.ts` (interactive testing)

## 7. Adding New Features

1.  **Design**: Update `docs/redigg-design.md` if the architecture changes.
2.  **Implement**: Write code in `src/`.
3.  **Test**: Add unit tests.
4.  **Verify**: Use the CLI to verify end-to-end functionality.
