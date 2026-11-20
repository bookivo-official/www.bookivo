# BOOK-1 · Bachelor 99 Survival Cookbook

This folder contains the Cookbook page and its book-specific image assets. BOOK-2 through BOOK-12 are editable copies of this folder. Each copy uses a separate catalog ID while sharing the same current title, images, price and page content. The page uses the shared BOOKIVO header, search, cart, checkout, contact and assistant modules from the site root.

## Shared purchase flow

- The product key is `cookbook`, matching `js/data/books.js`.
- Add to Cart uses `Bookivo.Api.cart.add()`.
- Buy Now opens the shared `Bookivo.Checkout` modal.
- Price and review summary are loaded from the shared mock API.
- Reviews can only be added by signed-in users who own the Cookbook.

The page is served from `BOOK-1/index.html`; its `<base>` path points shared links and assets to the site root. Keep the `images/` assets in this folder when moving or copying BOOK-1.
