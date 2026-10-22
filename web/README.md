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
apply across batches of the ingredient. Owners can record the purchase cost per pack;
these costs are used for recipe cost estimates, not as an inventory deduction or
valuation of remaining stock. Water remains untracked for stock but has an optional
cost-per-litre setting. Pack costs are stored in integer cents; pieces require whole
numbers in stock.

Totals display recorded stock, including expired batches. No demand-based low-stock
claim, forecast, purchase suggestion or automatic stock deduction is implemented yet.
The dashboard stays a preview; preparation planning remains a separate feature.
Migration 7 adds optional ingredient pack cost. Migration 9 adds change history for
the untracked water cost. Run `npm run test:inventory` for isolated seed, validation,
cost persistence and rollback tests.


## Daily sales

Open `/sales` after signing in. Enter whole-number quantities for the five fixed
menus; blank is stored as NULL (not entered), while 0 is confirmed zero sales.
At least one quantity is required per save. Dates follow Malaysia time and cannot
be in the future. Owners configure per-serving selling prices in Recipes and ingredient
purchase pack costs in Inventory. Recipe costs derive from ingredient quantities,
pack sizes and pack costs. Set water cost per litre separately because water is not
stock-tracked. The recipe editor shows ingredient batch costs and estimated cost per
serving; missing prices leave totals explicitly incomplete.

Daily sales show per-menu revenue, ingredient cost for servings sold, and profit
contribution. The P&L totals revenue, ingredient costs, gross profit, manually recorded
other expenses, and estimated net profit. Record expenses by category, amount, and
optional note. Daily, weekly, and monthly trends include revenue, ingredient costs,
expenses, gross profit, and estimated net profit. Expense edits use a version check and
are retained in application history.

Each sale snapshots the selling price, recipe quantities, pack costs and estimated
ingredient cost per serving on first entry. Corrections keep those original cost
snapshots, so later recipe or pack price edits do not rewrite past P&L. Missing selling
or ingredient costs are shown as incomplete, not treated as zero. Sales and optional
sold-out flags never deduct stock and do not yet feed a model. No sales are seeded
automatically.

Schema migrations 3 and 4 add sales records, versioned history and demo provenance;
migration 6 adds per-item selling-price snapshots, and migration 8 adds recipe-cost
snapshots and daily expense/history tables. Sales and expense updates are atomic and
reject stale versions. Authenticated GET `/api/sales?date=YYYY-MM-DD&trend=daily`
returns the selected date, previous day, latest records and requested trend. POST
`/api/sales` saves the complete five-row form; POST `/api/sales/expenses` replaces that
date’s expense list. Owner and staff sessions can record sales and expenses; only
owners can change selling and purchase prices.
Partial days are visibly marked and must not be treated as complete training data.
Use the date picker for older records. Run `npm run test:sales` to verify validation,
price/cost snapshots, expenses, profit aggregation, trends, correction history,
rollback and unchanged inventory.


### Ingredient prices

Inventory has a separate Ingredient prices editor. Owners set MYR per kg, litre, carton of 30 eggs, bag of tea or lemon. Staff can view prices. Demo prices are hypothetical; water is RM0/litre, with its utility bill recorded separately. Blank means unknown. Stock batches still hold closing quantities and expiry dates, while purchase pack sizes determine shopping quantities.

Prices are stored separately in `ingredient_prices`, with version checks and atomic ingredient-cost history. Migration 10 converts existing pack costs once to baseline prices, rounded to the nearest sen. Migration 11 converts existing per-egg prices to a carton of 30 without changing their cost per egg. Subsequent startups preserve saved prices. Recipe costing and new sales use these prices independently of pack sizes. Historical sales keep their original snapshots, including missing costs; this change does not backfill them. The old pack-cost columns and water endpoint remain for compatibility. New screens use the owner-only `save-ingredient-price` action.

Migration 12 changes tea pricing to a bag (RM12 demo). The price screen hides the individual tea-bag count. Internally one price bag contains 100 tea bags, matching the existing purchase pack, so recipes using 10 tea bags still cost RM1.20 in tea. Existing saved prices are converted once, preserving their effective cost per tea bag.
