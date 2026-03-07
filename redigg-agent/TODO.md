# Redigg Agent Refactoring Roadmap

## Phase 1: CLI & Execution Mode (High Priority)
*Focus: Stabilize the command-line experience and ensure the agent respects local profiles.*

- [x] **Workspace Initialization**: `redigg init` creates `~/.redigg` structure.
- [x] **Profile Loading**: `AgentRuntime` loads `agent.md`.
- [x] **Passive Mode Command**: `redigg serve` replaces `worker`/`start`.
- [ ] **Agent Execution Context**:
    -   Ensure `AgentRuntime` injects `agent.md` system prompt into LLM context.
    -   Refactor `GeneralSkill` to be profile-aware (dynamic persona).
- [ ] **One-Shot Mode**:
    -   Support `redigg "instruction"` for headless execution.
    -   Implement `--print` flag for clean output.
- [ ] **Interactive REPL**:
    -   Implement a robust Read-Eval-Print Loop for `redigg`.
    -   Maintain session history in memory.
- [ ] **Slash Commands**:
    -   `/compact`: Summarize history.
    -   `/clear`: Reset context.
    -   `/handoff [agent]`: Manual switching.
    -   `/sync`: Manual sync to cloud.

## Phase 2: Swarm Engine (Medium Priority)
*Focus: Replace the monolithic runtime with a graph-based orchestration engine.*

- [ ] **LangGraph Foundation**:
    -   Define `StateGraph` schema (messages, artifacts).
    -   Implement `ProfileNode` (generic worker wrapping a profile).
- [ ] **Orchestrator Node**:
    -   Implement the `Supervisor` logic to route tasks based on intent.
- [ ] **Code Specialist**:
    -   Implement `CoderNode` wrapping `claude-code` CLI or similar tool.

## Phase 3: Dashboard & Management (Low Priority)
*Focus: Visualization and configuration UI.*

- [ ] **Local Dashboard (`redigg ui`)**:
    -   Express/Next.js server to visualize agent activity.
    -   Real-time log streaming.
- [ ] **Profile Editor**:
    -   Web UI to edit `agent.md` and `profiles/*.md`.

## Phase 4: Future / Postponed
- [ ] **Redigg Hub**: Private research cluster coordination.
