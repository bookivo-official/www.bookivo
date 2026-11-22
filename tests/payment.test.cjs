// Exercise the actual Edge handler offline using simulated provider and database responses.
const assert=require('node:assert/strict'),{createHmac}=require('node:crypto');
const order={id:'20000000-0000-0000-0000-000000000001',user_id:'10000000-0000-0000-0000-000000000001',amount:2500,status:'pending'};
const secret='local-test-fixture';
const env={SUPABASE_URL:'https://db.example.test',SUPABASE_SERVICE_ROLE_KEY:'fixture',SUPABASE_ANON_KEY:'public-fixture',CASHFREE_ENVIRONMENT:'sandbox',CASHFREE_APP_ID:'fixture',CASHFREE_SECRET_KEY:secret,BOOKIVO_SITE_URL:'https://book.example.test',BOOKIVO_SANDBOX_TESTERS:order.user_id};
let offer={code:'TEST',enabled:true,percent:10,minimum:0,book_ids:['book-2']};let calledHost;
let handler,state='ACTIVE',amount=25,success=true,settles=0;const seen=new Set();
global.Deno={env:{get:key=>env[key]},serve:fn=>{handler=fn;}};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status});
global.fetch=async(url,opt={})=>{
  const u=new URL(url);
  if(['sandbox.cashfree.com','api.cashfree.com'].includes(u.hostname)){calledHost=u.hostname;
    if(u.pathname.endsWith('/payments'))return json(success?[{order_id:order.id,payment_status:'SUCCESS',payment_amount:amount,payment_currency:'INR'}]:[]);
    return json({order_id:order.id,order_status:state,order_currency:'INR',order_amount:amount,customer_details:{customer_id:order.user_id},payment_session_id:'local-session'});
  }
  if(u.hostname!=='db.example.test')throw Error('Unexpected outgoing request');
  if(u.pathname.endsWith('/bv_limit'))return json(true);
  if(u.pathname.endsWith('/bv_offers'))return json(offer?[offer]:[]);
  if(u.pathname.endsWith('/bv_books'))return json([{id:'book-2',price_paise:2500},{id:'book-3',price_paise:19900}]);
  if(u.pathname.endsWith('/bv_order_items'))return json([{book_id:'book-2'}]);
  if(u.pathname.endsWith('/bv_controls'))return json([{disabled:false}]);
  if(u.pathname.endsWith('/user'))return opt.headers.Authorization==='Bearer fixture'?json({id:order.user_id,email:'test@example.test',email_confirmed_at:'2026-11-20'}):json({},401);
  if(u.pathname.endsWith('/bv_session_current'))return json(true);
  if(u.pathname.endsWith('/bv_orders'))return json([order]);
  if(u.pathname.endsWith('/bv_prepare'))return json(order);
  if(u.pathname.endsWith('/bv_events'))return json(seen.has(u.searchParams.get('event_id').slice(3))?[{}]:[]);
  if(u.pathname.endsWith('/bv_event_error'))return json(null);
  if(u.pathname.endsWith('/bv_settle')){const data=JSON.parse(opt.body);order.status=data.p_status;seen.add(data.p_event);settles++;return json(null);}
  throw Error('Unexpected fixture endpoint');
};
const body=(path,payload,headers={})=>handler(new Request('https://db.example.test/functions/v1/bookivo-store'+path,{method:'POST',headers,body:JSON.stringify(payload)}));
const event={type:'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:order.id,order_currency:'INR',order_amount:25},payment:{cf_payment_id:'test-1',payment_currency:'INR',payment_status:'SUCCESS'}}};
const ts=String(Date.now());
const signed=()=>({'x-webhook-timestamp':ts,'x-webhook-signature':createHmac('sha256',secret).update(ts+JSON.stringify(event)).digest('base64')});
const auth={Authorization:'Bearer fixture'};
(async()=>{
  await import('../supabase/functions/bookivo-store/index.ts');
  assert.equal((await body('',{action:'status',id:order.id})).status,401);
  const selection={action:'checkout',id:order.id,books:['book-2'],name:'Tester',phone:'9000000000',bits:0,coupon:'',expectedAmount:2500};
  assert.equal((await (await body('',selection,auth)).json()).session,'local-session');
  env.BOOKIVO_SANDBOX_TESTERS='';assert.equal((await body('',selection,auth)).status,403);env.BOOKIVO_SANDBOX_TESTERS=order.user_id;
  assert.equal((await (await body('',{action:'status',id:order.id},auth)).json()).status,'pending');
  assert.equal((await body('/webhook',event,{'x-webhook-timestamp':ts,'x-webhook-signature':'A'.repeat(44)})).status,401);
  state='PAID';amount=24;assert.equal((await body('/webhook',event,signed())).status,409);
  amount=25;success=false;assert.equal((await body('/webhook',event,signed())).status,409);
  success=true;assert.equal((await body('/webhook',event,signed())).status,200);assert.equal(order.status,'paid');
  await body('/webhook',event,signed());assert.equal(settles,1);
  for(const [provider,expected] of [['TERMINATED','cancelled'],['EXPIRED','expired']]){
    order.status='pending';state=provider;assert.equal((await (await body('',{action:'status',id:order.id},auth)).json()).status,expected);
  }
  order.status='pending';state='ACTIVE';env.CASHFREE_ENVIRONMENT='production';env.BOOKIVO_SANDBOX_TESTERS='';
  const live=await (await body('',selection,auth)).json();assert.equal(live.mode,'production');assert.equal(live.session,'local-session');assert.equal(calledHost,'api.cashfree.com');
  env.CASHFREE_ENVIRONMENT='invalid';assert.equal((await body('',selection,auth)).status,503);env.CASHFREE_ENVIRONMENT='production';
  const validate=async()=>await (await body('',{action:'coupon',code:'TEST',books:['book-2']})).json();
  assert.equal((await validate()).valid,true);offer.expires='2000-01-01';assert.match((await validate()).message,/expired/);delete offer.expires;
  offer.starts='2099-01-01';assert.match((await validate()).message,/not active/);delete offer.starts;
  offer.book_ids=['book-3'];assert.match((await validate()).message,/selected book/);offer.book_ids=null;offer.minimum=10000;assert.match((await validate()).message,/priced above/);offer.enabled=false;assert.match((await validate()).message,/disabled/);offer=null;assert.match((await validate()).message,/wrong/);
  console.log('PASS: production routing and SDK mode, coupon wrong/expired/future/scope/threshold/disabled cases; sandbox tests');
  console.log('PASS: sandbox allowlist, authentication, session, pending/cancelled/expired, signatures, amounts, successful payment evidence and duplicate delivery');
})().catch(e=>{console.error(e);process.exitCode=1});

