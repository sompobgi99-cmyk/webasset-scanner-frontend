# Webasset Scanner Frontend

Static frontend for the decoupled ITAM QR scanner.

This public repo contains only the frontend files. Scan logs should stay in the private `webasset-scan-logs` repository.

GitHub Pages URL after publishing:

`https://sompobgi99-cmyk.github.io/webasset-scanner-frontend/`

## Deploy safety

GitHub Actions runs `node scripts/sanity-check.js` on every push to `main` before deploying Pages. The check verifies required static files, lazy module markers, GAS Web App configuration, obvious secret leaks, and bundle size budgets.

For automatic deployment through the workflow, set repository **Settings > Pages > Build and deployment > Source** to **GitHub Actions**.
