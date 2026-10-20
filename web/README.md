# DapurPlan web

Next.js + TypeScript frontend and backend for the DapurPlan hackathon prototype.

## Run locally

```sh
cd web
npm install
npm run dev
```

Open the local URL printed by Next.js. Use Node.js 20.9 or newer.

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
