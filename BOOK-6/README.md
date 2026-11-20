# BOOK-6 · Bachelor 99 Survival Cookbook

This is an editable copy of the BOOK-1 Cookbook page and its book-specific image assets. Its catalog ID is book-6. The page uses the shared BOOKIVO header, search, cart, checkout, contact and assistant modules from the site root.

## Shared purchase flow

- The product key is `book-6`, matching `js/data/books.js`.
- Add to Cart uses `Bookivo.Api.cart.add()`.
- Buy Now opens the shared `Bookivo.Checkout` modal.
- Price and review summary are loaded from the shared mock API.
- Reviews can only be added by signed-in users who own the Cookbook.

The page is served from `BOOK-6/index.html`; its `<base>` path points shared links and assets to the site root. Keep the `images/` assets in this folder when moving or copying BOOK-6.
