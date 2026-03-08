# Redigg

Redigg is an autonomous research agent platform based on OpenClaw.

## Setup

1.  Clone the repository.
2.  Run `npm install`.
3.  Copy `.env.example` to `.env` (create one if needed).
4.  Run `npm run dev` to start the development server.

## Documentation

-   [Design Document](docs/redigg-design.md) - The core design philosophy, architecture, and roadmap.
-   [Contribution Guidelines](docs/contribution.md) - Coding standards and project structure for contributors.

## Architecture

-   `src/app`: Application Layer (Memory Evolution, Skill Evolution, etc.)
-   `src/core`: Core Layer (Agent, Memory Manager, etc.)
-   `src/infra`: Infrastructure Layer (Gateway, Storage, etc.)

## Modules

### Memory System (Phase 1)
Implemented in `src/core/memory/MemoryManager.ts` using SQLite (`src/infra/storage/sqlite.ts`).
Supports storing and retrieving user preferences, facts, and context.

- [x] Memory Storage (SQLite)
- [x] Basic CRUD Operations
- [x] Memory Injection (Keyword Search)
- [x] Memory Evolution (Learning from interaction)

### Skill System (Phase 2)
Implemented in `src/core/skills/SkillManager.ts`.
Supports executing modular skills with context and memory access.

- [x] Skill Interface & Manager
- [x] Literature Review Skill (Mock Scholar Search)
- [ ] Skill Evolution (Self-improvement)

### A2A Gateway
Implemented in `src/infra/a2a/gateway.ts`.
Allows Redigg to be used as an autonomous agent node by OpenClaw or other A2A-compliant systems.

- [x] Agent Card (Discovery)
- [x] JSON-RPC Interface
- [x] HTTP+JSON Interface

## Usage

### CLI Demo
Run the CLI to test the autonomous research agent with memory capabilities.

```bash
# Create .env file with OPENAI_API_KEY for real LLM (Optional)
cp .env.example .env

# Run CLI
npx tsx src/cli.ts
```

In the CLI, try:
1.  **Teach**: "My name is Alice" or "I am interested in cancer research"
2.  **Verify**: "What is my name?" or "What should I research today?"
    - The agent will use injected memories to personalize the response.

## Reference
OpenClaw reference code is available in `reference/openclaw`.
