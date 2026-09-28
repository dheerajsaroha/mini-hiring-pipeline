# Mini Hiring Pipeline

A small hiring pipeline application with an event-sourced architecture. Candidate state is derived by replaying an immutable event log, so nothing can be altered after it is recorded.

## Architecture

The project is a monorepo with three packages:

- **`server`** — TypeScript/Express API backed by `better-sqlite3`. Exposes candidate CRUD, stage transitions, and a natural-language search endpoint.
- **`web`** — React + Vite single-page app showing a Kanban-style board of candidates grouped by stage.
- **`shared`** — Shared TypeScript types consumed by both `server` and `web`.

There is also a standalone Python module (`pipeline.py` / `db.py`) that implements the same event-sourced state-derivation and transition-enforcement logic independently of the Node server.

## Event-sourced design

Every state change is recorded as an immutable row in the `events` table (type: `created`, `moved`, `hired`, `rejected`, `note`). The candidate's current state is derived by replaying the events in order — it is never stored directly, so the audit trail cannot be tampered with.

Stages (in order): `Applied` → `Screening` → `Interview` → `Offer` → `Hired`. `Rejected` is a terminal outcome reachable from any non-terminal stage. `Hired` and `Rejected` are both terminal — once reached, no further transitions are allowed.

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.11+ (only required for the standalone Python module)

### Install dependencies

```bash
npm install
```

This installs all workspace packages (`server`, `web`, `shared`) and root dev dependencies.

### Seed the database

```bash
npm run seed
```

### Run the full stack

```bash
npm run dev
```

This starts the server and web frontend concurrently. The API is served on `http://localhost:3001` and the frontend on `http://localhost:5173` (Vite proxy forwards `/api` to the server).

## Project scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start server and web in concurrently |
| `npm run dev:server` | Start the Express server in watch mode |
| `npm run dev:web` | Start the Vite dev server |
| `npm run build` | Build all workspace packages |
| `npm run test` | Run tests across all workspaces |
| `npm run seed` | Seed the SQLite database with sample candidates |
| `npm run lint` | Run linters across all workspaces |

## API endpoints

All routes are prefixed with `/api`.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/candidates` | Create a candidate (`name`, optional `email`) |
| `GET` | `/candidates` | List candidates grouped by current stage |
| `GET` | `/candidates/:id` | Fetch a candidate with full event history |
| `POST` | `/candidates/:id/transition` | Advance or reject a candidate (`to`, `expectedStage`, optional `note`) |
| `GET` | `/search?q=...` | Natural-language search over candidates |

Transitions use optimistic concurrency: the request must include the `expectedStage` the client believes the candidate is currently at. If the actual state differs, the server returns `409 Conflict`. Invalid moves return `422 Unprocessable Entity`.

## Python module

`pipeline.py` and `db.py` implement the same event-sourced logic in pure Python against `pipeline.db`. Key functions:

- `move_forward(cid)` — advance to the next stage
- `reject_candidate(cid)` — reject from any non-terminal stage
- `hire_candidate(cid)` — hire, only allowed from `Offer`
- `get_candidate_state(cid)` — derive current state from the event log
- `list_states()` — list all candidates with derived state

Run a quick smoke test with:

```bash
python -c "
import db, pipeline
db.init_db()
cid = db.add_candidate('Ada Lovelace', 'ada@example.com', 'Engineer')
print(pipeline.get_candidate_state(cid))
pipeline.move_forward(cid)
print(pipeline.get_candidate_state(cid))
"
```

## Testing

Tests use Vitest across workspaces:

```bash
npm run test
```

The `tests/` directory contains unit tests for the search evaluator/ranker and the state-transition rules.

## Layout

```
.
├── server/                 # Express API (TypeScript)
│   ├── src/
│   │   ├── index.ts        # App entry point
│   │   ├── api/routes.ts   # HTTP routes
│   │   ├── db/             # SQLite persistence
│   │   ├── domain/         # Transition rules
│   │   └── search/         # Natural-language search
│   └── dist/               # Compiled output
├── web/                    # React frontend (Vite)
│   └── src/
│       ├── App.tsx
│       └── components/     # Board, drawer, search, modal
├── shared/                 # Shared TypeScript types
├── tests/                  # Vitest tests
├── pipeline.py             # Python event-sourced core
├── db.py                   # Python SQLite helpers
└── package.json            # Root workspace config
```

## License

MIT