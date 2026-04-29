# Get Driver in Vietnam — Operations App

Next.js app for managing reservations, dispatch, fleet, finance, and quotations.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build (self-check before deploying)

```bash
npm run lint
npm run build
npm run start
```

## Deployment (Vercel)

1. Push this repo to GitHub.
2. In Vercel, create a new project from the repo.
3. Framework preset: **Next.js**
4. Build command: `npm run build`
5. Output: Vercel auto-detects.
6. Deploy.

## Notes

- PDF routes require bundled fonts in `public/fonts/` (Noto Sans).
- The app currently stores most data in browser storage (demo mode). A Firebase migration plan can be added for multi-user realtime.
