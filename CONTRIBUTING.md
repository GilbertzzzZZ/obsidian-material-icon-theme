# Contributing

Thanks for your interest in improving this plugin.

## Setup

```bash
npm install
npm run build
```

## What to edit

- **Plugin behavior / settings** — `src/main.ts`
- **Styles** — `styles.css`
- **Icon mappings or build pipeline** — `scripts/build-icons.mjs`

Do **not** commit or hand-edit `src/icon-data.ts` or `main.js`. Regenerate them with `npm run build-icons` or `npm run build`.

## Pull requests

1. Keep changes focused on the issue you are solving.
2. Run `npm run build` before opening a PR.
3. Describe how you tested the change in Obsidian (desktop and/or mobile if relevant).

## Issues

Use [GitHub Issues](https://github.com/GilbertzzzZZ/obsidian-material-icon-theme/issues) for bugs and feature requests. Include Obsidian version, plugin version, and steps to reproduce when reporting bugs.
