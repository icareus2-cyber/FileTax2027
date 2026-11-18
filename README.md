# FileTax — Form 1040 interview

A local Node.js / Express application with SQLite persistence and a guided browser interview. No API key or external AI service is required; the assistant uses a structured questionnaire.

## Run

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Open http://localhost:3000. Run `npm test` for calculation, PDF, and HTTP persistence tests. `npm run dev` restarts the server when source files change. Set `PORT` to change the port and `DB_PATH` to move the SQLite database.

### Static hosting (no Node server)

`public/` also runs on any static file host (GitHub Pages, Netlify, Cloudflare Pages, `python -m http.server`). Upload the contents of `public/` as-is; there is no build step. When `/api/return` does not answer with JSON, the page switches to browser-only mode: the draft is stored in this browser's `localStorage` (key `filetax-draft-v1`) and **Download PDF** is drawn in the page with the bundled `public/vendor/pdf-lib.esm.min.js` (pdf-lib 1.17.1, MIT). Calculations already run in the browser in both modes.

In static mode a draft exists only in that browser profile: clearing site data, a private window, or another device starts empty, and nothing is sent to any server. The security headers set by `server.js` (CSP, localhost-only access) are not sent by a static host unless you configure them there.

## Live return workflow

1. Quick assessment collects optional everyday facts in a compact grid.
2. Strategy & amounts accepts estimated receipts, expenses, contributions, and additional inputs for one business and one rental property.
   On first entry, every blank strategy amount receives a labeled hypothetical example or zero based on the assessment; existing drafts refresh their untouched examples on entry. Unanswered dropdowns use Not sure / skip. Address fields show a not-provided placeholder rather than a fabricated address. A business uses $150,000 of receipts when the user reports more than $100,000, otherwise a $10,000 illustration; example operating costs are 25% of receipts. One-property rentals use $150,000 or $36,000 with illustrative operating costs of 30%. These percentages are arbitrary teaching assumptions, not norms or deduction allowances. Existing amounts are preserved, and IRA interest only seeds a $1,000 planning budget, not an actual contribution.
   Every seeded value, including assumed zero amounts, carries persistent example metadata. Changing assessment answers refreshes untouched example amounts, including prior automatic zeros. Editing an amount removes its example label and preserves that value, including a user-entered zero. Clearing it leaves it blank until the user requests a refill, which uses zero for a previously edited field. Users can fill untouched blanks or remove only the remaining examples. Forms and PDFs warn when hypothetical values remain. Unknown, conflicting, absent, or unsupported activities use zero placeholders rather than positive examples. Automatic zero placeholders do not create business/rental forms or replace manual income totals by themselves.
3. Every edit runs shared validation and rebuilds the form objects locally. Invalid inputs pause previews and downloads; blanks propagate as unknown totals.
4. Valid edits save automatically after a short debounce. Writes are serialized, and obsolete PDF responses cannot replace newer previews.
5. Live line previews show supported forms before download. Enable **Show live PDF preview** to regenerate the official PDFs after edits. Download an individual form or the complete flattened packet from the current validated inputs, without relying on an older saved copy.

### Form dependencies

- Schedule C supports one sole-proprietor business: receipts, refunds, cost of goods sold, other income, aggregate expenses, and home-office expense estimates.
- Schedule E supports one rental property in Part I, with operating costs and depreciation. Loss transfers require an explicit allowable-loss estimate.
- Schedule C / E transfer to Schedule 1. Its additional-income and adjustment totals control Form 1040 lines 8 and 10. Prior manually entered totals remain saved but are excluded while linked forms are active, preventing double counting.
- Estimated deductible IRA contributions feed Schedule 1 line 20. Roth contributions and proposed IRA budgets are not automatically deductions.
- Missing prerequisites leave dependent lines blank. Enter 0 explicitly when an amount does not apply.

### Architecture

`public/return-model.js` defines `TaxReturn`, `TaxForm`, `ScheduleC`, `ScheduleE`, and `Schedule1`. The same objects are used by the browser and server. `public/base-tax.js` contains input validation and 1040 arithmetic; `tax.js` is the server-facing wrapper. `public/live-session.js` serializes autosaves. `form-pdf.js` maps the models to official IRS templates and generates a combined packet. `POST /api/forms` validates a supplied current snapshot and returns JSON, an individual PDF, or a packet; it does not mutate stored answers.

### Scope and limitations

Tax year **2025 only**. Every output is an estimated draft, not a filing-ready return. Validation checks data types, ranges, relationships, and arithmetic; it does not certify eligibility or determine every tax liability.

Income tax, self-employment tax, credits, QBI deductions, depreciation, and allowable losses are supplied estimates or worksheet results. They are not automatically recalculated from updated profit. Review them when income changes. Other schedules (including Schedule SE, Form 8582, and IRA eligibility worksheets), multiple businesses/properties, K-1 activities, and corporate returns are not generated. A declared partnership or corporation blocks the Schedule C income transfer and excludes that Schedule C PDF.

Expense totals are populated on summary lines; category allocations remain incomplete. Other Schedule 1 income/adjustments are likewise aggregates that require allocation. Complete SSNs, dependent information, special-condition checkboxes, spouse identity details, signatures, refund instructions, and remaining schedule details separately. The PDF watermark identifies these outputs as estimates. Changes made to downloaded PDFs are not imported into the application; edit source answers in the app to update all linked forms.

The app uses no LLM or external AI API. IRS-backed strategy suggestions are deterministic and do not approve elections, deductions, contribution limits, or savings estimates.

## Storage and access

The server binds to 127.0.0.1 and restricts hostnames to localhost/127.0.0.1. An HttpOnly SameSite cookie identifies each browser's draft, with Origin checks for writes. There is no login or production authorization system. Do not expose this server publicly. A browser cookie is required to resume a draft; clearing it loses access to that draft. SQLite data is unencrypted. Anyone who can read local files can read answers. The default database is `data/returns.sqlite`; **this workspace is in OneDrive**, so the database may sync. Set DB_PATH to a folder outside OneDrive if needed. Do not enter SSNs or account numbers.

## Sources

- Related official templates: https://www.irs.gov/pub/irs-prior/f1040sc--2025.pdf, https://www.irs.gov/pub/irs-prior/f1040se--2025.pdf, https://www.irs.gov/pub/irs-prior/f1040s1--2025.pdf
- Official PDF bundled in `assets/form1040-2025.pdf`: https://www.irs.gov/pub/irs-prior/f1040--2025.pdf
- Year-specific instructions: https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf
- Screening references: https://www.irs.gov/forms-pubs/about-schedule-b-form-1040, https://www.irs.gov/publications/p590a, https://www.irs.gov/instructions/i1040nr, and https://www.irs.gov/instructions/i1040sh
- Source checked September 28, 2026. Basic standard deduction amounts: single/MFS $15,750; MFJ/QSS $31,500; HOH $23,625. Special deduction cases require a verified manual amount.

## Project structure

`server.js` handles local HTTP, cookies, and SQLite. `pdf.js` fills Form 1040; `form-pdf.js` fills related schedules. `public/` contains shared models and the interview; `test/` verifies live editing, calculations, persistence, isolation, dependent form updates, and PDF field mappings.

`public/storage.js` chooses between the Node API and localStorage. `public/print-pdf.js` draws the printable PDF and is shared by the server (`print-pdf.js` passes it the npm pdf-lib) and the browser (vendored pdf-lib). The Node server is still needed for the official IRS-PDF endpoints (`/api/pdf`, `/api/forms`), which the current page does not call.
