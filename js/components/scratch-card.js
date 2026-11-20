'use strict';
(function (w) {
  function show(user) {
    return new Promise(resolve => {
      if (!user || !user.id) return resolve(null);
      const id = String(user.id);
      document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop scratch-backdrop" id="scratchModal" role="dialog" aria-modal="true" aria-labelledby="welcomeCardTitle"><section class="scratch-dialog"><button type="button" class="welcome-close" aria-label="Close welcome card" data-scratch-close>×</button><p class="scratch-kicker">A little something for your next read</p><h2 id="welcomeCardTitle">BOOKIVO WELCOME CARD</h2><p class="scratch-instruction">Scratch the golden card to reveal your welcome reward.</p><div class="scratch-card" aria-label="Scratch card. Scratch at least 60 percent to reveal your reward."><div class="scratch-prize"><span>YOUR WELCOME GIFT</span><strong>10 BITS</strong><small>₹10 discount value</small></div><canvas width="420" height="210" aria-label="Scratch the gold coating"></canvas></div><p class="scratch-message" data-scratch-message aria-live="polite">Scratch across the card to reveal your gift</p></section></div>`);
      const modal = document.getElementById('scratchModal');
      const canvas = modal.querySelector('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const message = modal.querySelector('[data-scratch-message]');
      let finished = false, dismissed = false, won = false, isDrawing = false;
      const close = async () => {
        if (dismissed || (finished && !won)) return;
        dismissed = true;
        if (!won) { try { await w.Bookivo.Api.pages.dismissWelcome(id); } catch (error) { dismissed=false; message.textContent=error.message; return; } }
        modal.dataset.claimed = 'true';
        w.Bookivo.Modal.close(modal);
        modal.remove();
        if (!won) resolve({ dismissed: true, reward: 0 });
      };
      function paintGold() {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#fff0a8'); gradient.addColorStop(.25, '#d69a23'); gradient.addColorStop(.5, '#fff4bc'); gradient.addColorStop(.78, '#bd7c11'); gradient.addColorStop(1, '#ffe8a0');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 3; ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        ctx.fillStyle = '#51320a'; ctx.textAlign = 'center'; ctx.font = '800 18px Inter, Arial'; ctx.fillText('SCRATCH TO REVEAL', canvas.width / 2, canvas.height / 2 - 4);
        ctx.font = '14px Inter, Arial'; ctx.fillText('BOOKIVO · WELCOME GIFT', canvas.width / 2, canvas.height / 2 + 24);
      }
      function scratchedRatio() {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let clear = 0, total = 0;
        for (let y = 3; y < canvas.height; y += 8) for (let x = 3; x < canvas.width; x += 8) { total++; if (data[(y * canvas.width + x) * 4 + 3] < 80) clear++; }
        return total ? clear / total : 0;
      }
      function eraseAt(event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * canvas.width / rect.width;
        const y = (event.clientY - rect.top) * canvas.height / rect.height;
        ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
        if (scratchedRatio() >= .60) reveal();
      }
      async function reveal() {
        if (finished || dismissed) return;
        finished = true;
        modal.classList.add('scratch-revealing');
        message.textContent = 'Your welcome reward is on its way…';
        setTimeout(() => { ctx.clearRect(0, 0, canvas.width, canvas.height); }, 300);
        try {
          const result = await w.Bookivo.Api.pages.claimWelcome(id);
          if (result.claimed) {
            won = true;
            modal.classList.add('scratch-won');
            message.textContent = 'CONGRATS!! You won 10 BOOKIVO BITS';
            w.Bookivo.Confetti?.fire();
            w.Bookivo.Toast.show('+10 BOOKIVO BITS added to your balance', 'success', 2500);
            resolve(result);
          } else {
            won=true; message.textContent = result.reward ? 'Your welcome reward was already claimed.' : 'This welcome card has already been closed.';
            resolve(result);
          }
        } catch (error) { finished = false; modal.classList.remove('scratch-revealing'); message.textContent = error.message || 'Could not add your Bits. Please try again.'; }
      }
      paintGold();
      canvas.addEventListener('pointerdown', event => { if (finished) return; isDrawing = true; canvas.setPointerCapture(event.pointerId); eraseAt(event); });
      canvas.addEventListener('pointermove', event => { if (isDrawing && !finished) eraseAt(event); });
      canvas.addEventListener('pointerup', () => { isDrawing = false; });
      canvas.addEventListener('pointercancel', () => { isDrawing = false; });
      modal.querySelector('[data-scratch-close]').addEventListener('click', close);
      modal.addEventListener('click', event => { if (event.target === modal) { event.stopPropagation(); close(); } });
      document.addEventListener('keydown', function dismissWelcomeOnEscape(event) {
        if (event.key !== 'Escape' || !modal.isConnected || modal.hidden) return;
        event.preventDefault(); event.stopImmediatePropagation(); close();
      }, true);
      w.Bookivo.Modal.open(modal);
    });
  }
  w.Bookivo.ScratchCard = { show };
})(window);
