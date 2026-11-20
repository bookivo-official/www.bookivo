'use strict';
(function (w) {
  function init() {
    const panel = document.getElementById('chatModal');
    if (!panel) return;
    const form = panel.querySelector('[data-chat-form]');
    const input = form.elements.message;
    const messages = panel.querySelector('[data-chat-messages]');
    const limit = panel.querySelector('[data-chat-limit]');
    const queries = panel.querySelector('.chat-chips');
    const suggestions = panel.querySelector('[data-suggest-toggle]');
    let welcomed = false;
    const welcome = () => {
      if (welcomed) return;
      welcomed = true;
      messages.innerHTML = '<p class="chat-bubble chat-bubble--bot">Hi there 👋 I’m PRIME. Ask me about books, delivery, Bookivo Bits or coupons.</p>';
    };
    async function refresh() {
      const left = await w.Bookivo.Api.chat.remaining();
      limit.textContent = `${left} replies left this hour`;
      input.disabled = left <= 0;
      panel.querySelector('.chat-send').disabled = left <= 0;
    }
    document.addEventListener('click', event => {
      if (event.target.closest('[data-chat-open]')) {
        welcome();
        refresh();
        w.Bookivo.Modal.open(panel);
      }
      if (event.target.closest('[data-suggest-toggle]')) {
        const expanded = suggestions.getAttribute('aria-expanded') === 'true';
        suggestions.setAttribute('aria-expanded', String(!expanded));
        queries.hidden = expanded;
      }
      const chip = event.target.closest('.chat-chips button');
      if (chip) {
        input.value = chip.textContent.trim() === 'Contact support' ? 'How do I contact support?' : chip.textContent.trim();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || input.disabled) return;
      welcome();
      messages.insertAdjacentHTML('beforeend', `<p class="chat-bubble chat-bubble--user">${w.Bookivo.Dom.escapeHTML(text)}</p><p class="chat-bubble chat-bubble--typing">Thinking…</p>`);
      messages.scrollTop = messages.scrollHeight;
      input.value = '';
      try {
        const result = await w.Bookivo.Api.chat.send(text);
        messages.lastElementChild.remove();
        messages.insertAdjacentHTML('beforeend', `<p class="chat-bubble chat-bubble--bot">${w.Bookivo.Dom.escapeHTML(result.reply)}</p>`);
        limit.textContent = `${result.left} replies left this hour`;
        input.disabled = result.left <= 0;
        panel.querySelector('.chat-send').disabled = result.left <= 0;
      } catch (error) {
        messages.lastElementChild.remove();
        messages.insertAdjacentHTML('beforeend', `<p class="chat-bubble chat-bubble--bot">${w.Bookivo.Dom.escapeHTML(error.message)}</p>`);
        limit.textContent = error.message;
      }
      messages.scrollTop = messages.scrollHeight;
      input.focus();
    });
  }
  w.Bookivo.Chat = { init };
})(window);
