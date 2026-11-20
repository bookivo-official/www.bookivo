'use strict';
const assert = require('node:assert/strict');
const Pricing = require('../js/lib/pricing.js');

const day19IST = new Date('2026-11-18T19:00:00.000Z');
const day18IST = new Date('2026-11-18T12:00:00.000Z');
let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log('✓ ' + name); }

test('coupon discount never exceeds the 20% line cap', () => {
  const result = Pricing.calculateOrder({ items:[{id:'a',price:149},{id:'b',price:101}], mode:'coupon', couponCode:'FESTIVE20', nowIST:day18IST });
  for (const line of result.lines) assert.ok(line.discount <= Math.floor(line.price * 0.2));
});
test('percentage input is clamped to 20%', () => assert.equal(Pricing.clampPercent(999),20));
test('Pages only apply above ₹99 and cap at 19% per line', () => {
  const result = Pricing.calculateOrder({ items:[{id:'cookbook',price:99},{id:'road',price:299}], mode:'pages', pagesBalance:900, pagesToUse:900, couponCode:'FESTIVE20', nowIST:day18IST });
  assert.equal(result.lines[0].discount,0); assert.equal(result.lines[1].discount,56); assert.equal(result.pagesUsed,56); assert.equal(result.appliedLabel,'Bookivo Pages');
});
test('19th-day code uses India time and applies 19%', () => {
  assert.equal(Pricing.is19thIST(day19IST),true);
  const result=Pricing.calculateOrder({items:[{id:'x',price:300}],mode:'coupon',couponCode:'TODAY_IS_19',nowIST:day19IST});
  assert.equal(result.lines[0].discount,57);
});
test('19th-day code is rejected on other dates', () => {
  const result=Pricing.calculateOrder({items:[{id:'x',price:300}],mode:'coupon',couponCode:'TODAY_IS_19',nowIST:day18IST});
  assert.equal(result.discountTotal,0); assert.match(result.warnings[0],/only on the 19th/);
});
test('partner codes receive 5% and invalid formats do not apply', () => {
  const good=Pricing.calculateOrder({items:[{id:'x',price:200}],mode:'coupon',couponCode:'BOOKIVO101',nowIST:day18IST});
  const bad=Pricing.calculateOrder({items:[{id:'x',price:200}],mode:'coupon',couponCode:'BOOKIVO10',nowIST:day18IST});
  assert.equal(good.discountTotal,10); assert.equal(bad.discountTotal,0);
});
test('only the selected discount mode applies', () => {
  const pages=Pricing.calculateOrder({items:[{id:'x',price:300}],mode:'pages',pagesBalance:99,pagesToUse:99,couponCode:'FESTIVE20',nowIST:day19IST});
  assert.equal(pages.discountTotal,57); assert.equal(pages.appliedLabel,'Bookivo Pages');
});
test('Pages earning is 50 only above ₹249', () => {
  assert.equal(Pricing.pagesEarned([{price:249},{price:250},{price:399}]),100);
});
test('scratch-card weights total 100', () => assert.equal(Pricing.SCRATCH_ODDS.reduce((n,x)=>n+x.weight,0),100));

console.log(`\n${passed} pricing tests passed.`);

