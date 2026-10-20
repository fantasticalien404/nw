# Troubleshooting

Find your message or symptom in the tables below. For the setup steps, see the [README](../README.md#setup).

## Workbook and Google Sheets

| Message or symptom | Cause and fix |
| --- | --- |
| `Google Sheets environment variables are not configured.` or `Missing required environment variable` | `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL` or `GOOGLE_PRIVATE_KEY` is missing in `.env.local`. Add it and restart |
| `error:1E08010C:DECODER routines::unsupported` | `GOOGLE_PRIVATE_KEY` is not valid. Paste the whole `private_key` value on one line, in double quotes, with the `\n` characters |
| `The caller does not have permission` | The sheet is not shared with the `client_email` of the service account. Share it as Viewer |
| `Requested entity was not found` | `GOOGLE_SHEET_ID` is wrong |
| `Google Sheets API has not been used in project ... or it is disabled` | Enable the Google Sheets API in the project of the service account ([step 3](../README.md#step-3-create-a-google-service-account)) |
| `Unable to parse range: <tab>!...` | A tab is missing or its name is wrong. Use the six exact names |
| `npm run dev` stops right away | `npm run test:sheets` found a problem. Read the list and fix the sheet. To start without the check, run `npx next dev` |

## Market data

| Message or symptom | Cause and fix |
| --- | --- |
| `Download market data for <symbol> with npm run download:market-data.` | The price file for that symbol is missing. Run the download. If it fails for that symbol, check that `ASSET` is a valid Yahoo Finance symbol |
| A cell shows `—` and a warning appears above the table | The app has no price or exchange rate for that asset and date. Run the download and read the warning. The totals are too low until it is fixed |

## Access and sign-in

| Message or symptom | Cause and fix |
| --- | --- |
| A page shows `Set DEMO_SALT in the environment.` | `DEMO_SALT` is missing, or the server was not restarted after you added it |
| `MissingSecret` in the server log | `AUTH_SECRET` is missing. Add it and restart |
| Real values do not appear after I change `LUCKY_SEED` or `ALLOWED_EMAILS` | The sheet is cached for a few minutes. Wait and reload |
| `Error 400: redirect_uri_mismatch` | The redirect URI in the OAuth client is different from the one the app uses. It includes the port. Add the exact URI shown in the error |
| `Error 403: access_denied` | The OAuth app is in Testing and the account is not a test user. Add it under *Audience → Test users* |
| "Google hasn't verified this app" | Expected for a personal app. Click *Advanced*, then *Continue* |
| `UntrustedHost`, or "There is a problem with the server configuration" | Set `AUTH_TRUST_HOST=true`. It is needed with `npm start` and on a proxied host |
| Sign-in works on localhost only | The production redirect URI is not registered, or the host is missing the environment variables |
| The seed does not stay on `npm start` over plain http | In production the seed cookie is `Secure`. Use https. Chrome accepts it on `localhost` |
