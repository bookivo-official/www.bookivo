# BOOKIVO library and sandbox launch guide

## Store service configuration

In Supabase Edge Function secrets set DEEPSEEK_API_KEY to your funded DeepSeek API key, RESEND_API_KEY to your private transactional mail key, and BOOKIVO_FROM_EMAIL to a sender on your verified Resend domain. The guest purchase code expires in ten minutes. Account email continues to use your Supabase SMTP configuration. Use the same verified checkout email to sign in later and read the purchase. The sandbox buyer allowlist still applies.

PRIME uses deepseek-flash. The complete instructions are in PRIME-system-prompt.txt. Visitor messages are stored in bv_contact_inbox. Signed-in support conversations are in bv_tickets and bv_ticket_messages. Both are available for the future protected admin inbox.

## Before opening BOOKIVO to customers

- Publish the storefront ZIP on the final HTTPS address. Set that exact address in Supabase Auth URL Configuration and in the server's BOOKIVO_SITE_URL, including the project path if you host in a subfolder.
- Cashfree checkout is currently sandbox-only in both the browser and the Edge Function. A production release needs the live Orders API, production checkout mode, and customer access in place of the sandbox tester list. Keep the merchant secret in Supabase Edge Function secrets. Keep test orders and library access separate from real customer data.
- Approve the store domain in Cashfree, register the signed webhook in the corresponding merchant environment, then complete a hosted sandbox purchase with a test account. Confirm that the order unlocks exactly one book, failure or cancellation leaves it locked, and re-delivery of the notification cannot award it twice. Decide who handles refunds and how refunded orders affect library access and Bits. The current webhook processes payment events only.
- The project reports email sign-in enabled and Google sign-in disabled. Test delivery and sign-in from a fresh inbox on the hosted site. Enable Google if you keep the Google button.
- The database lists two purchasable ebooks. Replace or hide the ten duplicate catalogue entries before public sales. Publish the grievance contact information, confirm the support channel is monitored, and check that delivery and refund wording matches the experience customers receive.


## What changed

The starting site was a static HTML/CSS/JavaScript storefront. Its cart, product folders, original marketing images, account menu and email-code sign-in already existed. Ownership, reader access, reviews and order outcomes previously depended on browser data. No store tables, private book bucket or store Edge Function existed in the connected project when inspected.

The release keeps the existing catalogue and cart. The implementation sequence was to register real products, establish database ownership, verify payment on the server, connect private file delivery, adapt the original flip reader, then build and test the shelf. Only the two real titles below are enabled for sandbox purchases. The ten editable cookbook copies retain their existing product URLs.

| Area | Files and changes |
|---|---|
| Storefront and navigation | `js/boot.js`, `js/components/shell.js`, `js/pages/runtime.js`, `js/data/books.js`, `BOOK-*/`. Fixed the duplicate catalogue declaration, preserved the five portrait previews, shared byte-identical marketing images and linked account navigation to My Shelf. |
| Sign-in and rewards | `sign in/`, `supabase-config.js`, `js/vendor/supabase/`, `js/api/auth.js`, `js/api/pages.js`, `js/components/scratch-card.js`. The browser SDK is bundled locally. Authenticated progress, balances and one-time welcome claims are stored on the server. |
| Library and reader | `my-books.html`, `css/shelf.css`, `js/pages/shelf.js`, `read.html`, `js/pages/reader.js`, `reader/`. Three shelves, six desktop slots per row, search, sorts, full shelves and the existing ₹25 discovery book. |
| Orders, reviews and support | `js/api/orders.js`, `js/pages/checkout.js`, `js/pages/thankyou.js`, `js/pages/account.js`, `js/api/reviews.js`, `js/api/support.js`. The purchase record controls access and reviews. Signed-in support messages are stored for staff to answer. The help chat provides rule-based store guidance. |
| Database and service | `supabase/migrations/`, `supabase/functions/bookivo-store/index.ts`, `supabase/config.toml`. Versioned schema, including owner-only reads, restricted writes, order settlement, private files and audit events. |
| Other existing resources | `Free calculater/` contains your existing calculator and checks sign-in. The cookbook preview link opens the actual gallery. |
| Verification and deployment | `tests/`, `package.json`, `scripts/export-site.mjs`, `.env.example`. The frontend runs without installing npm packages. The source branch is `main` in the private [www.bookivo repository](https://github.com/bookivo-official/www.bookivo). |

## Supabase and payments

The connected reference is `xwfzuqbkckmmzzidmsgf`. The database registers `cookbook` at ₹99 and `book-2` at ₹25. Amounts are integer paise. Open the [BOOKIVO project](https://supabase.com/dashboard/project/xwfzuqbkckmmzzidmsgf) to see the applied migrations, private bucket and active `bookivo-store` function. Hosted checks returned both books, confirmed the private bucket, and returned HTTP 401 for signed-out access to the store function. Email Auth was enabled. Google Auth was disabled when checked.

1. Sign in, choose Buy Now or use the cart. The browser submits book IDs and its expected total. The Edge Function obtains the authenticated, confirmed user from Supabase. Sandbox order creation requires that user's ID in the tester list.
2. The server verifies the selected books, current ownership, real prices and allowed discounts. Conflicting totals roll back. Repeated attempts reuse an existing matching order. An overlapping order with different discounts can be checked from Order History.
3. The function calls Cashfree's sandbox Orders API and returns the payment session. Checkout uses the official browser SDK in sandbox mode. Cashfree redirects to `thankyou.html?order_id=…`.
4. The signed webhook or a signed-in status check retrieves the order from Cashfree. The service checks buyer ID, order ID, INR amount and a successful payment attempt before granting access. Callback signatures use HMAC-SHA256 over the timestamp and original raw body. Event IDs, order locks and a unique user/book record make repeated delivery safe.
5. Verified payment creates owned books under **Next up**. Opening and reading a loaded page sets **Currently reading**. Use **Mark finished** on the last page or **Mark unread** to reset. Pending, failed, expired and cancelled orders grant no reading access. A dropped attempt can leave an active provider order available for retry.
6. The service records the payment event type, order, timestamps and processing result. Inspect `bv_events` and the function's logs for failed reconciliation. Errors marked for retry can be delivered again. Preserve the same order ID after a network interruption. Configure Cashfree to send payment success, failure and dropped notifications to the webhook listed below. Test provider delivery and retries in the merchant dashboard.

The webhook is reachable by Cashfree without a Supabase session. Its signature is checked inside the function. All account actions separately validate a Supabase bearer token. The database uses RLS for profiles, orders, line items, library entries, support threads and the Bits ledger. Browser clients have no permission to grant ownership or settle an order. The book catalogue and submitted reviews can be read publicly.

See the official [Cashfree hosted checkout](https://www.cashfree.com/docs/payments/online/web/redirect), [Create Order API](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create) and [webhook signature verification](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification).

## Upload your books

1. Extract the **private upload ZIP** locally, separately from the storefront. Open Supabase Dashboard → BOOKIVO project → **Storage → Buckets → bookivo-private-books**. The bucket is already private.
2. Create the folders below. The first level in the bucket must be the book folder itself. Upload the extracted files individually or in batches. A ZIP uploaded as one object cannot serve individual pages.
3. For the portrait book, upload the original PNGs and the supplied private prompt file. For the cookbook, use the prepared filenames. Its source starts at `bookpage0.png` and ends at `bookpage113.png`, so reader page 1 is original page 0. The image bytes are preserved.
4. Keep the reader HTML, CSS and JavaScript on the website. Keep the paid PNGs and prompt file in private Storage. Do not place the upload ZIP in your public website, Git repository or public downloads.
5. With a designated tester, complete a verified sandbox purchase, open My Shelf and select the book. Page 1 should appear. Confirm that signing out and reopening the same reader address takes you to sign-in and that a second account without a purchase sees the product link. If a page is missing, check its exact spelling and folder, upload it, then click **Retry**.

| Product | Private bucket contents | Public reader link relative to the storefront |
|---|---|---|
| ₹25 cinematic portraits · `book-2` | `cinematic-prompts/images/page1.png` through `page30.png` plus `cinematic-prompts/prompts.json` | `read.html?book=book-2` |
| ₹99 Bachelor 99 · `cookbook` | `bachelor-cookbook/images/page1.png` through `page114.png` | `read.html?book=cookbook` |

The reader fetches each page with the signed-in customer's Storage credentials. Storage checks the exact key, page range and a current entitlement on each download. Pages are delivered as temporary in-memory browser blob URLs. The separately delivered archive contains 145 files and preserves the original image bytes. The reader prioritizes the current page, allows three concurrent page requests and retains up to five nearby page images. It loads portrait prompt text privately on demand. Progress updates use a revision number to avoid overwriting newer progress from another device. If another device saves first, reload to resume from its position. An authorized reader can still capture content they have viewed.

The five public preview image files were compared byte for byte with your attachments in the requested order. The supplied page batches total about 284 MiB including prompt text. Supabase Free lists 1 GB Storage, a 50 MB maximum per file, 5 GB uncached egress and 5 GB cached egress per billing cycle. The original portrait pages alone total about 65 MiB, so complete reads can use material bandwidth. The local cache reduces repeated requests near the current page. Monitor Storage, egress, database and Edge usage in the organization's Usage dashboard. [Supabase pricing](https://supabase.com/pricing) · [Upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits) · [Storage bandwidth](https://supabase.com/docs/guides/storage/serving/bandwidth).

**Adding a title.** Add the public product record and approved cover to the catalogue with a unique stable ID. In a new migration insert the matching `bv_books` row with its price in paise, real page count, cover path and unique lowercase storage prefix. Upload the private files under that prefix. Check the first and last page on staging and verify payment before opening sales. Disabling `active` stops new sales while existing owners keep access.

## Deployment and tests

The source was pushed to the private repository on branch `main`. The storefront-only `pages-sandbox` branch was also pushed. GitHub rejected Pages setup with HTTP 422 because the current plan does not support Pages for this repository. The new frontend is ready to upload to an existing HTTPS static host. No custom-domain or DNS change was made. Run `node scripts/export-site.mjs` to produce a static-host directory called `dist`. Publish the contents at the root of your site or its project subpath. Public deployment should contain storefront assets only. Use HTTPS. For hosts that support response headers, use `frame-ancestors 'self'` for the reader, allow same-origin framing, and permit BOOKIVO's Supabase, fonts, blob images and Cashfree sandbox checkout origins in the applicable directives. Test hosted checkout before enforcing a tighter CSP. Files served by GitHub Pages cannot set arbitrary HTTP response headers from the repository.

For database recreation, first link the Supabase CLI to the intended **new** project and apply the migrations in order, then deploy `bookivo-store` with the included configuration. The linked project already has these objects. Enter all merchant secrets in its dashboard. The function intentionally targets the sandbox hostname and rejects a live environment setting. Production requires a separately reviewed live deployment and explicit owner approval. Use separate test and production databases or an explicitly reviewed migration so tester entitlements cannot become real purchases.

To repeat local checks, install Node 24+ and run `npm ci`, `npm test` and `npm run test:browser`. The browser test requires installed Chrome, and accepts `CHROME_PATH` for another executable. Its service responses exist only in a local test. Configure `BOOKIVO_TEST_IMAGES` to the extracted portrait images folder and `BOOKIVO_TEST_PROMPTS` to the private prompt JSON for tests with the original material. These values stay on the tester's computer. The public preview cover serves as the fallback local image fixture.

Pricing tests, migrations in an isolated PostgreSQL engine, ownership and Storage roles, one-time rewards, stale progress rejection, sandbox handler verification and duplicate delivery passed locally. Chrome checks cover storefront startup, the ₹25 product’s Add to Cart and Buy Now flow with a locally intercepted payment session, 360/390/768/1024/1440px widths, empty/1/2/18/21-book collections, search, sorting, expansion, discovery, saved-page resume, page turns, full-page view, exact private prompt text copied to the Windows clipboard, signed-out redirection, reset and missing-file retry. Live merchant payment, real inbox/OAuth completion, physical Android pinch gestures and two-device login require acceptance testing.

Supabase's security advisor reports that the private payment event table has no client-visible policies, consistent with service-only access. The performance advisor lists unused indexes on the new, empty store tables. Recheck actual query usage after traffic arrives. It also reports leaked-password protection disabled. The site uses passwordless email and OAuth. Review password protection before enabling password login. [RLS advisor information](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) · [Auth password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Manual launch checklist

| Area | Actions |
|---|---|
| Supabase | Confirm the intended project. Review Auth URL Configuration and allowed redirects for the actual staging path. Check Email OTP length is six and that both Confirm Signup and Magic Link templates display `{{ .Token }}`. Test SMTP inbox delivery. Enable Google with the credentials below. |
| Cashfree | Use the test merchant account. Configure sandbox credentials, the fully qualified frontend URL and tester UUIDs. Confirm domain approval if required by Cashfree. Configure webhook notifications and run success, pending, dropped, failed and retry scenarios. Inspect the order and corresponding entitlement after each. |
| GitHub | Confirm the private repository and source branch. Use the storefront-only export for static hosting. Verify your own hosting plan supports the intended deployment. Preserve the existing public domain until approval. |
| Ebook images | Upload both extracted folders privately. Check 30 portrait images, 25 prompt entries and 114 cookbook images. Test the first and last page of each book. |
| BOOKIVO frontend | Verify the five original portrait preview images, ₹25 price, cart, account icon, checkout totals, reader and My Shelf from the deployed subpath. Supply your intended `assets/auther.png` and actual YouTube, Telegram and X profiles if ready. Replace the ten catalogue copies as new products become available. |
| Testing | Test a newly verified account, OTP expiry, sign-out, Google, blocked non-owner access, a copied reader link, two-device resume and physical touch gestures. Test purchases using Cashfree's sandbox instruments and verify that skipped or failed payment never grants access. Check support tickets in the dashboard and assign a staff owner. |
| Production launch | Obtain explicit live-payment approval. Configure production merchant credentials and a separately reviewed production integration. Complete an operational review of delivery, refund and customer-support promises. Point the domain only after staging acceptance, enable monitoring and monitor error rates and usage. |

## Configuration and replacement table

| No. | Placeholder / Variable | What It Is | Where to Get It | File or Supabase Setting Where It Goes | Public or Secret | Required |
|---|---|---|---|---|---|---|
| 1 | `BOOKIVO_SUPABASE_CONFIG.url` | Project API URL | Supabase project → Connect → Project URL | `supabase-config.js` | Public | Already set |
| 2 | `BOOKIVO_SUPABASE_CONFIG.publishableKey` | Browser API key | Supabase → Project Settings → API Keys → Publishable key | `supabase-config.js` | Public | Already set |
| 3 | `xwfzuqbkckmmzzidmsgf` | Project reference | Supabase → Project Settings → General → Reference ID | CLI project linking and deployed function URL | Public | Already set |
| 4 | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Built-in Edge environment for Auth requests | Automatically provided in the hosted Edge runtime | Function environment | URL and anon key are public | Automatic |
| 5 | `SUPABASE_SERVICE_ROLE_KEY` | Privileged database access for the function | Supabase injects this into its hosted runtime | Edge Function only | Secret | Automatic |
| 6 | `CASHFREE_APP_ID` | Sandbox merchant app identifier | Cashfree Merchant Dashboard → Test environment → Payment Gateway → Developers → API Keys | Supabase → Edge Functions → Secrets | Server-side merchant credential | Required for checkout |
| 7 | `CASHFREE_SECRET_KEY` | Sandbox secret and webhook signature key | Same Cashfree test API credentials as row 6 | Supabase → Edge Functions → Secrets | Secret | Required for checkout |
| 8 | `CASHFREE_ENVIRONMENT` | Allowed gateway environment | Set the literal value `sandbox` | Supabase → Edge Functions → Secrets | Configuration | Required for checkout |
| 9 | `BOOKIVO_SANDBOX_TESTERS` | Comma-separated UUIDs of permitted testers | Supabase → Authentication → Users → open each verified test user → User UID | Supabase → Edge Functions → Secrets | Private tester configuration | Required for sandbox purchases |
| 10 | `BOOKIVO_SITE_URL` | Exact HTTPS deployment base, including any project path | Copy the staging home address, omitting `index.html` | Supabase → Edge Functions → Secrets | Public value | Required for checkout |
| 11 | Webhook URL | Signed payment notification receiver | Project URL + `/functions/v1/bookivo-store/webhook` | Cashfree test dashboard → Developers → Webhooks. Use `https://xwfzuqbkckmmzzidmsgf.supabase.co/functions/v1/bookivo-store/webhook` | Public endpoint | Required for asynchronous delivery |
| 12 | `bookivo-store`, `verify_jwt=false` | Edge route and per-route authentication | Supplied function files | `supabase/config.toml` and Supabase → Edge Functions | Public configuration | Already deployed |
| 13 | `bookivo-private-books` | Private asset bucket | Supabase → Storage → Buckets | Storage and reader | Public bucket name, private objects | Created |
| 14 | `book-2`, `cookbook`, prefixes and reader route | Stable product and delivery mapping | Product table and upload instructions above | `bv_books` and `read.html?book=…` | Public IDs | Already set |
| 15 | Auth Site URL and redirect allowlist | Allowed sign-in return destinations | Exact frontend URL for each environment | Supabase → Authentication → URL Configuration. Add home, shelf, reader, cart and relevant product/return paths, scoped to your deployment. | Public | Verify per host |
| 16 | Google client ID and secret | OAuth web application credentials | Google Cloud → Google Auth Platform → Clients → Web application. Add the authorized redirect URI `https://xwfzuqbkckmmzzidmsgf.supabase.co/auth/v1/callback` | Supabase → Authentication → Sign In / Providers → Google | Client ID public, client secret private | Required for Google |
| 17 | SMTP host, port, username, app password and sender | Email-code delivery | Your existing mail provider's SMTP settings | Supabase → Authentication → Emails → SMTP Settings | SMTP password secret | Verify delivery |
| 18 | `CHROME_PATH`, `BOOKIVO_TEST_IMAGES`, `BOOKIVO_TEST_PROMPTS` | Local verification paths | Installed Chrome and extracted private upload archive | Local test environment only | Local private paths | Optional |
| 19 | `META_PIXEL_ID` | Existing optional marketing integration | Owner's Meta Events Manager if used | `js/config.js` | Public ID | Optional, blank by default |
| 20 | Host and domain | Existing storefront deployment destination | GitHub repository Settings → Pages or your chosen static host's dashboard | Frontend hosting, DNS and rows 10/15 | Public | Required for public launch |

Cashfree uses the PG secret from row 7 to validate the documented signature. This implementation does not require a separate webhook-secret variable. Keep all real passwords and secret keys in their respective dashboards.

