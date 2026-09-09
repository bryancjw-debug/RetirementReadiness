# RetirementReadiness

## Household budgets and SRS (September 2026)

- Lifestyle samples are planner-designed illustrations informed by SingStat HES 2023, never official recommended budgets. Its $5,931 all-household and $2,349 solely non-employed age-65-plus household averages describe different populations. Keep the source and category explanation in a tap-to-open dialog. Preserve custom spending when household composition changes.
- Count adult retirement spending once; optional dependant support is additional, inflated from today's SGD and stops when the dependant reaches the selected support-end age. Household spending does not imply that a partner's resources have been entered.
- Cash, ordinary investment and SRS contributions are separate commitments. Keep SRS in the resources/contribution step, and include its monthly equivalent in the take-home plausibility check. Do not deduct these planned SRS contributions again from already-net cash savings.
- Shared SRS rules live in src/utils/srsPlanning.ts. Keep each partner's SRS and tax separate. Contribution citizenship status determines the $15,300/$35,700 cap; retirement tax residency determines withdrawal tax treatment.
- First SRS contribution (not empty account opening) before 1 July 2022 locks age 62, July 2022 through June 2026 locks 63, and from July 2026 uses 64 under current rules. Recheck future statutory changes. Previously begun withdrawal windows are outside this new-window planner.
- Qualifying SRS withdrawals are 50% taxable. Add other entered taxable retirement income before applying current income-tax rates. Incremental SRS tax plus tax on other income must reconcile to total tax, with no second withholding deduction. This model reserves tax in the same annual row and excludes reliefs, rebates and contribution tax refunds.
- The annual cash-liquidation scenario clears SRS in the tenth annual withdrawal row. Legally the residual is deemed withdrawn after the exact ten-year window; physical sale is not always required. State the annual timing approximation and exclude SRS life-annuity mechanics.
- Compare smooth taxable-income and fixed-initial-tenth schedules as illustrative alternatives. Lower estimated tax is not a guarantee of greater wealth or a globally optimal withdrawal recommendation. Show gross, incremental tax and net separately; only net income actually used belongs in the spending-funding stack.
- SRS asset categories document assumptions, not product eligibility guarantees or live yield quotes. Confirm individual instruments with the SRS operator. Other taxable income entered here must not also appear as a custom recurring stream.
- Preserve old saved quizzes when optional fields are absent and validate populated optional objects. Check real individual and couple flows, Excel reconciliation, 320px/390px mobile, both themes, dialog Escape/focus and reduced-motion behavior.
- Relevant official sources: https://www.singstat.gov.sg/publications/households/household-expenditure-survey ; https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/tax-on-srs-withdrawals ; https://www.mof.gov.sg/news-resources/supplementary-retirement-scheme/ . Rules checked 8 September 2026.

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
