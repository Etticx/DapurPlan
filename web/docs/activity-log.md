# Activity log

/activity and authenticated GET /api/activity aggregate existing recipe_versions,
sales_history, daily_expense_history, inventory_history, ingredient_cost_history,
forecasts and preparation_plans. No synthetic
history is invented and source records are not rewritten. Schema setup is reused
on first access; the actual log connection is read-only.

Owners can view the entire kitchen history and filter by owner/staff/system. Staff
are restricted server-side to their own actions, regardless of requested filters.
Actions include creating/correcting sales and expenses, recipe versions, stock batches,
ingredient pack and water costs, forecasts, drafts and approvals. Details show recorded before/after values from the prior
version of that same entity. Forecast details show outputs; a first event has no
previous value. Unchanged saves are explicitly described as no quantity changes.

Filters: from/to (inclusive Malaysia action dates), actor, type, page. Queries use
bound parameters and stable ordering, 20 results per page. Times display Asia/Kuala_Lumpur.
Events remain in their original immutable-by-application history tables. Source
snapshots contain no passwords/session secrets and the endpoint returns only
human-readable details, not full model input or inventory snapshots.

This is application change history, not a tamper-proof security audit. It does not
record failed requests, login/logout, unsaved edits or external database changes.
Demo seeds and synthetic-trained forecasts are labelled. No edit/delete UI is provided.
