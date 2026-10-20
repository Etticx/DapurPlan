# DapurPlan web

Next.js + TypeScript frontend and backend for the DapurPlan hackathon prototype.

## Run locally

```sh
cd web
npm install
npm run dev
```

Open the local URL printed by Next.js. Use Node.js 22 (tested with 22.12.0) or newer.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS 4 with a white/light-blue theme
- Geist Sans, loaded from the installed open-source font package
- shadcn/ui component conventions and Lucide icons

The root uv project stays in place for the later Python model service.
The web app lives in this folder; do not move or replace the Python package.

## Check

```sh
npm run typecheck
npm run build
```

## Incremental development

1. Project foundation and theme.
2. Prototype owner login.
3. Daily sales entry and saved records (later).
4. Forecast, recipes, stock and reviewed purchases (later).

Replit hosting and Runpod inference are later integration steps.

## Prototype login

- Username: `owner`
- Password: `123`
- `/login` accepts the demo account; `/home` checks the signed session on the server.
- Sign out clears the HttpOnly session cookie; sessions expire after 8 hours.
- This is simulated owner authentication for the prototype, not a real account system.
- Before publishing, set `DEMO_SESSION_SECRET` to a random value of at least 32 characters.
- Staff roles, real accounts and restaurant features are future commits.

UI primitives use shadcn/ui's open-code conventions (MIT), Radix Slot, CVA and Tailwind.
Icons are from Lucide; the kitchen illustration is an original SVG.


## Permanent recipe storage

Recipes now use SQLite (`better-sqlite3`) at `web/data/dapurplan.sqlite`.
Run `npm install`, then `npm run dev` inside `web/`; open http://localhost:4000.
Sign in with the existing demo owner account. First recipe access creates the schema,
five menus, shared ingredient catalogue and initial demo recipe versions in one
transaction. Later starts do not overwrite edited recipes. Saving creates a new
immutable-by-application snapshot with the server-derived owner identity and UTC time.
The UI displays Malaysia time. Inventory/ML are not connected.

Schema version 1: `menus`, `ingredients` (`stock_tracked=0` for water), `recipes`,
`recipe_lines`, `recipe_versions`, and `schema_migrations`. IDs match `src/lib/recipes.ts`.
Each recipe update checks its current version to reject stale edits and writes current
values, lines, and history atomically. Authenticated endpoints: GET `/api/recipes`,
PUT `/api/recipes/:id`, GET `/api/recipes/:id/history`.

Database files, WAL journals and secrets are ignored by Git. Set `DAPURPLAN_DB_PATH`
to change the file location. Back up via SQLite's backup API or stop the app before
copying its database; copying an active database without its WAL can lose updates.

This is single-machine prototype storage, not a hosted shared database. Before Replit
deployment, use persistent storage guaranteed by that hosting setup or migrate to a
managed database such as PostgreSQL. Do not rely on an ephemeral deployment filesystem
or share this file across separate app instances. The existing shared demo owner account
is not multi-user production authentication. Recipe history is retained; a full activity
log screen and preparation records will be added separately.

Run recipe checks with `npm run test:recipes`. Tests use a temporary database, including a forced history-write failure to verify rollback.
