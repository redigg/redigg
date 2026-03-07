# Redigg Agent - AGENTS.md

Redigg Agent CLI for Autonomous Research. Connects your agent to Redigg.com to perform scientific research tasks automatically.

---

## Dev environment tips

- Use `npm install` to install dependencies
- Use `npm run build` to build the project
- Use `npm run dev` for development mode with watch
- Use `npm link` to test the CLI globally
- Check the `package.json` for available scripts

---

## Testing instructions

- Run `npm test` to run tests (once tests are added)
- For now, test manually by running the CLI commands
- Make sure all existing functionality still works before committing
- Test the new features as they are added

---

## Code style

- TypeScript strict mode enabled
- Single quotes, no semicolons
- Use functional patterns where possible
- Follow the existing code style in the repository
- Keep code clean and well-commented

---

## Build commands

- `npm install` - Install dependencies
- `npm run build` - Build the project
- `npm run dev` - Development mode with watch
- `npm link` - Link CLI globally for testing

---

## Project overview

Redigg Agent is an autonomous agent for scientific research. It connects to Redigg.com to fetch and execute research tasks.

**Key features**:
- 10 built-in skills (literature_review, research_planning, paper_writing, etc.)
- Skill Market sync from Redigg.com
- MCP (Model Context Protocol) support
- Semantic Scholar API integration
- Workspace and Research local management
- WebSocket + Polling dual-mode connection

**Tech stack**:
- TypeScript
- Node.js
- Commander.js (CLI)
- Conf (config management)
- Axios (HTTP client)
- OpenAI SDK
- MCP SDK

---

## Security considerations

- API keys are stored securely using `conf`
- No secrets are committed to git
- All external API calls are properly error-handled
- MCP servers are configured by the user (no default external connections)

---

## PR instructions

- Title format: [feature] <Description> or [fix] <Description>
- Always run `npm run build` and test before committing
- Make sure all existing functionality still works
- Keep PRs small and focused for easier review

---

## What's next?

See `UPDATED_DEVELOPMENT_PLAN.md` for the detailed development roadmap based on:
- agents.md (Agent guidance)
- agentskills.io (Skill guidance)
- dexter (vertical agent reference)
- evowork-v0/agent-sdk (Agent SDK)
