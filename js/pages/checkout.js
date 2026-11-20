'use strict';
(function (w) {
  const B=w.Bookivo;
  let modal,form,currentItems=[],verified=false,verifiedEmail='',activeMode='pages',auto19=false;
  const $=selector=>modal&&modal.querySelector(selector);
  const nowIST=()=>new Date();
  const maxPageDiscount=()=>currentItems.reduce((sum,book)=>sum+(book.price>99?Math.floor(book.price*.19):0),0);
  function draft(){return{name:form.elements.name.value,email:form.elements.email.value,phone:form.elements.phone.value,coupon:form.elements.coupon.value,pages:form.elements.pages.value,mode:activeMode};}
  function saveDraft(){B.Storage.write('checkout_draft',draft());}
  function setMode(mode){activeMode=mode;const coupon=$('[data-select-discount="coupon"]'),pages=$('[data-select-discount="pages"]');coupon.setAttribute('aria-pressed',String(mode==='coupon'));pages.setAttribute('aria-pressed',String(mode==='pages'));coupon.classList.toggle('is-selected',mode==='coupon');pages.classList.toggle('is-selected',mode==='pages');$('.coupon-row').hidden=mode!=='coupon';$('.pages-input').hidden=mode!=='pages';if(mode!=='coupon'&&form.elements.coupon.value!=='TODAY_IS_19')$('.discount-message').textContent='';updatePricing();saveDraft();}
  function updatePricing(){
    if(!form||!currentItems.length)return;
    const balance=B.PagesStore.get(),signedIn=!!B.AuthStore.get();
    $('[data-checkout-balance]').textContent=String(balance);
    const allowed=Math.min(balance,maxPageDiscount());
    $('[data-select-discount="pages"]').disabled=!signedIn||auto19;
    form.elements.pages.disabled=!signedIn||auto19||allowed<=0;
    form.elements.pages.max=String(allowed);
    const result=B.Pricing.calculateOrder({items:currentItems,mode:activeMode,couponCode:form.elements.coupon.value,pagesBalance:balance,pagesToUse:form.elements.pages.value,nowIST:nowIST()});
    $('[data-subtotal]').textContent=B.Format.rupees(result.subtotal);
    $('[data-discount-total]').textContent='−'+B.Format.rupees(result.discountTotal);
    $('[data-grand-total]').textContent=B.Format.rupees(result.total);
    const label=result.appliedLabel==='Bookivo Pages'?'Bookivo Bits':result.appliedLabel;
    $('[data-discount-label]').textContent=label?`Discount (${label})`:'Discount';
    const explainer=$('.pages-explainer');
    if(auto19)explainer.textContent='Bookivo Bits are unavailable while the 19th-day coupon is applied.';
    else if(!signedIn)explainer.textContent='Sign in to use Bookivo Bits.';
    else if(maxPageDiscount()<=0)explainer.textContent='Bookivo Bits are not available for these items. Choose a coupon to save.';
    else if(activeMode==='pages')explainer.textContent=`1 Bit = ₹1 discount. Using ${result.pagesUsed} Bits saves ${B.Format.rupees(result.pagesUsed)} (up to 19% on eligible books).`;
    else explainer.textContent=`Use Bookivo Bits for up to ${B.Format.rupees(maxPageDiscount())} off eligible books. Choose Bits or a coupon.`;
    if(result.warnings.length){$('.discount-message').textContent=result.warnings[0];$('.discount-message').classList.remove('is-success');}
    B._lastPricing=result;return result;
  }
  function updateButton(){const name=form.elements.name.value.trim(),email=form.elements.email.value.trim(),phone=form.elements.phone.value.replace(/\D/g,'');$('.checkout-submit').disabled=!(name&&verified&&email.toLowerCase()===verifiedEmail.toLowerCase()&&/^[6-9]\d{9}$/.test(phone));}
  function bind(){
    modal=document.getElementById('checkoutModal');if(!modal)return;form=modal.querySelector('[data-checkout-form]');
    form.addEventListener('input',event=>{if(event.target.name==='coupon'&&form.elements.coupon.value!=='TODAY_IS_19'){auto19=false;modal.querySelector('[data-remove-auto]').hidden=true;}updateButton();updatePricing();saveDraft();});
    form.addEventListener('submit',submit);
    modal.querySelector('[data-apply-coupon]').addEventListener('click',applyCoupon);
    modal.querySelector('[data-remove-auto]').addEventListener('click',()=>{auto19=false;form.elements.coupon.value='';modal.querySelector('[data-remove-auto]').hidden=true;$('.discount-message').textContent='';setMode('coupon');});
    modal.querySelectorAll('[data-select-discount]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.selectDiscount;if(mode==='pages'&&(!B.AuthStore.get()||auto19)){B.Toast.show(auto19?'You can only use Bookivo Bits or a coupon code.':'Sign in to use Bookivo Bits.','error');return;}if(activeMode!=='none'&&activeMode!==mode)B.Toast.show('You can only use Bookivo Bits or a coupon code.','error');setMode(mode);}));
    B.AuthStore.subscribe(()=>{if(modal.classList.contains('is-open'))updatePricing();});B.PagesStore.subscribe(()=>{if(modal.classList.contains('is-open'))updatePricing();});
  }
  async function applyCoupon(){const code=form.elements.coupon.value.trim().toUpperCase();form.elements.coupon.value=code;auto19=code==='TODAY_IS_19'&&B.Pricing.is19thIST(nowIST());const result=await B.Api.coupons.validate(code,currentItems,nowIST());$('.discount-message').textContent=auto19?'Auto-applied today · 19% off':result.message;$('.discount-message').classList.toggle('is-success',result.valid);modal.querySelector('[data-remove-auto]').hidden=!auto19;updatePricing();saveDraft();}
  async function open(items,options){
    const user=B.AuthStore.get();
    if (!user) { B.Api.orders.signIn(); return; }
    if(!modal)bind();const values=Array.isArray(items)?items:[items];currentItems=[];
    for(const item of values){if(!item)continue;const book=typeof item==='string'?await B.Api.books.get(item):item;if(book)currentItems.push(book);}
    if(!currentItems.length)return;
    try {
      const available=await B.Api.orders.result(B.supabase.from('bv_books').select('id').in('id',currentItems.map(b=>b.id)).eq('active',true));
      if(available.length!==currentItems.length){B.Toast.show('This selection includes an ebook that is not on sale yet.','error');return;}
      await B.Api.pages.getBalance();
    } catch { B.Toast.show('Checkout is unavailable. Please try again.','error');return; }
    const title=currentItems.length===1?`${currentItems[0].title} · 1 copy`:`${currentItems.length} ebooks`;
    modal.querySelector('[data-checkout-subtitle]').textContent=title;
    const list=modal.querySelector('[data-checkout-items]');list.querySelector('summary').textContent=`View ${currentItems.length} ebooks`;list.querySelector('ul').innerHTML=currentItems.map(book=>`<li>${B.Dom.escapeHTML(book.title)} · ${B.Format.rupees(book.price)}</li>`).join('');list.hidden=currentItems.length<2;
    const saved=B.Storage.read('checkout_draft',{});form.reset();form.elements.name.value=saved.name||'';form.elements.email.value=saved.email||'';form.elements.phone.value=saved.phone||'';form.elements.coupon.value=saved.coupon||'';form.elements.pages.value=saved.pages||'0';
    verified=true; verifiedEmail=user.email; form.elements.email.value=user.email;
    form.elements.name.value=saved.name||user.name||'';
    $('[data-checkout-error]').textContent=''; $('.checkout-submit').textContent='BUY NOW';
    auto19=B.Pricing.is19thIST(nowIST());if(auto19){form.elements.coupon.value='TODAY_IS_19';modal.querySelector('[data-remove-auto]').hidden=false;$('.discount-message').textContent='Auto-applied today · 19% off';}else modal.querySelector('[data-remove-auto]').hidden=true;
    setMode(auto19?'coupon':B.AuthStore.get()?'pages':'coupon');if(saved.pages&&!auto19)form.elements.pages.value=saved.pages;
    updateButton();B.Track.event('InitiateCheckout',{content_ids:currentItems.map(book=>book.id),value:currentItems.reduce((sum,book)=>sum+book.price,0),currency:'INR'});B.Modal.open(modal);
  }
  async function submit(event){
    event.preventDefault();const name=form.elements.name.value.trim(),email=form.elements.email.value.trim(),phone=form.elements.phone.value.replace(/\D/g,'');
    if(!name||!/^\S+@\S+\.\S+$/.test(email)||!verified||email.toLowerCase()!==verifiedEmail.toLowerCase()||! /^[6-9]\d{9}$/.test(phone)){ $('[data-checkout-error]').textContent='Verify your email and enter a valid name and 10-digit phone number.';return;}
    if(activeMode==='pages'&&!B.AuthStore.get()){ $('[data-checkout-error]').textContent='Sign in to use Bookivo Bits.';return;}
    const pricing=updatePricing();if(pricing.warnings.length){$('[data-checkout-error]').textContent=pricing.warnings.join(' ');return;}
    $('.checkout-submit').disabled=true;$('.checkout-submit').textContent='Creating secure checkout…';
    try {
      const details = {name,email,phone,books:currentItems.map(book=>book.id).sort(),
        bits:activeMode==='pages'?pricing.pagesUsed:0, coupon:activeMode==='coupon'?form.elements.coupon.value.trim().toUpperCase():'',
        expectedAmount:pricing.total*100};
      const result=await B.Api.orders.createOrder(details);
      if(result.paid) { location.assign(new URL('thankyou.html?order_id='+result.id,document.baseURI)); return; }
      await loadCashfree();
      const gateway=await window.Cashfree({mode:'sandbox'}).checkout({paymentSessionId:result.session,redirectTarget:'_self'});
      if(gateway?.error) throw new Error(gateway.error.message);
    } catch(error) { $('[data-checkout-error]').textContent=error.message; }
    finally { $('.checkout-submit').textContent='BUY NOW'; updateButton(); }
  }
  let sdk;
  function loadCashfree() {
    if(window.Cashfree) return Promise.resolve();
    if(!sdk) sdk=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://sdk.cashfree.com/js/v3/cashfree.js';
      script.onload=resolve;
      script.onerror=()=>{sdk=null; script.remove(); reject(new Error('Could not load Cashfree. Please retry.'));};
      document.head.appendChild(script);
    });
    return sdk;
  }
  B.Checkout={open,init:bind};
})(window);
