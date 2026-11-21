'use strict';
(function (w) {
  function init() {
    document.addEventListener('click', event => {
      if (event.target.closest('[data-contact-open]')) w.Bookivo.Modal.open('contactModal');
    });
    document.addEventListener('submit', async event => {
      const form = event.target.closest('[data-contact-form]');
      if (!form) return;
      event.preventDefault();
      if (!form.reportValidity()) return;
      const message = form.elements.message.value.trim();
      const out = form.querySelector('[data-contact-message]');
      const button = form.querySelector('[type="submit"]');
      if (!message) { form.elements.message.focus(); return; }
      button.disabled = true;
      if (out) out.textContent = 'Sending…';
      try {
        const ticket = await w.Bookivo.Api.support.createTicket({
          name: form.elements.name.value.trim(),
          email: form.elements.email.value.trim(),
          subject: 'Contact Us message',
          topic: form.elements.topic.value,
          message
        });
        form.reset();
        if (out) out.textContent = `Message sent. Reference ${ticket.id}.`;
        w.Bookivo.Toast.show('Your message has been sent.', 'success');
        setTimeout(() => w.Bookivo.Modal.close('contactModal'), 650);
      } catch (error) {
        if (out) out.textContent = error.message;
        w.Bookivo.Toast.show(error.message || 'Message could not be sent. Please try again.', 'error');
      } finally {
        button.disabled = false;
      }
    });
  }
  w.Bookivo.Contact = { init, open: () => w.Bookivo.Modal.open('contactModal') };
})(window);
