'use strict';
(function (w) {
  const B = w.Bookivo;
  const script = document.currentScript;
  const stylesheet = new URL('../../css/prime.css', script.src);
  function init(auth) {
    if (document.getElementById('chatModal')) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = stylesheet.href;
    document.head.append(css);
    const actions = document.querySelector('.floating-actions');
    const mount = actions || document.body;
    mount.insertAdjacentHTML('beforeend', '<button class="chat-fab" type="button" aria-controls="chatModal" aria-expanded="false" data-chat-open><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8 8 0 0 1-3.3-.7L4 20l1.3-3.6A7.3 7.3 0 0 1 4 12C4 7.8 7.6 4.5 12 4.5s8 3.1 8 7Z"></path></svg><span>Chat PRIME</span></button>');
    const launcher = mount.querySelector('.chat-fab');
    if (!actions) launcher.classList.add('prime-standalone');

    const panel = document.createElement('aside');
    panel.id = 'chatModal';
    panel.className = 'chat-card';
    panel.hidden = true;
    panel.setAttribute('aria-label','Chat PRIME');
    panel.innerHTML = `
      <header class="prime-header">
        <button type="button" class="prime-close" aria-label="Close Chat PRIME">×</button>
        <p>PRIME</p><h2>Hi, there 👋</h2><p class="chat-intro">How can I help you today?</p>
      </header>
      <div class="chat-body">
        <button class="suggest-toggle" type="button" aria-expanded="false" aria-controls="primeQueries">Suggested Queries ↗</button>
        <div class="chat-chips" id="primeQueries" hidden><button>How do I get my ebook?</button><button>How do Bookivo Bits work?</button><button>How do coupons work?</button><button>Contact support</button></div>
        <div class="chat-messages" role="log" aria-live="polite" aria-label="Conversation"></div>
        <p class="chat-limit"></p>
        <form data-chat-form><input name="message" placeholder="Ask me about Bookivo..." aria-label="Message" maxlength="500" required><button class="chat-send" aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"></path></svg></button></form>
      </div>`;
    document.body.append(panel);
    const form = panel.querySelector('form'), input = form.elements.message;
    const messages = panel.querySelector('.chat-messages'), close = panel.querySelector('.prime-close');
    const chips = panel.querySelector('.chat-chips'), suggest = panel.querySelector('.suggest-toggle');
    const storage = B.Storage;
    let account, history, draftKey, standaloneAccount = null, ready = !auth;
    function bubble(role,text) {
      const item = document.createElement('p');
      item.className = 'chat-bubble chat-bubble--' + role;
      item.textContent = text;
      messages.append(item);
    }
    function restoreConversation() {
      account = B.AuthStore ? B.AuthStore.get()?.id || null : standaloneAccount;
      storage.sessionWrite('prime_account',account);
      draftKey = 'prime_draft_' + (account || 'guest');
      history = storage.sessionRead('prime_messages_' + (account || 'guest'),[]);
      messages.replaceChildren();
      bubble('bot','Hi there 👋 I’m PRIME. Ask me about books, delivery, Bookivo Bits or coupons.');
      for (const item of history) bubble(item.role,item.text);
      input.value = storage.sessionRead(draftKey,'');
      messages.scrollTop = messages.scrollHeight;
    }
    function position() {
      if (panel.hidden) return;
      const anchor = launcher.getBoundingClientRect();
      panel.style.setProperty('--prime-right', Math.max(8,innerWidth-anchor.right)+'px');
      panel.style.setProperty('--prime-bottom', (innerHeight-anchor.top+8)+'px');
      panel.style.setProperty('--prime-space', Math.max(0,anchor.top-18)+'px');
    }
    async function refreshLimit() {
      const left = await B.Api.chat.remaining();
      panel.querySelector('.chat-limit').textContent = left + ' replies left this hour';
      input.disabled = form.querySelector('button').disabled = left <= 0;
    }
    function show(open) {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded',String(open));
      if (open) { position(); messages.scrollTop = messages.scrollHeight; void refreshLimit(); }
    }
    function restore() { if (!ready) return; restoreConversation(); show(storage.sessionRead('prime_open',false)); }
    document.addEventListener('click',event=>{
      if (ready && event.target.closest('[data-chat-open]')) {
        storage.sessionWrite('prime_open',true);
        show(true);
        close.focus({preventScroll:true});
      }
    });
    close.onclick = () => {
      storage.sessionWrite('prime_open',false);
      show(false);
      launcher.focus({preventScroll:true});
    };
    suggest.onclick = () => { chips.hidden = !chips.hidden; suggest.setAttribute('aria-expanded',String(!chips.hidden)); };
    chips.onclick = event => {
      const choice = event.target.closest('button');
      if (choice) { input.value = choice.textContent; form.requestSubmit(); }
    };
    input.oninput = () => storage.sessionWrite(draftKey,input.value);
    form.onsubmit = async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || input.disabled) return;
      input.value = '';
      storage.sessionWrite(draftKey,'');
      const owner = account;
      let reply;
      try { reply = (await B.Api.chat.send(text,history)).reply; }
      catch (err) { reply = err.message; }
      if (owner !== account) return;
      history.push({role:'user',text},{role:'bot',text:reply});
      storage.sessionWrite('prime_messages_' + (account || 'guest'),history);
      bubble('user',text); bubble('bot',reply);
      messages.scrollTop = messages.scrollHeight;
      await refreshLimit();
    };
    w.addEventListener('pageshow',restore);
    w.addEventListener('resize',position);
    w.visualViewport?.addEventListener('resize',position);
    new ResizeObserver(position).observe(launcher);
    B.AuthStore?.subscribe(()=>{ if ((B.AuthStore.get()?.id || null) !== account) restore(); });
    if (auth) auth.onAuthStateChange((_event,session)=>{
      const next = session?.user?.id || null;
      if (!ready || next !== standaloneAccount) {
        standaloneAccount = next;
        ready = true;
        restore();
      }
    });
    restore();
  }
  B.Chat = { init };
})(window);
