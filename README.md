# Bolotext Agent Studio (frontend)

React 19 + Vite + TypeScript + Tailwind v4 frontend for the Bolotext voice-agent backend
(`bolotext-backend`: api-gateway `:8000`, users-service `:8001`, agents-service `:8002`).

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

All `/api/*` calls go to the API gateway through the Vite dev proxy (the backend sends no CORS
headers). Override the target with `API_GATEWAY_URL` — see `.env.example`. For a production build
served without a proxy, set `VITE_API_BASE_URL` and enable CORS on the gateway.

## Structure

```
src/
  api/          client (envelope handling, token refresh), endpoints, types, react-query hooks
  auth/         AuthProvider: login (+ org picker), switch org, logout, session expiry
  lib/          permissions (RBAC mirror), theme, utils
  components/   ui primitives (button, inputs, modal/drawer/confirm, table…) + app shell
  pages/
    agents/     list, create, detail + builder/ (one file per tab)
    organizations/, UsersPage, ProvidersPage, SettingsPage, DashboardPage, LoginPage
```

## Backend contract notes

- Every response is HTTP 200 with `{status, code, message, data|errors}`; the client branches on
  `status`/`code`, refreshes the access token once on `401`, then signs out.
- RBAC: the backend has no "my permissions" endpoint, so `src/lib/permissions.ts` mirrors
  `users_service/db/seed.py` and the agent rules in `agents_service/agents/service.py`. It only
  drives what the UI shows — the backend still enforces everything.

| Role | Agents | Users / members | Organizations |
| --- | --- | --- | --- |
| Super Admin | everything | everything | everything |
| Admin | full access in org, assign developers | `user.*`, `membership.*` | — |
| Developer | create; edit only assigned agents | view | — |
| QA | view-only (incl. prompt preview) | — | — |

## Feature → API map

| Screen | Endpoints |
| --- | --- |
| Agents list / create / clone / status / delete | `GET/POST /agents`, `POST /agents/{id}/clone`, `PATCH /agents/{id}/status`, `DELETE /agents/{id}` |
| General | `PATCH /agent-details`, `PUT /languages` |
| Prompt | `PATCH /prompt/messages`, `PUT /pre-call-variables`, `PATCH /prompt/language-switch`, `GET /prompt/language-switch-preview` |
| Flow | `PATCH /flow` |
| Knowledge | `PATCH /faq`, `PATCH /llm` (`knowledge_base_ids`) |
| Tools | `PATCH /actions`, `PATCH /mcp`, `PATCH /dynamic-message` |
| LLM / Speech / Voice | `PATCH /llm`, `/transcriber`, `/voice-persona` + `GET /providers` |
| Call handling / Post-call | `PATCH /others`, `PATCH /analytics` |
| Test | `POST /test` (prompt render only) |
| Deployment / environments | `PATCH /deployment`, `GET /environments[/{env}]`, `POST /move-to-stage`, `POST /move-to-prod` |
| Versions | environment diff (client-side), `GET/POST/PATCH/DELETE /prompt/versions` |
| Access | `GET/POST/DELETE /assignments` |
| Users / Organizations / Settings | users-service `/users`, `/organizations`, `/organizations/{id}/members`, `/users/me`, `/auth/*` |

Not built because the backend has no API for them yet: calls, transcripts, QA scoring, projects,
activity/audit log, knowledge-base management and live test calls.
