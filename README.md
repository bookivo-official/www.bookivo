# BOOKIVO

BOOKIVO is the existing HTML, CSS and JavaScript bookstore with a private Supabase library and a Cashfree sandbox checkout. Open the site through an HTTP server. From this folder run `python -m http.server 8000 --bind 127.0.0.1` and visit [the home page](http://127.0.0.1:8000/index.html).

| Entry point | Purpose |
|---|---|
| `books.html` and `BOOK-2/index.html` | Catalogue and the original ₹25 portrait ebook |
| `my-books.html` | Signed-in personal library |
| `read.html?book=book-2` | Private 30-page reader |
| `orders.html` and `thankyou.html` | Order history and server-confirmed payment state |
| `sign in/index.html` | Email-code and configured OAuth sign-in |
| `supabase/migrations` and `supabase/functions/bookivo-store` | Database, access rules, rewards, reviews, support, payment verification |
| `tests` | Local pricing, database, payment and browser checks |

Start with the [setup, file inventory, configuration table and launch checklist](docs/LAUNCH.md). The private ebook upload package is distributed separately to the store owner. Deploy only the storefront assets to the public host.

After editing shared browser modules, run `node scripts/build-storefront.mjs` and commit the generated storefront script alongside the source changes.
