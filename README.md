# Personal Wealth Dashboard

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 20.9+](https://img.shields.io/badge/node-%3E%3D20.9-339933.svg)](https://nodejs.org)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Data: Google Sheets](https://img.shields.io/badge/data-Google%20Sheets-34a853.svg)](#step-2-create-your-workbook)

A private dashboard for your net worth and your cashflow. 
<br/>Your data lives and stays in your Google Sheet. The app reads the sheet, adds prices and exchange rates saved on your computer, and shows tables and charts.

Developed by [Giacomo Maggiore](https://giacomomaggiore.com). Open source, [MIT license](LICENSE).

![Net worth dashboard: trend, asset table and benchmark comparison](docs/images/networth.png)

![Cashflow dashboard: monthly trend and summary table](docs/images/cashflow.png)


Contents:

1. [Intro](#intro)
2. [Project philosophy](#project-philosophy)
3. [Setup](#setup)
4. [Usage](#usage)
5. [Contributing](#contributing)
6. [Appendix](#appendix): [A. Workbook reference](#a-workbook-reference), [B. Demo mode and the seed](#b-demo-mode-and-the-seed), [C. Troubleshooting](#c-troubleshooting), [D. Code layout and commands](#d-code-layout-and-commands)
7. [Disclaimer and license](#disclaimer-and-license)

## Intro

You manually insert your data into  Google Sheet and the app only reads it (no internal/exteral database and the app stores nothing about your finances).
<br/>Two main views are in place are ready:
  - **Cashflow** (`/`): income, expenses, savings and savings rate by month
  - **Net worth** (`/networth`): net worth over time, a table of every asset, a benchmark comparison and monthly rankings.

Note that you are the only one seeing real amounts. Everyone else who opens the app sees randomized amounts. See [Appendix B](#b-demo-mode-and-the-seed).

(WIP: `/saa`, `/montecarlo` and `/docs` views)

---

The app is built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts, `googleapis` (Google Sheets), Auth.js (`next-auth` 5, beta). Prices and exchange come from Yahoo Finance.

## Project philosophy

Google Sheet is the only source of true: you enter there each fact once, in a plain format you can read anywhere, the the app never changes your sheet.<br/>
All calculations are plain deterministic functions: the same input always gives the same result and the pages only draw the results.... so, yes: _there's no Gpt, Gemini or similar: you have to put the work and expect boring metrics and summaries, no fluff AI insights._ 
<br/>Prices and exchange rates are files on your computer and can refreshed with one command.

### What you track

The idea is that in `assets` you write what you hold at the end of each period, usually the end of the month _(for a ticker you write the number of units, For cash you the balance, for anything else you write a value, then the app turns units into money with the price of that date)._

For cashflow, only money that comes in/out of your portfolio is recorded with the following logic:
  - salary and other income: `income` _(optional subcategory allowed)_
  - spending: `expense` _(optional subgategories allowed)_
  - money you move into your invested portfolio: `contribution`.
  - money you take out of it: `income` with the category `withdrawal`.

_(Note that every amount has a corresponding currency that uses the exchange rate of its own date)_

Do not record purchases, sales, dividends fees or taxes of the investment/broker platform, since contributions should not be considered as spending: they are left out of income, spending, savings  and category reports and they only count in performance comparison with the benchmark.

Furthermore, the app compares your financial instruments with a 60/40 portfolio _(ACWI and BND)_ and with 100% stocks _(ACWI)_ by replicating contributions and wihdrawals and assuming reinvested dividends. Cash and manually valued assets are not included. 


## Setup

Steps 1 to 7 give you a working app on your computer _(eventually: you can host it on Vercel at almost-zero extra-cost)_. Steps 8, 9 are optional.

Note that NO paid service is needed.

### Step 1. Get the code

```bash
git clone https://github.com/giacomomaggiore/nw.git
cd nw
npm install
npm test
```

`npm test` needs no setup. It uses fake data only. It should pass. One test checks that a calculation runs in under 200 ms, so it can fail on a slow or busy machine. Run it again if that happens.

### Step 2. Create your workbook

The workbook is a Google Sheet with six tabs.

1. <a href ="https://docs.google.com/spreadsheets/d/1Yd84qpGreXoR8UZNV3eCdF0E2qKZmSZTlyw0KR6ic50/edit?usp=sharing" target="_blank"> Open the Google Sheet template here</a> then click:
  *File → Make a copy*.
   If you do not have the template, create a new sheet and build the tabs by hand from [docs/workbook.md](docs/workbook.md).
2. Keep the tab names exactly: `cashflow`, `assets`, `categories`, `metadata`, `saa`, `constants`. 
3. Keep the header rows. Replace the example rows with your own data.
4. In `constants`, set at least `CURRENCY_1` to `EUR`, `CHF` or `USD`.
5. Dates must be real dates in the sheet, not text.

Every tab needs its header row and at least one data row (the `constants` tab has no header row).

| Tab | What it holds | Columns |
| --- | --- | --- |
| `cashflow` | One row per transaction | `DATE`, `TYPE`, `NAME`, `AMOUNT`, `CURRENCY`, `CATEGORY`, `SUBCATEGORY`, `NOTES` |
| `assets` | One row per asset, one column per period | `ASSET`, `DATATYPE`, `CURRENCY`, `ACCOUNT`, then one date per period |
| `categories` | Your expense and income categories | `CATEGORY`, `PARENT_CATEGORY`, `IS_ESSENTIAL`, `IS_RECURRING` |
| `metadata` | Names and fees of the tickers in `assets` | `TICKER`, `DISPLAY_NAME`, `FULL_NAME`, `CURRENCY`, `TER`, `ISSUER` |
| `saa` | Target allocation by period (no page uses it yet) | `ASSET_CLASS`, `INSTRUMENT`, then one date per period |
| `constants` | Settings: key in column A, value in column B | No header row |

The full rules and example rows are in [docs/workbook.md](docs/workbook.md).

### Step 3. Create a Google service account

The app reads your sheet with a service account. This is a robot account that only has the access you give it.

1. Open [console.cloud.google.com](https://console.cloud.google.com). Pick a project, or create one with *New project*.
2. Go to *APIs & Services → Library*. Search for *Google Sheets API* and click *Enable*.
3. Go to *IAM & Admin → Service Accounts → Create service account*. Give it any name. You do not need to give it a role.
4. Open the new account. Go to *Keys → Add key → Create new key → JSON → Create*. A JSON file downloads.
5. Open the JSON file. You need two values: `client_email` and `private_key`.
6. Open your Google Sheet. Click *Share*. Paste the `client_email` and give it **Viewer** access.
7. Keep the JSON file outside the repository. Never commit it or paste it anywhere.

### Step 4. Create `.env.local`

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in these five values:

| Variable | Value |
| --- | --- |
| `GOOGLE_SHEET_ID` | The long id in your sheet URL: `docs.google.com/spreadsheets/d/<ID>/edit` |
| `GOOGLE_CLIENT_EMAIL` | `client_email` from the JSON file |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON file, on one line, in double quotes, with the `\n` characters kept: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"` |
| `AUTH_SECRET` | A random string. Create one with `openssl rand -base64 32` |
| `DEMO_SALT` | Another random string, made the same way. It is used for the demo-mode random number. Do not change it later without a reason: every seed then gives a new result ([Appendix B](#b-demo-mode-and-the-seed)) |

`.env.local` is ignored by git. Never commit it, and never print or share these values.

### Step 5. Check the workbook

```bash
npm run test:sheets
```

This reads all six tabs and checks them against the rules in [docs/workbook.md](docs/workbook.md). It lists every problem with its row number. It also runs the app's own parsers, so if this passes, the pages can read your data. Fix the sheet until it passes.

### Step 6. Download market data

```bash
npm run download:market-data
```

This downloads daily prices and exchange rates from Yahoo Finance and saves them in `data/market-data`. It downloads:

- Every `ASSET` in `assets` with the datatype `quantity`. The `ASSET` value must be a Yahoo Finance symbol, for example `VT` or `IWDA.AS`.
- `ACWI` and `BND`, for the benchmark.
- An exchange-rate pair (for example `EURCHF=X`) from every currency in your workbook to every report currency.

The history starts at the earliest date in your workbook. The script waits half a second between symbols, so it can take a minute or two. If Yahoo refuses a request, run it again.

_Note that the file names are your tickers, so if you publish your own copy of this repository, anyone can see which instruments you track._

### Step 7. Run the app

```bash
npm run dev
```

This runs `npm run test:sheets` first, then starts the app at [http://localhost:3000](http://localhost:3000). Open `/` for cashflow and `/networth` for net worth.

Note that **all amounts will look wrong**, but do not panic: this is expected. <br/>Right now you are a visitor without access, so the app shows demo values: every amount is multiplied by a random factor.<br/>To see your real values, pick one of two ways:

- **Option A: lucky seed (quick, no Google sign-in).**
  1. In the `constants` tab, add a row. Column A: `LUCKY_SEED`. Column B: a long phrase, for example four random words.
  2. In the app, type the same phrase in the *Seed* box in the navbar and click *Apply*. It is case-sensitive.
  3. The warning icon disappears and you see real values.

  _(The sheet is cached for a few minutes, so wait a little if it does not work at once)_
- **Option B: Google sign-in.** See step 8.

### Step 8. Optional: Google sign-in

With this you sign in with your Google account, and the app shows real values to the emails you allow. You do not need it if you use the lucky seed.

Google sign-in uses an OAuth client. It is a different credential from the service account in step 3. It can live in the same Cloud project.

1. In the Cloud Console, open *APIs & Services → OAuth consent screen*. It may be called *Google Auth Platform*. Click *Get started* if it asks.
2. **Branding.** Fill in the app name (for example `Net Worth`), your user support email and your developer contact email. Links to a home page, privacy policy and terms are optional while the app is in Testing.
3. **Audience.** Choose **External**. Leave the publishing status on **Testing**. In Testing, only the accounts listed under *Test users* can sign in. Add your own Gmail address there.
4. **Data access.** Keep the default scopes: `openid`, `userinfo.email` and `userinfo.profile`. Never add Sheets or Drive scopes. The service account reads the sheet, not your login.
5. **Create the client.** Go to *Clients → Create client*. Choose **Web application**. Leave *Authorized JavaScript origins* empty. Under *Authorized redirect URIs* add exactly:
   `http://localhost:3000/api/auth/callback/google`
   There must be no trailing slash. If you run on another port, add that port too.
6. Click *Create*. Copy the **Client ID** and the **Client secret**. Google may not show the secret again.
7. In `.env.local`, remove the `#` in front of `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, and paste the two values.
8. In the `constants` tab, add a row. Column A: `ALLOWED_EMAILS`. Column B: your emails in **one cell**, separated by commas, for example `you@gmail.com, partner@gmail.com`. Never use one row per email: rows with the same key overwrite each other.
9. Restart `npm run dev`. Click the red `?` in the navbar and sign in. The border turns green. If your email is on the list, you see real values and the *Seed* box disappears.

Good to know:

- Only verified Google emails can sign in. The allowlist is checked on the server for every request.
- If the app cannot read the allowlist, nobody gets real data.
- Google may show "Google hasn't verified this app". Click *Advanced*, then *Continue*.
- The allowlist is cached for a few minutes. A removed email loses access within that time.
- Anyone who can edit your workbook can change the allowlist. Share the workbook read-only with everyone but yourself.
- If you publish the OAuth app, any Google account can sign in, but only allowlisted emails see real data. Write real text in `/privacy` and `/ts` first.

### Step 9. Optional: deploy

You do not need to deploy. Running the app on your own computer is the safest option. But... _If you want a public address:_

1. Read the limits in [Appendix B](#b-demo-mode-and-the-seed). The demo mode hides amounts only. Names, dates, tickers and ratios stay visible.
2. Use a host that runs Next.js, for example Vercel. Set the same variables from `.env.local` in the host settings. `.env.local` is not deployed.
3. Also set `AUTH_TRUST_HOST=true`. It is needed on a proxied host and for `npm start`.
4. In the OAuth client, add the redirect URI `https://<your-domain>/api/auth/callback/google`.
5. `data/market-data` is in git, so the host already has the price files. Run `npm run download:market-data`, commit the changed files and push.
6. Fill in `ALLOWED_EMAILS` and, if you want it, a long `LUCKY_SEED` in `constants`.

To test a production build on your computer: `npm run build && npm start`.

## Usage

Do this after each change to your data.

1. **Update the sheet by hand.**
   - Add new transactions to `cashflow`.
   - Add a new date column to `assets` with the units, balances and values for the period.
   - Add new tickers to `metadata`.
   - Keep `cashflow.CATEGORY` equal to a value in `categories.CATEGORY`, or leave it blank if you are not sure.
2. **Check it**: `npm run test:sheets`. `npm run dev` does this for you when it starts.
3. **Refresh market data**: `npm run download:market-data`. Run it after you add a ticker or a currency, after you add a new period, and from time to time.
4. **Start the app**: `npm run dev`.

---

Good things to know:

- You can add empty date columns for future periods in `assets`, they are ignored until an asset has a value in them, periods without data show `—`.
- The app reads the sheet on every page load, so a data change shows after a reload. `LUCKY_SEED`, `ALLOWED_EMAILS`, `APP_NAME` and `APP_DESCRIPTION` are cached for a few minutes.
- If a price file ends before today, the app asks Yahoo for the missing days while rendering. It keeps them in memory only and never saves them. If the request fails, it uses the saved rows. Do not rely on this: run the download regularly.

## Contributing

Issues and pull requests are welcome, but please, _before doing so, read [CLAUDE.md](CLAUDE.md) first, it has the workbook and the code rules.

Then, before you open a pull request, run:

  ```bash
  npm run lint
  npx tsc --noEmit
  npm test
  ```

Add or update a test for every change to a parser, a calculation or the market-data code. Tests use fake data only.

---

## Appendix

### A. Workbook reference

The full rules and example rows for the six tabs are in [docs/workbook.md](docs/workbook.md). The overview of the tabs is in [step 2](#step-2-create-your-workbook).

### B. Demo mode and the seed

Anyone who is not allowed to see your real data sees demo values. Demo mode multiplies every money amount by one random factor between 0 and 10. The factor comes from a seed.

**Who sees what**

| Visitor | Result |
| --- | --- |
| Signed in, email on `ALLOWED_EMAILS` | Real values. The *Seed* box is hidden |
| Seed equals `LUCKY_SEED` | Real values |
| Anyone else, signed in or not | Demo values |
| The app cannot read the allowlist | Demo values |
| `DEMO_SALT` is missing and the visitor has no real access | The amount pages show an error. They never fall back to real values |

**The seed**

- The navbar has a *Seed* box. Type any text (up to 64 characters) and click *Apply*. An empty box means the default seed `1`.
- The seed is saved in a cookie that only the server can read, so it stays for every page and every reload.
- The same seed always gives the same factor. Different seeds give unrelated factors: `9` and `10` have nothing in common.

**The random number**

The factor is made from the seed and `DEMO_SALT`. The code is in `src/lib/demo/multiplier.ts`:

```ts
const DEMO_MULTIPLIER_MAX = 10;

function demoMultiplier(seed: string, salt: string) {
  const digest = createHmac("sha256", salt).update(seed).digest(); // HMAC-SHA256(key = salt, message = seed)
  return (digest.readUIntBE(0, 6) / 2 ** 48) * DEMO_MULTIPLIER_MAX; // first 6 bytes -> number in [0, 1) -> [0, 10)
}
```

In words:

1. Compute HMAC-SHA256 with `DEMO_SALT` as the key and the seed as the message.
2. Read the first 6 bytes as a whole number and divide it by 2^48. The result is between 0 and 1.
3. Multiply by 10. The factor is between 0 and 10, and every value in that range is equally likely.

Without the salt, a visitor cannot work out the factor for a seed. Changing `DEMO_SALT` changes the factor of every seed.

**What is multiplied**

The app multiplies the data it reads from your sheet, before any calculation. It multiplies asset quantities, cash balances, manual values and transaction amounts. Prices and exchange rates are not changed. Because of this, every total, chart and table stays consistent with the others.

These are not changed: percentages and returns, counts, dates, names, categories, tickers and account names.

**Limits. Read this before you put the app on the internet.**

- Ratios stay real, so the shape of your portfolio and spending stays visible.
- A script can try many seeds. The largest result it sees gets close to 10 times the real value. So someone can estimate your real amounts.
- `LUCKY_SEED` can be guessed if it is short. There is no limit on attempts.
- Names, tickers, account names, categories and dates are not hidden.
- Treat demo mode as casual hiding, not as protection. Do not publish data you cannot afford to leak.

More detail is in [docs/how-it-works.md](docs/how-it-works.md#demo-mode).

### C. Troubleshooting

Every message and its fix is in [docs/troubleshooting.md](docs/troubleshooting.md). The three most common problems:

- **`npm run dev` stops right away.** `npm run test:sheets` found a problem in the workbook. Read the list and fix the sheet.
- **The amounts look random.** You see demo values. See [step 7](#step-7-run-the-app).
- **A change has no effect.** Changes to `.env.local` need a restart of the server. `LUCKY_SEED` and `ALLOWED_EMAILS` are cached for a few minutes.

### D. Code layout and commands

```text
Google Sheets + data/market-data → lib/sheets + lib/market-data → lib/analytics → app route → components
```

| Path | What it holds |
| --- | --- |
| `src/lib/sheets` | The only code that talks to Google Sheets. Parsing and checks |
| `src/lib/market-data` | Reads the local price files and converts values |
| `src/lib/analytics` | Pure calculations. No I/O, no React |
| `src/lib/auth`, `src/lib/demo` | Sign-in, access rules and the demo multiplier |
| `src/app` | Pages and loaders (server components) |
| `src/components` | Tables and Recharts charts |
| `scripts` | `download-market-data.ts` and `test-google-sheets.ts` |
| `tests` | Tests with fake data |
| `data/market-data` | Downloaded price files |
| `docs` | [How it works](docs/how-it-works.md): technical notes |

| Command | What it does |
| --- | --- |
| `npm run dev` | Checks the workbook, then starts the app on port 3000 |
| `npm run build`, `npm start` | Production build and server |
| `npm test` | Test suite. No setup needed |
| `npm run test:sheets` | Checks the live workbook |
| `npm run download:market-data` | Refreshes the price files |
| `npm run lint` | ESLint |

More: [docs/how-it-works.md](docs/how-it-works.md) (technical notes) and [CLAUDE.md](CLAUDE.md) (rules for the code and the workbook).

## Disclaimer and license

This is a personal tracking tool. It is not financial advice. Numbers can be wrong, for example when a price is missing, so check the warnings before you rely on a result. Market data comes from an unofficial Yahoo Finance endpoint. Check the Yahoo terms for your use. The code that downloads it is in `scripts/download-market-data.ts` and `src/lib/market-data/yahoo.ts`, so you can replace the provider.

Released under the [MIT license](LICENSE). Developed by [Giacomo Maggiore](https://giacomomaggiore.com).
