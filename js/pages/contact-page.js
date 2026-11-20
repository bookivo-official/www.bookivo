'use strict';
(function (w) {
  const B = w.Bookivo;
  function init() {
    const root = document.getElementById('pageMain');
    root.innerHTML = `<section class="page-heading"><p class="eyebrow">Help and support</p><h1>Contact Bookivo</h1><p>Sign in to send a message and follow replies under Support tickets. For order or refund questions, include your order ID.</p></section><form class="form-panel bookivo-block" data-contact-form><label>Full Name<input name="name" autocomplete="name" required maxlength="100" placeholder="Your name"></label><label>Email Address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>Message<textarea name="message" required maxlength="1000" rows="5" placeholder="How can we help?"></textarea></label><p class="form-message" data-contact-message aria-live="polite"></p><button class="btn btn-shine" type="submit">SEND MESSAGE</button></form>`;
  }
  B.PageHandlers.contact = init;
})(window);
