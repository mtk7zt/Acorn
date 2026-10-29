# Acorn web experience

The updated React/TypeScript application lives here, alongside the existing Acorn backend at the repository root. The eight product documents are in `../../docs/`.

## Run

Use Node.js 22 or newer:

```sh
cd apps/web
npm ci
npm run dev
```

For a production build and local preview:

```sh
npm run build
npm run preview
```

Upload the contents of `dist/` to a static host. Configure the host to serve `index.html` for frontend routes such as `/design-system`. The hash routes `/#/app` and `/#/design-system` also work without a fallback rule. Serve the build over HTTP rather than opening the HTML file directly.

## Demo and integration boundaries

Signals, conversation, watch preferences, and activity use the supplied demonstration data and client-side state. Fit Check and identifier redaction run in the browser. Request Access shows an explicit demo acknowledgement by default and does not persist a request.

To enable the supplied access endpoint integration, copy `.env.example` to `.env.local`, set `VITE_DEMO_MODE=false`, and configure `VITE_ACCESS_WEBHOOK_URL` to your own endpoint. Rebuild after changing environment variables. Client-side `VITE_` values are public; never put secrets in them.

The existing Python, Cloudflare Worker, Terraform, legacy web, and workflow files are preserved from the supplied ZIP. Their live deployment status and external channel integrations were not verified as part of assembling the frontend. The supplied product documents describe both current systems and intended behavior; they are not a fresh infrastructure audit.

## Assembly verification

Run the supplied frontend characterization checks with `npm test`. They cover identifier redaction, truthful resume suggestions, and natural-language command mapping. The product CI workflow now uses `apps/web/` and runs these checks before building.

The evolution update adds 15 mascot poses, Mini-Acorn Scouts, Founder/Invite dialogs, a session-only review queue, invitation minting/redemption, and legal/storage dialogs. In Demo Mode, any 4+ character sandbox passphrase opens the Founder sandbox; this is not production authentication. Requests and invitations reset on reload. Legal documents are supplied draft content for review.

See `../../docs/ASSEMBLY_VALIDATION.md` for the integration boundaries and verification record. The new Worker API module and migration files are included as scaffolding; the original Telegram gateway is preserved. Changing environment variables alone does not complete or deploy the live backend.
