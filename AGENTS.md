# RetirementReadiness

- This is the standalone RetirementReadiness repo, not Common Cents. Verify root, branch, remote and working tree before changes.
- Approved visual direction (8 September 2026): Ink & Cobalt, option C. Shared theme tokens live in `src/theme.css`, imported last in `src/main.tsx`.
- Light: neutral #f2f3f5 background, white surfaces, #20242b text, cobalt #2d58b5 actions, visible borders. Dark: #161719 background, #232529 surfaces, #8aafff cobalt actions with dark text.
- Cash uses neutral blue-grey; investments use cobalt; assumptions use restrained gold. CPF and chart series remain distinct. Red denotes deficits/errors, green denotes funded/surplus states, not guaranteed investment outcomes.
- Use category-coloured headers in dark mode and lighter category headers with clear card boundaries in light mode. Inputs remain neutral. Use the shared `QuizNumberQuestion` category prop, not label-text matching.
- Retain the approved 8px card corners and existing quiz flow. Avoid new global palette overrides outside the theme file.
- Dark input headers use subdued category surfaces with light labels and readable helper text; never place white labels on bright pastel headers. Check both themes after transitions settle.
- BHS uses the member's age-65 cohort limit, including users already over 65. Future 4.6% growth is a labelled assumption. New MA inputs use the applicable cap; flag legacy balances above it rather than silently deleting saved money.
- Income is used for CPF, not added to cash. Compare net savings to estimated take-home as a non-blocking warning, not an invented cash-flow deficit. Use the projection engine for allocation previews.
- IP allowance mode is a MediSave usage estimate, not a premium quote. AWLs use age next birthday. Distinguish cash premium required from additional cash expense; honour budget inclusion choices, preserve legacy settings, and always expose additional cash needed when MA is exhausted.
- Preserve projection logic during UI work. Test both individual and couple planning, CPF, assumptions, charts and downloads; verify light/dark and mobile overflow in a browser.
- Run `npm test -- --run`, `npm run build` and dependency audit before release. Do not claim a comprehensive regulatory audit from unit tests alone.
- Publish only when asked. Main workflow validates; GitHub Pages uses `gh-pages`. Publish verified `dist` using the existing gh-pages process, then verify the live asset hash and page. Do not weaken protection or deploy Common Cents by mistake.
