'use strict';
(function (w) {
  const B=w.Bookivo;
  let modal,form,currentItems=[],activeMode='pages',auto19=false,appliedCoupon='';
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
    const result=B.Pricing.calculateOrder({items:currentItems,mode:activeMode,couponCode:appliedCoupon,pagesBalance:balance,pagesToUse:form.elements.pages.value,nowIST:nowIST()});
    $('[data-subtotal]').textContent=B.Format.rupees(result.subtotal);
    $('[data-discount-total]').textContent='−'+B.Format.rupees(result.discountTotal);
    $('[data-grand-total]').textContent=B.Format.rupees(result.total);
    const label=result.appliedLabel==='Bookivo Pages'?'Bookivo Bits':result.appliedLabel;
    $('[data-discount-label]').textContent=label?`Discount (${label})`:'Discount';
    const explainer=$('.pages-explainer');
    if(auto19)explainer.textContent='Bookivo Bits are unavailable while an automatic coupon is applied.';
    else if(!signedIn)explainer.textContent='Sign in to use Bookivo Bits.';
    else if(maxPageDiscount()<=0)explainer.textContent='Bookivo Bits are not available for these items. Choose a coupon to save.';
    else if(activeMode==='pages')explainer.textContent=`1 Bit = ₹1 discount. Using ${result.pagesUsed} Bits saves ${B.Format.rupees(result.pagesUsed)} (up to 19% on eligible books).`;
    else explainer.textContent=`Use Bookivo Bits for up to ${B.Format.rupees(maxPageDiscount())} off eligible books. Choose Bits or a coupon.`;
    if(result.warnings.length){$('.discount-message').textContent=result.warnings[0];$('.discount-message').classList.remove('is-success');}
    B._lastPricing=result;return result;
  }
  function updateButton(){const name=form.elements.name.value.trim(),email=form.elements.email.value.trim(),phone=form.elements.phone.value.replace(/\D/g,'');$('.checkout-submit').disabled=!(name&&/^\S+@\S+\.\S+$/.test(email)&&/^[6-9]\d{9}$/.test(phone));}
  function bind(){
    modal=document.getElementById('checkoutModal');if(!modal)return;form=modal.querySelector('[data-checkout-form]');
    form.addEventListener('input',event=>{if(event.target.name==='coupon'){appliedCoupon='';auto19=false;modal.querySelector('[data-remove-auto]').hidden=true;}updateButton();updatePricing();saveDraft();});
    $('#guestVerify')?.remove();$('#guestCodeRow')?.remove();
    form.addEventListener('submit',submit);
    modal.querySelector('[data-apply-coupon]').addEventListener('click',applyCoupon);
    modal.querySelector('[data-remove-auto]').addEventListener('click',()=>{auto19=false;appliedCoupon='';form.elements.coupon.value='';modal.querySelector('[data-remove-auto]').hidden=true;$('.discount-message').textContent='';setMode('coupon');});
    modal.querySelectorAll('[data-select-discount]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.selectDiscount;if(mode==='pages'&&(!B.AuthStore.get()||auto19)){B.Toast.show(auto19?'You can only use Bookivo Bits or a coupon code.':'Sign in to use Bookivo Bits.','error');return;}if(activeMode!=='none'&&activeMode!==mode)B.Toast.show('You can only use Bookivo Bits or a coupon code.','error');setMode(mode);}));
    B.AuthStore.subscribe(()=>{if(modal.classList.contains('is-open'))updatePricing();});B.PagesStore.subscribe(()=>{if(modal.classList.contains('is-open'))updatePricing();});
  }
  async function applyCoupon(){
    const button=$('[data-apply-coupon]');if(button.disabled)return;button.disabled=true;
    const code=form.elements.coupon.value.trim().toUpperCase();form.elements.coupon.value=code;appliedCoupon='';
    try{const result=await B.Api.coupons.validate(code,currentItems,nowIST());if(form.elements.coupon.value.trim().toUpperCase()!==code)return;
      appliedCoupon=result.valid?code:'';auto19=result.valid&&!!result.offer?.auto;
      $('.discount-message').textContent=result.message;$('.discount-message').classList.toggle('is-success',result.valid);modal.querySelector('[data-remove-auto]').hidden=!auto19;
      B.Toast.show(result.message,result.valid?'success':'error');updatePricing();saveDraft();
    }catch(e){B.Toast.show(e.message||'Could not check the coupon. Please retry.','error');updatePricing();}finally{button.disabled=false;}
  }
  async function open(items,options){
    const user=B.AuthStore.get();appliedCoupon='';

    if(!modal)bind();const values=Array.isArray(items)?items:[items];currentItems=[];
    for(const item of values){if(!item)continue;const book=typeof item==='string'?await B.Api.books.get(item):item;if(book)currentItems.push(book);}
    if(!currentItems.length)return;
    try {
      const available=await B.Api.orders.result(B.supabase.from('bv_books').select('id').in('id',currentItems.map(b=>b.id)).eq('active',true));
      if(available.length!==currentItems.length){B.Toast.show('This selection includes an ebook that is not on sale yet.','error');return;}
      if(user) await B.Api.pages.getBalance();
    } catch { B.Toast.show('Checkout is unavailable. Please try again.','error');return; }
    const title=currentItems.length===1?`${currentItems[0].title} · 1 copy`:`${currentItems.length} ebooks`;
    modal.querySelector('[data-checkout-subtitle]').textContent=title;
    const list=modal.querySelector('[data-checkout-items]');list.querySelector('summary').textContent=`View ${currentItems.length} ebooks`;list.querySelector('ul').innerHTML=currentItems.map(book=>`<li>${B.Dom.escapeHTML(book.title)} · ${B.Format.rupees(book.price)}</li>`).join('');list.hidden=currentItems.length<2;
    const saved=B.Storage.read('checkout_draft',{});form.reset();form.elements.name.value=saved.name||'';form.elements.email.value=saved.email||'';form.elements.phone.value=saved.phone||'';form.elements.coupon.value=saved.coupon||'';form.elements.pages.value=saved.pages||'0';
    form.elements.email.value=user?.email||saved.email||'';
    form.elements.email.readOnly=!!user;
    form.elements.name.value=saved.name||user?.name||'';
    $('[data-checkout-error]').textContent=''; $('.checkout-submit').textContent='BUY NOW';
    const automatic=(window.bookivoSettings?.offers||[]).find(o=>o.auto && o.code!=='PARTNER_PATTERN' && currentItems.some(i=>i.price*100>o.minimum && (!o.book_ids || o.book_ids.includes(i.id))));auto19=!!automatic;if(auto19){appliedCoupon=automatic.code;form.elements.coupon.value=automatic.code;modal.querySelector('[data-remove-auto]').hidden=false;$('.discount-message').textContent='Offer applied';}else modal.querySelector('[data-remove-auto]').hidden=true;
    setMode(auto19?'coupon':B.AuthStore.get()?'pages':'coupon');if(saved.pages&&!auto19)form.elements.pages.value=saved.pages;
    const selected=sessionStorage.getItem('bv_selected_coupon');if(selected && B.Pricing.calculateOrder({items:currentItems,mode:'coupon',couponCode:selected,nowIST:new Date()}).discountTotal>0){form.elements.coupon.value=selected;auto19=false;setMode('coupon');await applyCoupon();}
    updateButton();B.Track.event('InitiateCheckout',{content_ids:currentItems.map(book=>book.id),value:currentItems.reduce((sum,book)=>sum+book.price,0),currency:'INR'});B.Modal.open(modal);
  }
  async function submit(event){
    event.preventDefault();const name=form.elements.name.value.trim(),email=form.elements.email.value.trim(),phone=form.elements.phone.value.replace(/\D/g,'');
    if(!name||!/^\S+@\S+\.\S+$/.test(email)||! /^[6-9]\d{9}$/.test(phone)){ $('[data-checkout-error]').textContent='Enter a valid email, name and 10-digit phone number.';return;}
    if(activeMode==='pages'&&!B.AuthStore.get()){ $('[data-checkout-error]').textContent='Sign in to use Bookivo Bits.';return;}
    if(activeMode==='coupon'&&form.elements.coupon.value.trim()&&appliedCoupon!==form.elements.coupon.value.trim().toUpperCase()){B.Toast.show('Click Apply to verify your coupon before paying.','error');return;}
    const pricing=updatePricing();if(pricing.warnings.length){$('[data-checkout-error]').textContent=pricing.warnings.join(' ');return;}
    $('.checkout-submit').disabled=true;$('.checkout-submit').textContent='Creating secure checkout…';
    let gatewayOpened=false;
    try {
      const details = {visitor:localStorage.bv_visitor,source:sessionStorage.bv_source,device:matchMedia('(max-width:760px)').matches?'Mobile':'Desktop',name,email,phone,books:currentItems.map(book=>book.id).sort(),
        bits:activeMode==='pages'?pricing.pagesUsed:0, coupon:activeMode==='coupon'?appliedCoupon:'',
        expectedAmount:Math.round(pricing.total*100)};
      const result=await B.Api.orders.createOrder(details);
      if(result.paid) { location.assign(new URL('thankyou.html?order_id='+result.id,document.baseURI)); return; }
      if(!['sandbox','production'].includes(result.mode))throw new Error('Payment configuration changed. Refresh and try again.');
      await loadCashfree();
      B.Track.event('PaymentStarted');
      // Release BOOKIVO's focus trap before Cashfree mounts its own payment dialog.
      B.Modal.close(modal);gatewayOpened=true;
      const gateway=await window.Cashfree({mode:result.mode}).checkout({paymentSessionId:result.session,redirectTarget:'_modal'});
      if(gateway?.redirect)return;
      // The Thank You page verifies the order on the server; SDK completion is not proof of payment.
      if(gateway?.paymentDetails){location.assign(new URL('thankyou.html?order_id='+encodeURIComponent(result.id),document.baseURI));return;}
      const status=await B.Api.orders.getStatus(result.id);
      if(status?.status==='paid'){location.assign(new URL('thankyou.html?order_id='+encodeURIComponent(result.id),document.baseURI));return;}
      throw new Error(gateway?.error?.message || 'Payment window closed. You can retry when ready.');
    } catch(error) { if(gatewayOpened)B.Modal.open(modal);$('[data-checkout-error]').textContent=error.message;B.Toast.show(error.message,'error'); }
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
