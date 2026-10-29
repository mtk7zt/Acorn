# Website evolution assembly

The supplied update files are assembled under `apps/web/`, the existing frontend location. The legacy root `web/index.html` remains unchanged. The supplied `web/` references in the new CI workflow were updated to `apps/web/`.

## Working local preview

From the repository root:

```sh
cd apps/web
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

The compiled static website is in `apps/web/dist/`. Upload that directory's contents to a static host; configure an index.html fallback for `/design-system`, or use the supported hash route `/#/design-system`.

Demo Mode is enabled by default. No cloud resources, live database migrations, Telegram messages, GitHub workflow dispatches, or public deployments were performed during assembly.

## Integration corrections

- Removed unused imports that failed strict TypeScript compilation.
- Connected the upgraded access form's `onRequestSubmitted` callback to the Founder review queue.
- Added keyboard focus entry, Tab containment, and focus restoration to access, authentication, and legal dialogs.
- Added an executable `npm test` runner for the supplied frontend characterization suite.
- Corrected the new CI workflow's frontend paths and enabled frontend tests before its build.
- Adjusted the expanded navigation so its controls fit small screens.

## Backend boundaries

The original backend files are preserved byte-for-byte. The new `cloudflare-worker/api_v1_routes.js`, migration files, and invitation reference tests are included. The API module is not imported by the original `cloudflare-worker/index.js`, and the existing Wrangler configuration does not bind `ACORN_DB`.

The supplied live API implementation is incomplete: it does not establish a session on invitation redemption, does not implement every API-client endpoint, does not complete atomic invite claiming or recipient enforcement, and does not implement Telegram token consumption. The supplied App and admin handlers still use local demonstration state. The invitation Python tests exercise a reference in-memory registry, not the Worker or a deployed identity provider. They do not establish production readiness or a security certification.

Keep this build in Demo Mode until the backend integration and its authorization/session behavior have been completed and independently verified. The production evolution runbook is supplied design material, not evidence that those services are deployed.

## Verification

- TypeScript and Vite production build.
- Executable frontend characterization suite for redaction, resume suggestion safety, and command mapping.
- Python repository tests, including the supplied invitation registry tests.
- Worker API JavaScript syntax check.
- Forward migration and rollback against a disposable in-memory SQLite database; no live database changed.
- Browser checks of the rendered frontend, documented in the task's completion message.
