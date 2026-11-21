const url=Deno.env.get('SUPABASE_URL')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminEmail='samsonpaul19112009@gmail.com';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-admin-session,x-client-info,content-type','Content-Type':'application/json','Cache-Control':'no-store'};
function fail(message:string):never{throw new Error(message);}
async function db(path:string,method='GET',body?:unknown){
 const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)fail('Could not save or load this record. Check its values and try again.');
 return JSON.parse(await r.text()||'null');
}
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');}
const topics=['Creating Account','Bookivo Web Features','Coupons & Bits','Payment Issue','Others'];
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});
 try{
 if(req.method!=='POST')return send({},405);
 const b=await req.json(), a=b.action;
 if(a==='visit'){
 if(!/^[0-9a-f-]{36}$/i.test(b.visitor)||!['Visit','Product','InitiateCheckout','CodeSent','Verified','PaymentStarted'].includes(b.stage))return send({},400);
 const day=new Date(Date.now()+19800000).toISOString().slice(0,10);
 const r=await fetch(url+'/rest/v1/bv_visits',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({visitor:b.visitor,stage:b.stage,day})});
 if(!r.ok)return send({},503);
 if(b.stage!=='Visit'){
 const books=Array.isArray(b.books)&&b.books.length?b.books.slice(0,20):[''];
 const records=[...new Set(books)].map(book=>({book:String(book).slice(0,80),day,visitor:b.visitor,stage:b.stage,source:String(b.source||'Direct').slice(0,60),device:b.device==='Mobile'?'Mobile':'Desktop'}));
 await fetch(url+'/rest/v1/bv_funnel',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(records)});
 }
 return send({ok:true});
 }
 if(a==='login'){
 const ip=await hash(req.headers.get('x-forwarded-for')?.split(',').pop()?.trim()||'shared');
 if(!await db('rpc/bv_limit','POST',{k1:'admin-login:'+ip,maximum:12,seconds:600}))return send({error:'Try again in ten minutes.'},429);
 const password=Deno.env.get('BOOKIVO_ADMIN_PASSWORD');
 if(!password||password.length<12||b.email?.toLowerCase()!==adminEmail||typeof b.password!=='string'||await hash(b.password)!==await hash(password))return send({error:'Check the admin email and password.'},401);
 const token=crypto.randomUUID()+crypto.randomUUID();
 await db('bv_admin_sessions','POST',{hash:await hash(token),expires:new Date(Date.now()+3600000).toISOString()});return send({token});
 }
 const key=await hash(req.headers.get('x-admin-session')||''),filter='?hash=eq.'+key+'&expires=gt.'+encodeURIComponent(new Date().toISOString());
 const [session]=await db('bv_admin_sessions'+filter);if(!session)return send({error:'Please sign in again.'},401);
 if(a==='logout'){await db('bv_admin_sessions'+filter,'DELETE');return send({ok:true});}
 if(a==='funnel')return send(await db('rpc/bv_funnel_report','POST',{p_book:b.book||'',p_device:b.device||'',p_source:b.source||''}));
 if(a==='overview'){await db('rpc/bv_prune_metrics','POST',{});return send({metrics:await db('rpc/bv_metrics','POST',{}),books:await db('bv_books?select=id,title'),controls:(await db('bv_controls'))[0],offers:await db('bv_offers?order=code')});}
 if(a==='orders'||a==='support'){
 const offset=Math.max(0,Math.floor(Number(b.offset)||0));const page='&limit=50&offset='+offset;
 if(a==='orders'){
 const n=Number(b.days);const start=new Date(Date.now()+19800000);start.setUTCHours(0,0,0,0);const since=[1,7,30,90].includes(n)?'&created_at=gte.'+new Date(+start-19800000-(n-1)*86400000).toISOString():'';
 return send(await db('bv_orders?select=id,created_at,status,amount,coupon,bv_order_items(book_id,price,discount)&order=created_at.desc'+since+page));}
 const guest=b.kind==='guest', table=guest?'bv_contact_inbox':'bv_tickets';
 return send(await db(table+'?select=*,'+(guest?'bv_admin_replies(*)':'bv_ticket_messages(*)')+'&order=created_at.desc'+(topics.includes(b.topic)?'&topic=eq.'+encodeURIComponent(b.topic):'')+page));
 }
 if(a==='reply'){
 if(!/^[0-9a-f-]{36}$/.test(b.id)||typeof b.message!=='string'||!b.message.trim()||b.message.length>1000)fail('Enter a reply of up to 1,000 characters.');
 const guest=b.kind==='guest';const [row]=await db((guest?'bv_contact_inbox':'bv_tickets')+'?id=eq.'+b.id);
 if(!row)fail('Message unavailable.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':await hash(b.id+b.message)},body:JSON.stringify({from:Deno.env.get('BOOKIVO_FROM_EMAIL'),to:[guest?row.email:row.contact_email],subject:'BOOKIVO support · '+row.topic,text:b.message})});
 if(!r.ok)fail('Email delivery failed. Check the sender configuration and retry.');
 if(guest)await db('bv_admin_replies','POST',{id:crypto.randomUUID(),contact:b.id,body:b.message});
 else{await db('bv_ticket_messages','POST',{ticket_id:b.id,sender:'BOOKIVO Support',body:b.message});await db('bv_tickets?id=eq.'+b.id,'PATCH',{status:'Replied'});}
 return send({ok:true});
 }
 if(a==='banner'){if(typeof b.text!=='string'||!b.text.trim()||b.text.length>180)fail('Use 1–180 characters.');await db('bv_controls?id=eq.1','PATCH',{banner:b.text.trim()});return send({ok:true});}
 if(['create','edit','enable','disable','delete'].includes(a)){
 const code=String(b.code).toUpperCase();if(!/^[A-Z0-9_-]{1,32}$/.test(code))fail('Invalid coupon code.');
 const path='bv_offers?code=eq.'+code;
 if(a==='delete')await db(path,'DELETE');
 else if(a==='enable'||a==='disable')await db(path,'PATCH',{enabled:a==='enable'});
 else{const values={percent:b.percent,minimum:b.minimum,cap:b.cap,starts:b.starts,expires:b.expires,auto:!!b.auto,listed:!!b.listed,description:String(b.description||'').slice(0,180)};
 await db(a==='create'?'bv_offers':path,a==='create'?'POST':'PATCH',a==='create'?{...values,code}:values);}
 return send({ok:true});
 }
 if(a==='restore'){await db('bv_controls?id=eq.1','PATCH',{disabled:false});return send({ok:true});}
 if(a==='cancel'){await db('bv_admin_sessions'+filter,'PATCH',{step:0,after_time:null});return send({ok:true});}
 if(a==='begin'||a==='next'||a==='shutdown'){
 const step=a==='begin'?0:a==='next'?1:2;
 const rows=await db('bv_admin_sessions'+filter+(step?'&step=eq.'+step+'&after_time=lte.'+new Date().toISOString():''),'PATCH',{step:(step+1)%3,after_time:new Date(Date.now()+(step===0?10000:30000)).toISOString()});
 if(!rows.length)fail('Wait for the confirmation timer.');
 if(a==='shutdown')await db('bv_controls?id=eq.1','PATCH',{disabled:true});
 return send({ok:true});
 }
 return send({},400);
 }catch(e){return send({error:e instanceof Error?e.message:'Request failed'},400);}
});
