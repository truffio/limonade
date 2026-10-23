# Ma Super Limonade !

A lemonade-stand business game for kids, in French. It is a static website (TypeScript + three.js) hosted on GitHub Pages.

- Game rules: [`specifications.md`](specifications.md)
- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Epics: [`docs/epics/`](docs/epics/)
- Balance: [`docs/balance.md`](docs/balance.md)

## Development

Requires Node.js 22 (see `.nvmrc`).

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # production build in dist/
npm run preview    # serve dist/ at /limonade/, like GitHub Pages
npm run balance    # bots play many games to check the game balance
```

## Deployment

Every push to `main` is built and published to GitHub Pages by `.github/workflows/deploy.yml`. In the repository settings, set **Pages → Source** to **GitHub Actions**. Day-to-day work happens on `dev`.
