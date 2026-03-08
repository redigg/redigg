# Redigg

Redigg is an autonomous research agent platform based on OpenClaw, designed to help researchers with literature review, data analysis, and scientific discovery.

**[📚 Documentation Index](docs/README.md)**

## 🚀 Quick Start

1.  **Clone the repository**
    ```bash
    git clone https://github.com/redigg/redigg.git
    cd redigg
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure environment**
    ```bash
    cp .env.example .env
    # Edit .env and set your OPENAI_API_KEY
    ```

4.  **Run development server**
    ```bash
    npm run dev
    ```

5.  **Access the Web UI**
    Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📖 Documentation

All documentation is located in the `docs/` directory.

-   **[Product Design](docs/redigg-design.md)**: Vision, architecture, and core concepts.
-   **[Product Roadmap](docs/PRODUCT_ROADMAP.md)**: Strategic plan and milestones.
-   **[Iteration Plan](docs/ITERATION_PLAN.md)**: Detailed execution plan for upcoming features.
-   **[Scheduled Tasks](docs/SCHEDULED_TASKS.md)**: Plan for background jobs and cron tasks.
-   **[Contribution Guide](docs/contribution.md)**: How to contribute to Redigg.
-   **[Quick Start V2](docs/QUICK_START_V2.md)**: Guide for upgrading to V2 features (Vector Search, Planner, Feedback).

## 🏗️ Architecture

Redigg follows a modular architecture:

-   `src/app`: Application Layer (Evolution Systems)
-   `src/core`: Core Layer (Agent, Memory, Planning)
-   `src/infra`: Infrastructure Layer (Gateway, Storage, Skills)
-   `src/skills`: Skill Modules
-   `web/`: React Frontend

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 📄 License

MIT

---

**Redigg AI Team** 🦎
*"人能停 AI 不能停"*
