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
Migration 5 adds an optional selling price in integer cents. Owners set menu prices in
Recipes; staff can view them. Menu price edits use the same versioned recipe history.

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


## Inventory

Open `/inventory` after signing in. Closing counts are saved in the same SQLite
database as recipes. Schema migration 2 adds `inventory_batches`, `inventory_packs`,
and `inventory_history`. Saves and corrections (including pack settings and history)
are atomic. Existing batches require their current version; corrections retain history.
Owner-authenticated GET/POST `/api/inventory` load/save data. There is no sales deduction.

Use **Load demo stock** once on an empty inventory to add the agreed 17 ingredients
in 18 batches, including two chicken batches with separate hypothetical expiries.
Dates are relative to the Malaysia date when loaded. Other expiry dates remain blank
until checked against packaging. Demo provenance remains marked after correction.
An occupied inventory cannot be seeded, so demo loading never overwrites user stock.
Add only a batch's remaining amount, not the whole ingredient balance again. Set an
exhausted batch to zero; no permanent deletion is provided. Purchase pack settings
apply across batches of the ingredient. Quantities are internally convertible to
grams/millilitres/pieces; pieces require whole numbers in stock.

Totals display recorded stock, including expired batches. No demand-based low-stock
claim, forecast, purchase suggestion or automatic stock deduction is implemented yet.
The dashboard stays a preview; preparation and sales records are future work.
Run `npm run test:inventory` for isolated seed, validation, persistence and rollback tests.


## Daily sales

Open `/sales` after signing in. Enter whole-number quantities for the five fixed
menus; blank is stored as NULL (not entered), while 0 is confirmed zero sales.
At least one quantity is required per save. Dates follow Malaysia time and cannot
be in the future. The page shows total revenue and servings sold for the selected day,
revenue by menu item, and changes against the previous calendar day. Revenue uses the
configured selling price and the saved quantity; each sale retains the per-item price
in effect when it was first recorded, so later menu price changes do not rewrite past
revenue. Items without configured prices are called out rather than counted as zero.
Sales and optional sold-out flags are observational records; they never deduct stock
and do not yet feed a model. No sales are seeded automatically.

Schema migration 3 adds `sales_days`, `sales_lines` (unique date/menu), and
`sales_history` (snapshot, actor, UTC time and version); migration 6 adds the
per-item price snapshot used for revenue. Corrections update one
day atomically with history. Stale versions are rejected. Authenticated GET
`/api/sales?date=YYYY-MM-DD` returns that date and the latest 30 records; POST
`/api/sales` saves a complete five-row form, including explicitly blank rows.
Only the currently implemented owner session can write; staff login is future work.
Partial days are visibly marked and must not be treated as complete training data.
Use the date picker for older records. Run `npm run test:sales` to verify
validation, persistence, correction history, rollback and unchanged inventory.
