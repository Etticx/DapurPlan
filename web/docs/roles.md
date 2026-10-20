# Prototype roles

Demo login: owner / 123, staff / 123. Both are shared demo accounts, not production
user management. The server derives the role from the authenticated username; clients
cannot select their role. The signed HttpOnly cookie validates the username/role pair.
Existing owner sessions remain valid. Deployment still requires a strong session secret.

Both roles can read the kitchen dashboard, recipes, inventory and plans. Both can
enter and correct sales, recording the actual signed-in username in history.
Staff may add a new stock batch only using an existing owner-defined purchase pack.
They cannot edit existing batches, change packs or load demo stock. Owners retain
stock correction, pack configuration, recipe edits, forecast generation, draft editing
and approval. APIs return 401 for unsigned requests and 403 for restricted role actions.
All permissions are checked on the server; disabled controls are an additional UI cue.

Accounts cannot yet be created, invited or assigned per restaurant. Staff activity
history is stored by the existing stores; an activity-log page is the next feature.
