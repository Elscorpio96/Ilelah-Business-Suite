# Ilelah Business Suite — deployment, backup and cost guide (Cloud mode, v1.10)

Everything here is optional per shop. A phone that is never switched stays in **Local mode** and behaves exactly as before.

## 1. What runs where

| Piece | Where | Secret? |
|---|---|---|
| Phone app (APK) | the shop's Android phones | holds only the **public** project URL + anon key |
| Database, logins, row security, sale/stock functions | your Supabase project | database password = secret |
| `create-staff` function | Supabase Edge Function | uses the service key **inside Supabase only** |
| Owner dashboard | any static web host (a folder of files) | public URL, sign-in required |
| Backups | private GitHub repo (Actions) | DB connection string + passphrase = secrets |

The service-role key is never in the app, the dashboard, the zips or the repo. `build.mjs` and `build-dashboard.mjs` refuse to build if one is configured.

## 2. Configuration (environment)

`cloud.config.json` next to `package.json` (not committed, not zipped):
```json
{ "url": "https://<ref>.supabase.co", "anonKey": "<public anon / publishable key>" }
```
Or set `SUPABASE_URL` and `SUPABASE_ANON_KEY` when building. No file/variables = Local-only build.

## 3. First-time setup (once per Supabase project)

1. Create the project (free plan is fine to start; see §8).
2. SQL Editor → run `supabase/migrations/0001` … `0007` in order. **If you already ran 0001–0006, run only `0007_discounts.sql`** (adds discounts, regular-customer %, and cashier same-day price correction) (it also repairs two things found in testing: a function that needed an extension Supabase keeps out of reach, and a retry race on purchases).
3. Authentication → Email enabled, minimum password length 8.
4. `supabase functions deploy create-staff` (see `supabase/SETUP.md`).
5. Build and install the app (`npm run sync`, then your usual signed release). Version 1.10 / versionCode 11.
6. Build and publish the dashboard: `npm run build:dashboard`, upload `dashboard-dist/` to any static host.

## 4. Rolling a shop onto the cloud (recommended order)

1. Install v1.10 on all phones. Nothing changes yet.
2. On the owner's phone: Settings → Cloud account → create the owner account → **Switch this phone to Cloud mode** and follow the steps (backup file → compare → confirm → replace → verify). Keep the backup file.
3. Add staff logins (Settings → Cloud account → Add staff login).
4. Other phones: sign in to the cloud account, then switch. They will show the differences and ask for `REPLACE`, because the cloud already holds the shop's records.
5. Run one pilot shop for a week before moving the next one.

**Rollback for a phone:** Settings → Restore the backup taken before switching (puts back the exact pre-switch records, Local mode). Or *Leave Cloud mode* (keeps what is on the phone, stops syncing, only allowed when nothing is waiting to send).
**Rollback for the whole shop:** every phone has its own pre-switch snapshot plus the backup file the owner saved. Local mode never needed the cloud.

## 5. Backups (the free plan has none of its own)

* **Nightly, automatic:** `.github/workflows/supabase-backup.yml` in a **private** GitHub repo. Add secrets `SUPABASE_DB_URL` (Supabase → Connect → *Session pooler* string; the direct one is IPv6-only) and `BACKUP_PASSPHRASE`. Each night it dumps the shop data **and logins**, encrypts with AES-256, keeps 30 days as a build artifact. The nightly connection also counts as activity, which keeps a free project from pausing.
* **By hand:** `SUPABASE_DB_URL=… supabase/backup/backup.sh ./backups` (needs `pg_dump`).
* **Offsite copy:** once a month download the latest `.gpg` artifact to somewhere that is not GitHub.
* **Phones:** Settings → Save / share backup still works in both modes.
* Paying for Pro adds Supabase's own daily backups (7 days); keep the nightly job anyway.

### Restore (practice this once before you need it)
1. Same project, data damaged: decrypt (`gpg -d file.gpg > file.dump`), then `TARGET_DB_URL=… supabase/backup/restore.sh file.dump` into a fresh project, or into the same project after clearing the `public`/`app` schemas.
2. New project: create it, do **not** run the migrations, run `restore.sh` (it restores logins first, then shop data), point the app build's `cloud.config.json` at it, rebuild.
3. Check: sign in as the owner and run `select cloud_totals();` in the SQL editor; compare with totals you noted earlier.
The drill was run for real on PostgreSQL 16 in testing: same row counts in every table, same money totals, stock still equals its movements, row security and the append-only audit log intact, new sales accepted afterwards.

## 6. Routine care
* Monthly: restore drill into a scratch project or local Postgres; look at database size (Dashboard → Reports → Database).
* Check the sync chip on each phone at close of day: it should say **Synced**. "N failed" means the server refused something; open it and read why.
* Staff leaving: Settings → Cloud account → Disable. Their phone stops being able to sell as soon as it reaches the internet.

## 7. What was tested, and what was not
**Tested (automated, ~370 database/logic checks + ~35 browser checks):** tenant isolation and forged IDs; role limits; atomic stock with sales; idempotent retries; invoice uniqueness; audit log append-only; import with verification; the whole switch including failure and restore; offline queue and restart; 60 parallel sales from 6 connections without deadlock or lost stock; 12 simultaneous copies of one sale, repayment, purchase, stock adjustment or void each applied once; stock never negative under the *reject* policy under a 14-way race; double-tapped import; backup → new database → restore.
**Not yet tested:** a real Supabase project end to end (Auth e-mail flow, the deployed `create-staff` function, realtime), a real Android device with a flaky network, and a shop with years of history on the phone's ~5 MB browser storage (cloud mode keeps full history on the phone; windowing/IndexedDB is future work). Do the pilot in §4 with this list in mind.

## 8. Cost (Supabase pricing page, checked 14 Oct 2026 — prices change; confirm before quoting a customer)

| | Free | Pro |
|---|---|---|
| Price | $0 | from $25/month per project (includes $10 compute credit) |
| Database | 500 MB | 8 GB, then $0.125/GB |
| Downloads (egress) | 5 GB/month | 250 GB |
| Backups | none | daily, 7 days |
| Pausing | after 1 week of no activity | never |
| Realtime | 200 connections, 2M messages | 500, 5M |
| Edge function calls | 500,000 | 2M |

**How far the free database goes.** One sale with its lines, stock movement and audit entries measured about **2.4 KB**. Keeping 30% free for indexes and growth leaves ~350 MB ≈ **150,000 sales** across *all shops in the project*:

| Sales per day (all shops together) | Free plan lasts about |
|---|---|
| 50 | 8 years |
| 100 | 4 years |
| 300 | 16 months |
| 1,000 | 5 months |

Pro's 8 GB holds roughly 2.4 million sales on the same arithmetic. Rule of thumb: **up to ~3 small shops → free is enough for 1–2 years; more than that, or any shop that cannot tolerate a pause → Pro at $25/month**, shared by all the shops in the project (e.g. $5/shop at 5 shops).

**Downloads:** phones ask the server a tiny "has anything changed?" question every minute (≈0.3 KB) and only download what changed; a full refresh happens every 15 minutes at most. Expect tens of MB per phone per month, far below 5 GB. Backups add a few MB per night.

**Other costs:** dashboard hosting on a free static host ($0; confirm that host's current terms), GitHub private repo + Actions for backups ($0 at this size on the free tier; confirm), optional domain name (varies), your own time for monthly checks. SMS/e-mail are not used.

Sources: [Supabase pricing](https://supabase.com/pricing).

## 9. Discounts, history and corrections (v1.10)
* **Discounts:** per line and per sale, as ₦ or %. Stored per line (price before discount + ₦ discount), so receipts, reports, Excel and the cloud all agree. Any cashier may give discounts. Not built: an owner-set cap on how large a cashier discount can be.
* **Regular customers:** a customer can carry a standing %. Typing their name at checkout fills it in; the cashier can change or clear it. Only the owner/manager sets it (Credit → customer, or "Make this their regular discount" at checkout). The server refuses anyone else.
* **History tab:** every user sees the sales they made (owner sees all, with branch filter); Today / Yesterday / 7 days / dates; search by customer, invoice no. or item; tap to reopen, print or share.
* **Corrections:** owner can change price and discount on any sale; a cashier only on their own sale of the same shop-day. Stock is not changed; credit balances recalculate; every change is written to the audit log (cloud).
* Cloud: run `0007_discounts.sql` once; tests `lines` and `discounts` are in `supabase/tests/run-all.sh`.
