'use strict';
(function (w) {
  function bucketKey(user) { return 'chat_usage_'+(user ? user.id : 'guest'); }
  function usage(user) { const now=Date.now(); const current=w.Bookivo.Storage.read(bucketKey(user), {start:now,count:0}); if(now-current.start>=3600000) return {start:now,count:0}; return current; }
  function answer(text) {
    const q=String(text||'').toLowerCase();
    if(/refund|order status|payment status|paid but|delivery issue/.test(q)) return 'For order or refund status, please contact support with your order ID. I can help with general store questions here.';
    if(/financial advice|should i invest|which stock|buy shares|investment advice/.test(q)) return 'I can only help with Bookivo store questions. Our Financials ebooks are educational and are not investment or tax advice.';
    if(/page|bookivo bits|bookivo pages|points/.test(q)) return 'Bookivo Bits are store rewards. 1 Bit is worth ₹1 off. Earn Bits through sign-up rewards and eligible purchases, then choose Bits or a coupon at checkout. Only one discount type can be used per order.';
    if(/coupon|discount|19th/.test(q)) return 'At checkout, apply a coupon or use Bookivo Bits. Only one discount type applies per order and discounts follow the eligible-book rules shown at checkout.';
    if(/ebook|download|delivery|my books/.test(q)) return 'Once payment is confirmed, open My Shelf with the account you used at checkout. Select your ebook to start or resume reading.';
    if(/contact|support|help/.test(q)) return 'Use Contact Us to reach support. Order and refund status questions should include your order ID.';
    if(/account|login|sign in|otp/.test(q)) return 'Sign in with your email and enter the six-digit code sent to your inbox.';
    if(/price|cost|road to 5cr|cookbook/.test(q)) return 'Open a book page to see its current catalogue price, details and sample. Prices are shown in Indian rupees.';
    return 'I can only help with Bookivo store questions. Try asking about ebooks, delivery, Bookivo Bits, coupons, accounts or support.';
  }
  w.Bookivo.Api.chat = { async send(text) { await w.Bookivo.Api.delay(500,800); const user=w.Bookivo.AuthStore.get(); const state=usage(user); if(state.count>=20) throw new Error('You have reached the hourly limit. Please try again later or contact support.'); state.count++; w.Bookivo.Storage.write(bucketKey(user),state); return { reply:answer(text), left:20-state.count }; }, async remaining() { const user=w.Bookivo.AuthStore.get(); return 20-usage(user).count; } };
})(window);

