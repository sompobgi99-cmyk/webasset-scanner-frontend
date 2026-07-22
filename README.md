# Webasset Scanner Frontend

Static frontend for the decoupled ITAM QR scanner.

This public repo contains only the frontend files. Scan logs should stay in the private `webasset-scan-logs` repository.

GitHub Pages URL after publishing:

`https://sompobgi99-cmyk.github.io/webasset-scanner-frontend/`

Isolated Staging frontend:

`https://sompobgi99-cmyk.github.io/webasset-scanner-frontend/staging/`

The Staging path uses its own GAS deployment and Supabase project. Publishing
it does not replace the files or configuration at the Production root path.

## Deploy safety

GitHub Actions runs `node scripts/sanity-check.js` on every push to `main` before deploying Pages. The check verifies required static files, lazy module markers, GAS Web App configuration, obvious secret leaks, and bundle size budgets.

For automatic deployment through the workflow, set repository **Settings > Pages > Build and deployment > Source** to **GitHub Actions**.

## GitHub workflow

- `Regression QA` checks generated version consistency, authenticated navigation,
  accessibility, mobile overflow, and Scan to Map on portrait and landscape phones.
- Run the same checks locally with `npm ci` followed by `npm run test:ci`.
- Issue templates are available for bugs, mobile scan problems, and feature requests.
- Release notes can be created from **Actions > Create Release Notes** by entering a tag such as `v2026.05.27-settings-user-opt-v45`.
- Pushing a tag that starts with `v` also creates release notes automatically.
