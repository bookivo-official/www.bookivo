const env = (name: string) => Deno.env.get(name) || "";
const db = env("SUPABASE_URL");
const admin = env("SUPABASE_SERVICE_ROLE_KEY");
const apiVersion = "2025-01-01";
const provider = "https://sandbox.cashfree.com/pg";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {"Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type", "Cache-Control":"no-store", "Content-Type":"application/json"};

class Problem extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}
function requireValue(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new Problem(status, message);
}
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {status,headers});
}
async function database(path: string, payload?: unknown) {
  const result = await fetch(db + "/rest/v1/" + path, {
    method: payload === undefined ? "GET" : "POST",
    headers: {apikey:admin,Authorization:"Bearer "+admin,"Content-Type":"application/json"},
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  if (!result.ok) {
    const detail = await result.json().catch(()=>({}));
    if (detail.code === "P0001") throw new Problem(409, detail.message);
    console.error("Database operation failed", result.status, detail.code);
    throw new Problem(503,"BOOKIVO could not complete this request. Please retry.");
  }
  const text = await result.text();
  return text ? JSON.parse(text) : null;
}
async function customer(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  requireValue(authorization.startsWith("Bearer "),401,"Sign in to continue.");
  const r = await fetch(db+"/auth/v1/user",{headers:{apikey:env("SUPABASE_ANON_KEY"),Authorization:authorization}});
  requireValue(r.ok,401,"Sign in again to continue.");
  const user = await r.json();
  requireValue(uuid.test(user.id) && user.email_confirmed_at && !user.is_anonymous,401,"Verify your account email to continue.");
  return user;
}
function paymentSettings() {
  requireValue(env("CASHFREE_ENVIRONMENT")==="sandbox" && env("CASHFREE_APP_ID") && env("CASHFREE_SECRET_KEY") && /^https:\/\//.test(env("BOOKIVO_SITE_URL")),503,"Sandbox checkout is awaiting merchant configuration.");
}
async function cashfree(path: string, body?: unknown, key?: string, allowMissing = false) {
  const h: Record<string,string> = {"x-api-version":apiVersion,"x-client-id":env("CASHFREE_APP_ID"),"x-client-secret":env("CASHFREE_SECRET_KEY"),"Content-Type":"application/json"};
  if(key) h["x-idempotency-key"]=key;
  const r = await fetch(provider + path, {method:body ? "POST":"GET",headers:h,body:body ? JSON.stringify(body):undefined});
  if(allowMissing && r.status===404)return null;
  if(!r.ok) {
    console.error("Cashfree request failed",r.status,r.headers.get("x-request-id"));
    throw new Problem(502,"Cashfree could not confirm this order. Retry with the same checkout.");
  }
  return await r.json();
}
async function readOrder(id: string, userId?: string) {
  requireValue(uuid.test(id),400,"Invalid order ID.");
  const rows = await database("bv_orders?id=eq."+id+(userId?"&user_id=eq."+userId:"")+"&limit=1");
  requireValue(rows.length,404,"Order unavailable.");
  return rows[0];
}
async function reconcile(id: string, event?: {id:string;kind:string;attempt:string}) {
  const order=await readOrder(id);
  const actual=await cashfree("/orders/"+id,undefined,undefined,true);
  if(!actual){
    if(Date.now()-Date.parse(order.created_at)<3600000)return {status:order.status};
    await database("rpc/bv_settle",{p_id:id,p_status:"expired",p_currency:"INR",p_amount:order.amount,p_event:id+":no-session",p_kind:"Provider session never created"});
    return {status:(await readOrder(id)).status};
  }
  requireValue(actual.order_id===id && actual.customer_details.customer_id===order.user_id &&
    actual.order_currency==="INR" && Math.round(Number(actual.order_amount)*100)===order.amount,409,"Order verification failed.");
  let status="pending";
  if(actual.order_status==="PAID") {
    const payments=await cashfree("/orders/"+id+"/payments");
    requireValue(payments.some((p:Record<string,unknown>)=>p.order_id===id && p.payment_status==="SUCCESS" &&
      p.payment_currency==="INR" && Math.round(Number(p.payment_amount)*100)===order.amount),409,"Waiting for confirmed payment.");
    status="paid";
  } else if(actual.order_status==="EXPIRED") status="expired";
  else if(actual.order_status==="TERMINATED") status="cancelled";
  else if(event?.attempt==="FAILED" || (order.status==="failed" && actual.order_status==="ACTIVE")) status="failed";
  if(event || status!==order.status) {
    await database("rpc/bv_settle",{p_id:id,p_status:status,p_currency:"INR",p_amount:order.amount,p_event:event?.id||id+":"+status,p_kind:event?.kind||"order reconciliation"});
  }
  return {status:(await readOrder(id)).status};
}
async function webhook(request: Request, raw: Uint8Array) {
  paymentSettings();
  const ts=request.headers.get("x-webhook-timestamp")||"";
  const sig=request.headers.get("x-webhook-signature")||"";
  requireValue(/^\d{10,13}$/.test(ts) && sig.length===44,401,"Invalid signature.");
  const prefix=new TextEncoder().encode(ts);
  const bytes=new Uint8Array(prefix.length+raw.length);
  bytes.set(prefix); bytes.set(raw,prefix.length);
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env("CASHFREE_SECRET_KEY")),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  let signature: Uint8Array;
  try { signature=Uint8Array.from(atob(sig),c=>c.charCodeAt(0)); } catch { throw new Problem(401,"Invalid signature."); }
  requireValue(await crypto.subtle.verify("HMAC",key,signature,bytes),401,"Invalid signature.");
  const event=JSON.parse(new TextDecoder().decode(raw));
  if(!["PAYMENT_SUCCESS_WEBHOOK","PAYMENT_FAILED_WEBHOOK","PAYMENT_USER_DROPPED_WEBHOOK"].includes(event.type))return {received:true};
  const order=event.data?.order, pay=event.data?.payment;
  requireValue(uuid.test(order?.order_id) && pay?.cf_payment_id && pay.payment_currency==="INR",400,"Invalid payment event.");
  const local=await readOrder(order.order_id);
  requireValue(order.order_currency==="INR" && Math.round(Number(order.order_amount)*100)===local.amount,409,"Amount mismatch.");
  const eventId=local.id+":"+pay.cf_payment_id+":"+event.type;
  const seen=await database("bv_events?select=event_id&processing_status=eq.processed&event_id=eq."+encodeURIComponent(eventId));
  if(!seen.length){
    try { await reconcile(local.id,{id:eventId,kind:event.type,attempt:pay.payment_status}); }
    catch(error){
      await database("rpc/bv_event_error",{p_event:eventId,p_id:local.id,p_kind:event.type,p_detail:error instanceof Problem?error.message:"Reconciliation temporarily unavailable"});
      throw error;
    }
  }
  return {received:true};
}
async function requestBytes(request: Request) {
  const reader=request.body?.getReader();
  if(!reader)return new Uint8Array();
  const parts: Uint8Array[]=[];
  let size=0;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    size+=value.length;
    if(size>65536){await reader.cancel();throw new Problem(413,"Request too large.");}
    parts.push(value);
  }
  const raw=new Uint8Array(size);
  let offset=0;
  for(const part of parts){raw.set(part,offset);offset+=part.length;}
  return raw;
}
Deno.serve(async request=>{
  if(request.method==="OPTIONS") return new Response(null,{headers});
  try {
    requireValue(request.method==="POST",405,"Use POST.");
    const raw=await requestBytes(request);
    if(new URL(request.url).pathname.endsWith("/webhook"))return response(await webhook(request,raw));
    const user=await customer(request);
    const body=JSON.parse(new TextDecoder().decode(raw));
    if(body.action==="ticket"){
      requireValue(typeof body.message==="string" && body.message.trim().length>0 && body.message.length<=1000 &&
        (!body.id || uuid.test(body.id)),400,"Enter a message of up to 1,000 characters.");
      const name=String(body.name || user.user_metadata?.username || "Reader").trim().slice(0,100);
      const id=await database("rpc/bv_ticket",{p_user:user.id,p_id:body.id||null,p_name:name||"Reader",p_email:user.email,
        p_title:String(body.subject||"Contact BOOKIVO").slice(0,150),p_topic:String(body.topic||"Others").slice(0,60),p_message:body.message.trim()});
      return response({id});
    }
    if(body.action==="review"){
      requireValue(typeof body.bookId==="string" && body.bookId.length<=80 && Number.isInteger(body.rating) && body.rating>=1 && body.rating<=5 &&
        typeof body.title==="string" && body.title.trim().length>=1 && body.title.length<=150 &&
        typeof body.body==="string" && body.body.trim().length>=1 && body.body.length<=2000,400,"Enter a rating, title and review.");
      const name=String(user.user_metadata?.username || user.user_metadata?.full_name || "BOOKIVO reader").trim().slice(0,100) || "BOOKIVO reader";
      await database("rpc/bv_review",{p_user:user.id,p_book:body.bookId,p_name:name,p_rating:body.rating,p_title:body.title.trim(),p_body:body.body.trim()});
      return response({saved:true});
    }
    if(body.action==="progress") {
      requireValue(typeof body.book==="string" && body.book.length<=80 && Number.isInteger(body.page) && Number.isInteger(body.revision),400,"Invalid page.");
      return response({revision:await database("rpc/bv_progress",{p_user:user.id,p_book:body.book,p_page:body.page,p_state:body.state,p_revision:body.revision})});
    }
    if(body.action==="welcome") {
      requireValue(typeof body.claim==="boolean",400,"Invalid selection.");
      return response({state:await database("rpc/bv_welcome",{p_user:user.id,p_claim:body.claim})});
    }
    paymentSettings();
    if(body.action==="status"){
      const ord=await readOrder(body.id,user.id);
      if(["paid","expired","cancelled"].includes(ord.status))return response({status:ord.status});
      return response(await reconcile(ord.id));
    }
    requireValue(body.action==="checkout",400,"Unknown request.");
    requireValue(env("BOOKIVO_SANDBOX_TESTERS").split(",").map(s=>s.trim()).includes(user.id),403,"Checkout is currently open to sandbox testers.");
    requireValue(uuid.test(body.id) && Array.isArray(body.books) && body.books.length>0 && body.books.length<=20 &&
      body.books.every((s:unknown)=>typeof s==="string" && /^[a-z0-9-]{1,80}$/.test(s)) &&
      /^[6-9]\d{9}$/.test(body.phone) && typeof body.name==="string" && body.name.trim().length>0 && body.name.length<=100 &&
      Number.isSafeInteger(body.expectedAmount) && body.expectedAmount>=100 && Number.isInteger(body.bits) && body.bits>=0 && body.bits<=100000 && typeof body.coupon==="string" && body.coupon.length<=32,400,"Check your order details.");
    const ord=await database("rpc/bv_prepare",{p_user:user.id,p_id:body.id,p_books:body.books,p_coupon:body.coupon.toUpperCase(),p_bits:body.bits,p_expected:body.expectedAmount});
    requireValue(ord.amount===body.expectedAmount,409,"The total changed. Refresh checkout.");
    if(ord.status==="paid")return response({paid:true,id:ord.id});
    requireValue(ord.status==="pending" || ord.status==="failed",409,"This payment session has ended.");
    const site=env("BOOKIVO_SITE_URL").replace(/\/+$/,"");
    const existing=await cashfree("/orders/"+ord.id,undefined,undefined,true);
    if(existing && existing.order_status!=="ACTIVE"){
      const settled=await reconcile(ord.id);
      if(settled.status==="paid")return response({paid:true,id:ord.id});
      throw new Problem(409,"This payment session has ended.");
    }
    const cf=existing || await cashfree("/orders",{order_id:ord.id,order_currency:"INR",order_amount:ord.amount/100,
      customer_details:{customer_id:user.id,customer_name:body.name.trim(),customer_email:user.email,customer_phone:body.phone},
      order_meta:{return_url:site+"/thankyou.html?order_id="+ord.id,notify_url:db+"/functions/v1/bookivo-store/webhook"}},ord.id);
    requireValue(cf.order_id===ord.id && cf.payment_session_id,502,"Payment session unavailable.");
    return response({id:ord.id,session:cf.payment_session_id});
  } catch(error) {
    if(error instanceof Problem)return response({error:error.message},error.status);
    if(error instanceof SyntaxError)return response({error:"Invalid request."},400);
    console.error("BOOKIVO service error",error instanceof Error ? error.name : "unknown");
    return response({error:"Service temporarily unavailable."},503);
  }
});

