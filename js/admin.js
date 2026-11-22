'use strict';
const $=s=>document.querySelector(s),view=$('#view'),config=window.BOOKIVO_SUPABASE_CONFIG;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'₹'+(Number(v)/100).toLocaleString('en-IN',{maximumFractionDigits:2});
const filters={book:'',device:'',source:''};
const tabs=['Purchase funnel','All orders','Visitor insights','Contact support','Coupons','BOOKIVO','Danger'];
let tab=tabs[0],data,offset=0,days=7,insightDays=1,book='',kind='guest',topic='',edit=null,revision=0;
const notice=t=>$('#status').textContent=t;
async function api(action,values={}){
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 if(sessionStorage.bv_admin)headers['x-admin-session']=sessionStorage.bv_admin;
 const r=await fetch(config.url+'/functions/v1/bookivo-admin',{method:'POST',headers,body:JSON.stringify({action,...values})}),result=await r.json();
 if(!r.ok){if(r.status===401)locked();throw Error(result.error||'Request failed');}return result;
}
function locked(){delete sessionStorage.bv_admin;$('#console').hidden=$('#logout').hidden=$('#calcBtn').hidden=$('#calc').hidden=true;$('#login').hidden=false;view.replaceChildren();data=null;}
async function refresh(){data=await api('overview');$('#login').hidden=true;$('#console').hidden=$('#logout').hidden=$('#calcBtn').hidden=false;await render();}
function safe(fn){return async e=>{try{notice('');await fn(e);}catch(err){notice(err.message);}};}
$('#login').onsubmit=safe(async e=>{e.preventDefault();const f=e.target;const r=await api('login',Object.fromEntries(new FormData(f)));sessionStorage.bv_admin=r.token;f.password.value='';await refresh();});
$('#logout').onclick=safe(async()=>{if(!await confirmBox('<h2>Sign out of BOOKIVO admin?</h2><p>You will need your email and password to access the console again.</p>',0,'Yes, sign out'))return;try{await api('logout');}finally{locked();}});
const options=(xs,cur)=>xs.map(([v,l])=>`<option value="${esc(v)}" ${String(cur)===String(v)?'selected':''}>${esc(l)}</option>`).join('');
function confirmBox(html,delay=0,action='Confirm'){
 const d=$('#confirm');d.querySelector('div').innerHTML=html;const yes=$('#yes');d.showModal();
 return new Promise(resolve=>{const end=Date.now()+delay*1000;function tick(){const n=Math.max(0,Math.ceil((end-Date.now())/1000));yes.disabled=n>0;yes.textContent=n?action+' ('+n+'s)':action;}tick();const timer=setInterval(tick,200);
 function finish(ok){clearInterval(timer);d.close();resolve(ok);}$('#cancel').onclick=()=>finish(false);yes.onclick=()=>finish(true);d.oncancel=e=>{e.preventDefault();finish(false);};});
}
const metric=(title,value)=>`<article>${esc(title)}<strong>${esc(value)}</strong></article>`;
function count(stage,n){return Number(data.metrics.activity.find(r=>r.stage===stage&&r.n===n)?.count||0);}
function graph(title,entries,color,format){
 const max=Math.max(1,...entries.map(r=>r[1])),w=600,h=110;
 const points=entries.map((r,i)=>[(i+.5)*w/entries.length,h-r[1]*96/max]);
 return `<section class="box"><h2>${esc(title)}</h2><strong>${format(entries.reduce((s,r)=>s+r[1],0))}</strong><svg class="graph" viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="${esc(title)}"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points.map(p=>p.join(',')).join(' ')}"/>${points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="2" fill="${color}"><title>${entries[i][0]} · ${format(entries[i][1])}</title></circle>`).join('')}</svg><small>${entries[0]?.[0]||''} — ${entries.at(-1)?.[0]||''} · India time</small></section>`;
}
function series(field,rows){const today=new Date(Date.now()+19800000).toISOString().slice(0,10),end=Date.parse(today);const start=days?end-(days-1)*86400000:Math.min(end,...rows.map(x=>Date.parse(x.day)));const sums=new Map();for(const r of rows)sums.set(r.day,(sums.get(r.day)||0)+Number(r[field]));const out=[];for(let t=start;t<=end;t+=86400000){const day=new Date(t).toISOString().slice(0,10);out.push([day,sums.get(day)||0]);}return out;}
const pager=n=>`<div class="actions"><button data-page="-1" ${offset?'':'disabled'}>Previous</button><span>Page ${offset/50+1}</span><button data-page="1" ${n<50?'disabled':''}>Next</button></div>`;
function couponForm(){const c=edit||{};const local=v=>v?new Date(Date.parse(v)-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
 return `<form class="box" id="offer"><h2>${edit?'Edit coupon':'Create coupon'}</h2><div class="fields"><label>Coupon code<input required name="code" maxlength="32" pattern="[A-Z0-9_-]+" ${edit?'readonly':''} value="${esc(c.code)}"></label><label>Discount (%), minimum payable ₹1<input required type="number" min="1" max="100" name="percent" value="${c.percent??''}"></label><label>Maximum discount per order (₹, optional)<input type="number" min=".01" step=".01" name="cap" value="${c.cap?c.cap/100:''}"></label><label>Product price above (₹, 0 for all)<input type="number" min="0" step=".01" name="minimum" required value="${(c.minimum||0)/100}"></label><label>Starts (local time)<input type="datetime-local" name="starts" value="${local(c.starts)}"></label><label>Expires (optional)<input type="datetime-local" name="expires" value="${local(c.expires)}"></label><label>Card description<input name="description" maxlength="180" value="${esc(c.description)}"></label></div><fieldset><legend>Eligible ebooks</legend><label>Applies to<select name="scope" id="couponScope"><option value="all" ${!c.book_ids?'selected':''}>All ebooks</option><option value="selected" ${c.book_ids?'selected':''}>Selected ebooks</option></select></label><div id="couponBooks" ${c.book_ids?'':'hidden'}>${data.books.map(b=>`<label class="check"><input type="checkbox" name="book_ids" value="${esc(b.id)}" ${(c.book_ids||[]).includes(b.id)?'checked':''}>${esc(b.title)}</label>`).join('')}</div></fieldset><label class="check"><input type="checkbox" name="show_product" ${c.show_product?'checked':''}>Show Apply Now below eligible ebook purchase buttons</label><div class="actions"><label class="check"><input name="auto" type="checkbox" ${c.auto?'checked':''}>Auto-apply</label><label class="check"><input type="checkbox" name="listed" ${c.listed?'checked':''}>Show on Coupons page</label></div><div class="actions">${edit?'<button type="button" id="clear">Cancel edit</button>':'<button type="button" id="generate">Generate code</button>'}<button class="primary">${edit?'Save changes':'Create coupon'}</button></div></form>`;}
async function render(){
 const rev=++revision;
 $('nav').innerHTML=tabs.map(t=>`<button data-tab="${t}" aria-current="${t===tab}">${t}</button>`).join('');
 let html=`<h1>${tab}</h1>`;
 if(tab===tabs[0]){
 const f=await api('funnel',filters);if(rev!==revision)return;
 html+='<p>Last seven days · checkout activity starts recording with this release.</p><div class="actions">'+[['book',[['','All ebooks'],...data.books.map(b=>[b.id,b.title])]],['device',[['','All devices'],['Mobile','Mobile'],['Desktop','Desktop']]],['source',[['','All sources'],...f.sources.map(s=>[s,s])]]].map(([k,items])=>'<label>'+esc(k)+'<select data-filter="'+k+'">'+options(items,filters[k])+'</select></label>').join('')+'</div>';
 const steps=[['Product viewed','Product'],['Checkout opened','InitiateCheckout'],['Payment started','PaymentStarted'],['Confirmed purchase','Paid']],max=Math.max(1,...Object.values(f.counts));
 html+='<div class="box">'+steps.map(([label,key])=>'<p>'+label+' <strong>'+(f.counts[key]||0)+'</strong></p><div class="bar"><i style="width:'+100*(f.counts[key]||0)/max+'%"></i></div>').join('')+'</div><h2>Guest email verification</h2><div class="metrics">'+metric('Requested a code',f.counts.CodeSent||0)+metric('Verified an email',f.counts.Verified||0)+'</div>';
 }else if(tab===tabs[2]){
 html+=`<select aria-label="Activity period" id="period">${options([[1,'Today'],[7,'7 days'],[30,'30 days']],insightDays)}</select><div class="metrics">${metric('Visitors',count('Visit',insightDays))}${metric('Opened checkout',count('InitiateCheckout',insightDays))}${metric('Buyers',data.metrics.buyers[insightDays])}${metric('Visitor-to-buyer conversion',count('Visit',insightDays)?(100*Number(data.metrics.buyers[insightDays]||0)/count('Visit',insightDays)).toFixed(1)+'%':'—')}</div>`;
 }else if(tab===tabs[1]){
 html+='<p>Sandbox orders · amounts in Indian rupees</p>';const rows=await api('orders',{days,offset});if(rev!==revision)return;
 html+=`<div class="actions"><label>Period<select id="period">${options([[1,'Today'],[7,'7 days'],[30,'30 days'],[90,'90 days'],[0,'All time']],days)}</select></label><label>Ebook sales<select id="book">${options([['','All ebooks'],...data.books.map(b=>[b.id,b.title])],book)}</select></label></div>`+graph('Confirmed revenue',series('revenue',data.metrics.sales),'#128557',money)+graph('Ebook copies sold',series('copies',data.metrics.sales.filter(r=>!book||r.book_id===book)),'#165ec4',String);
 html+=graph('Paid orders',series('count',data.metrics.outcomes.filter(r=>r.status==='paid')),'#128557',String)+graph('Unsuccessful orders',series('count',data.metrics.outcomes.filter(r=>['failed','cancelled','expired'].includes(r.status))),'#bc3041',String);
 html+='<div class="box"><table><tr><th>Order</th><th>Placed</th><th>Status</th><th>Total</th><th>Ebooks</th></tr>'+rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(new Date(r.created_at).toLocaleString())}</td><td class="${esc(r.status)}">${esc(r.status)}</td><td>${money(r.amount)}</td><td>${r.bv_order_items.map(i=>esc(data.books.find(b=>b.id===i.book_id)?.title||i.book_id)).join(', ')}</td></tr>`).join('')+'</table>'+(!rows.length?'<p>No orders in this period.</p>':'')+pager(rows.length)+'</div>';
 }else if(tab===tabs[3]){
 const rows=await api('support',{kind,topic,offset});if(rev!==revision)return;
 const topics=['Creating Account','Bookivo Web Features','Coupons & Bits','Payment Issue','Others'];
 html+=`<div class="actions"><select aria-label="Sender type" id="kind">${options([['guest','Guests'],['account','Account holders']],kind)}</select><select aria-label="Issue category" id="topic">${options([['','All categories'],...topics.map(t=>[t,t])],topic)}</select></div>`;
 html+=rows.map(r=>`<article class="box"><small>${esc(r.topic)} · ${esc(new Date(r.created_at).toLocaleString())}</small><h2>${esc(r.email||r.contact_email)}</h2><p>${esc(r.name||r.contact_name)}</p><p class="reply">${esc(r.message)}</p>${(r.bv_admin_replies||r.bv_ticket_messages||[]).sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(m=>`<p class="reply"><b>${esc(m.sender||'BOOKIVO Support')}</b> · ${esc(m.body)}</p>`).join('')}<form data-reply="${esc(r.id)}"><label>Email reply<textarea required name="message" maxlength="1000"></textarea></label><button>Send reply</button></form></article>`).join('')||'<p>Your inbox is clear for this selection.</p>';html+=pager(rows.length);
 }else if(tab===tabs[4]||tab===tabs[5]){
 if(tab===tabs[5])html+=`<form id="banner" class="box"><label>Announcement bar<input required name="text" maxlength="180" value="${esc(data.controls.banner)}"></label><button>Save announcement</button></form><h2>Public coupon cards</h2>`;
 html+=couponForm()+data.offers.map(c=>`<article class="box"><small>${c.enabled?'Enabled':'Disabled'} · ${c.listed?'Public card':'Unlisted'}</small><h2>${esc(c.code)} · ${c.percent}%</h2><p>${esc(c.description)}</p><div class="actions"><button data-edit="${c.code}">Edit</button><button data-action="${c.enabled?'disable':'enable'}" data-code="${c.code}">${c.enabled?'Disable':'Enable'}</button><button data-action="delete" data-code="${c.code}">Delete</button></div></article>`).join('');
 }else html+=`<div class="box center"><h2>Store availability</h2><p>${data.controls.disabled?'Customers currently see the unavailable page. Restore access when the store is ready.':'Disabling BOOKIVO closes browsing, reading and new purchases. Payment confirmations already in progress can still arrive.'}</p><button id="power" class="danger">${data.controls.disabled?'Restore BOOKIVO':'DISABLE BOOKIVO'}</button></div>`;
 view.innerHTML=html;
}
document.addEventListener('change',safe(async e=>{if(e.target.id==='couponScope'){$('#couponBooks').hidden=e.target.value!=='selected';return;}if(e.target.dataset.filter){filters[e.target.dataset.filter]=e.target.value;await render();return;}const id=e.target.id;if(!['period','book','kind','topic'].includes(id))return;const v=e.target.value;if(id==='period'){if(tab===tabs[1])days=Number(v);else insightDays=Number(v);}if(id==='book')book=v;if(id==='kind')kind=v;if(id==='topic')topic=v;offset=0;await render();}));
document.addEventListener('click',safe(async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.tab){tab=b.dataset.tab;offset=0;edit=null;await render();}
 if(b.dataset.page){offset+=50*Number(b.dataset.page);await render();}
 if(b.id==='generate')$('#offer').code.value='BOOKIVO-'+Array.from(crypto.getRandomValues(new Uint8Array(4)),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
 if(b.dataset.edit||b.id==='clear'){edit=data.offers.find(c=>c.code===b.dataset.edit)||null;await render();$('#offer').scrollIntoView();}
 if(b.dataset.action && await confirmBox('<h2>'+esc(b.textContent)+' '+esc(b.dataset.code)+'?</h2>')){await api(b.dataset.action,{code:b.dataset.code});edit=null;await refresh();}
 if(b.id==='power'){
 if(data.controls.disabled){if(await confirmBox('<h2>Restore customer access?</h2>'))await api('restore');}
 else{await api('begin');if(!await confirmBox('<h2>Disable BOOKIVO?</h2><p>Customers will lose access until you restore the store.</p>',10,'Next')){await api('cancel');return;}
 await api('next');if(!await confirmBox('<h2>Customer preview</h2><p>Desktop and mobile visitors will see this page. Make BOOKIVO temporarily unavailable?</p><section class="previews"><iframe title="Desktop preview" src="unavailable.html"></iframe><iframe title="Mobile preview" src="unavailable.html"></iframe></section>',30,'Disable BOOKIVO')){await api('cancel');return;}await api('shutdown');}
 await refresh();}
}));
view.onsubmit=safe(async e=>{e.preventDefault();const f=e.target,v=Object.fromEntries(new FormData(f));
 if(f.id==='offer'){const selected=new FormData(f).getAll('book_ids');if(v.scope==='selected'&&!selected.length){notice('Select at least one ebook.');return;}if(!await confirmBox('<h2>'+ (edit?'Save changes to ':'Create ')+esc(v.code)+'?</h2>'))return;
 await api(edit?'edit':'create',{...v,book_ids:v.scope==='selected'?selected:null,show_product:!!v.show_product,code:v.code.toUpperCase(),percent:Number(v.percent),minimum:Math.round(v.minimum*100),cap:v.cap?Math.round(v.cap*100):null,auto:!!v.auto,listed:!!v.listed,starts:v.starts?new Date(v.starts).toISOString():null,expires:v.expires?new Date(v.expires).toISOString():null});edit=null;}
 else if(f.id==='banner')await api('banner',v);
 else if(f.dataset.reply){const btn=f.querySelector('button');btn.disabled=true;try{await api('reply',{...v,kind,id:f.dataset.reply});}finally{btn.disabled=false;}}
 await refresh();notice('Saved successfully.');});
$('#calcBtn').onclick=()=>$('#calc').hidden=!$('#calc').hidden;
let left=null,op='',fresh=true;const out=$('output'),apply=(a,b)=>({'+':a+b,'−':a-b,'×':a*b,'÷':a/b}[op]);
for(const key of ['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+','C']){
 const b=document.createElement('button');b.textContent=key;$('#calc div').append(b);b.onclick=()=>{if(key==='C'){out.value='0';left=null;op='';fresh=true;return;}if(/[0-9.]/.test(key)){if(key==='.'&&!fresh&&out.value.includes('.'))return;out.value=(fresh?(key==='.'?'0':''):out.value)+key;fresh=false;return;}const n=Number(out.value);if(left!==null&&op&&!fresh){const v=apply(left,n);out.value=Number.isFinite(v)?String(Number(v.toPrecision(12))):'Error';}left=key==='='?null:Number(out.value);op=key==='='?'':key;fresh=true;};}
if(sessionStorage.bv_admin)refresh().catch(e=>notice(e.message));
