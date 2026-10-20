# Preparation, purchases and approval

Tomorrow's plan (/plan) keeps raw model predictions alongside editable whole-serving
preparation quantities. Defaults round each prediction up; the owner can override,
including zero. Shared ingredients are combined in base grams/ml/pieces; countable
requirements round up only after combining. Water is omitted from inventory planning.
Shortage=max(requirement-usable stock,0). Purchase packs round up after subtraction.
Full pack amounts are never substituted for actual ingredient usage.

Batches expired before the target date are excluded. Expiry on the target date is
included but flagged; undated stock is conditionally included with an explicit warning.
Counts older than today's closing date require verification. Allocation prioritises
earliest known expiry, then undated stock. Owner acknowledgement is required for
approval and does not certify food safety or place purchase orders.

Migration 6 adds append-only preparation_plans. Every draft/approval saves quantities,
ingredient totals, purchase suggestions, allocations, exact forecast, recipe versions,
inventory batches/pack sizes, actor and UTC timestamp atomically. Optimistic tokens
reject stale sales, recipes, stock, forecast or concurrent plan edits. Later changes
mark saved decisions out of date; prior approved snapshots remain unchanged.
Editing an approved plan requires a new save/approval. No planning action deducts stock.

GET/POST /api/plan require the current owner session. UI calculations are a preview;
the server independently validates and recalculates everything before saving.
Dashboard shows five menu rows, shopping preview and current approval status.


## Demo expiry setup

The explicit script `npx tsx scripts/fill-demo-expiries.ts` fills only blank expiry
fields on existing demo batches, retaining quantities, counts, packs and history.
It skips non-demo stock and existing dates. New demo seed batches now receive dates
as well. Dates span expired, today, tomorrow and later examples and are entirely
hypothetical, not shelf-life recommendations. Running the app does not roll dates
forward. Changes naturally invalidate the basis of any earlier saved plan.
