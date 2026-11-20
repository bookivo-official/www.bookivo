'use strict';
(function (w) {
  const B = w.Bookivo;
  async function init() {
    const user = B.AuthStore.get();
    if (!user) { location.replace('login.html?next=pages.html'); return; }
    const root = document.getElementById('pageMain');
    const [balance, rows] = await Promise.all([B.Api.pages.getBalance(), B.Api.pages.getHistory()]);
    root.innerHTML = `<section class="page-heading bits-heading"><img src="images/bookivo-bits.png" alt="Bookivo Bits coin" width="124" height="100"><div><p class="eyebrow">Your rewards</p><h1>Bookivo Bits</h1><p>Earn Bits, redeem Bits and save on your next eligible book.</p></div></section><section class="balance-card bookivo-block bits-balance"><div class="bits-balance-top"><div><span class="bits-symbol" aria-hidden="true">◉</span><div><strong data-balance>${balance}</strong><span>BOOKIVO BITS</span></div></div><span class="badge">REWARDS</span></div><hr><h2>Your knowledge deserves rewards.</h2><p>Earn Bits. Redeem Bits. Save on your next book.</p><div class="bits-value">1 Bit = ₹1 discount value</div><small>Discount eligibility and limits appear in checkout. Bits cannot be combined with a coupon.</small></section><section class="section bits-faq"><div class="section-heading"><h2>Bookivo Bits questions</h2></div><details class="bookivo-block"><summary>What are Bookivo Bits?</summary><p>Bookivo Bits are reward credits that can be used toward a discount on eligible ebooks. One Bit is worth ₹1 in discount value, with the applicable limit shown before payment.</p></details><details class="bookivo-block"><summary>How can I earn Bookivo Bits?</summary><p>Sign in to see any available new-member reward and earn Bits on qualifying completed purchases. Rewards are added to your account after the purchase is confirmed.</p></details><details class="bookivo-block"><summary>How do I use my Bits?</summary><p>At checkout, select “Use Bookivo Bits” and enter the amount you want to redeem. The available balance and discount cap appear with the updated total before you pay.</p></details><details class="bookivo-block"><summary>Can I use Bits with a coupon code?</summary><p>No. Choose either Bookivo Bits or one coupon code for an order. When you switch options, checkout hides the other and recalculates the discount.</p></details></section><section class="section bits-history"><div class="section-heading"><h2>Bits history</h2><select id="historyFilter" aria-label="Filter Bits history"><option value="all">All</option><option value="earned">Earned</option><option value="spent">Spent</option></select></div><div class="table-scroll"><table class="history-table"><thead><tr><th>Date</th><th>Reason</th><th>Bits</th><th>Balance after</th></tr></thead><tbody id="historyRows"></tbody></table></div><div class="empty-state" id="historyEmpty" hidden>No history yet.</div></section>`;
    const tbody = root.querySelector('#historyRows');
    function draw(filter) {
      let current = balance;
      const view = rows.map(row=>{const after=current;current-=row.amount;return {...row,after};}).filter(row => filter === 'earned' ? row.amount > 0 : filter === 'spent' ? row.amount < 0 : true);
      tbody.innerHTML = view.map(row => {
        const after = row.after;
        return `<tr><td>${B.Format.date(row.date)}</td><td>${B.Dom.escapeHTML(row.reason)}</td><td class="${row.amount > 0 ? 'amount-earned' : 'amount-spent'}">${row.amount > 0 ? '+' : ''}${row.amount}</td><td>${after}</td></tr>`;
      }).join('');
      root.querySelector('#historyEmpty').hidden = !!view.length;
      tbody.closest('.table-scroll').hidden = !view.length;
    }
    draw('all');
    root.querySelector('#historyFilter').onchange = event => draw(event.target.value);
  }
  B.PageHandlers.pages = init;
})(window);
