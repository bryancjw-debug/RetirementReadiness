# RetirementReadiness

A focused retirement projection mini-app for estimating whether retirement funds can last through a selected age.

## Features

- Separate cash savings and investment buckets
- Regular savings and investment contributions
- Optional future one-time capital injection
- Passive income, fixed drawdown, or dynamic drawdown methods
- Optional Singapore CPF and CPF LIFE projection
- Year-by-year projection table
- Mobile-friendly chart scroll areas

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm test -- --run
npm run build
```

Projection figures are estimates and not financial advice. CPF LIFE payouts are estimated unless the user provides a known payout from CPF's official estimator.

## CPF and insurance refinements

The guided CPF questions distinguish mandatory employment contributions, self-employed
MediSave based on annual Net Trade Income, voluntary three-account contributions and
retirement-only RSTU cash top-ups. Optional premiums use labelled age-based estimates.
See [the release audit](AUDIT-2026-09-03.md) for sources, tests and model limitations.

## Publishing

GitHub Pages serves the root of `gh-pages`, not `main` or `docs`.
The main-branch workflow validates tests and uploads a build artifact only.
After local and browser verification, publish the contents of `dist` with `.nojekyll`
to `gh-pages`, keeping its history. Confirm the Pages run succeeds and the live
HTML references the newly built asset hashes. Do not change environment protections.
