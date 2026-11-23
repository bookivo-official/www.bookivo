// Chrome runs against a local copy. External traffic is intercepted, including all account and payment requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'), uid='10000000-0000-0000-0000-000000000001';
const user={id:uid,email:'reader@example.test',role:'authenticated',aud:'authenticated',user_metadata:{username:'Shelf tester'},email_confirmed_at:new Date().toISOString()};
const expiry=Math.floor(Date.now()/1000)+3600;
const jwt=[{alg:'HS256',typ:'JWT'},{sub:uid,exp:expiry,iat:expiry-3600,role:'authenticated',aud:'authenticated'}].map(o=>Buffer.from(JSON.stringify(o)).toString('base64url')).join('.')+'.fixture';
const session={user,access_token:jwt,refresh_token:'browser-test-only',expires_at:expiry,expires_in:3600,token_type:'bearer'};
const book={id:'book-2',title:'Turn Your Photos Into Cinematic Masterpieces',subtitle:'25 portrait prompts',pages:30,cover:'BOOK-2/images/portrait-prompts-3d-cover.png',storage_prefix:'cinematic-prompts'};
const row={user_id:uid,book_id:book.id,book,reading_status:'currently_reading',last_page:17,revision:1,purchased_at:'2026-11-20T00:00:00Z'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  const type={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'}[path.extname(file)];
  res.setHeader('Content-Type',type||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),writes=[];
 await ctx.addInitScript(()=>{window.Cashfree=options=>({checkout:async details=>{window.testCheckout={options,details};return {};}});});
 await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();if(!u.hostname.endsWith('.supabase.co'))return r.abort();
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};if(r.request().method()==='OPTIONS')return r.fulfill({status:200,headers});
 let value=[];if(u.pathname.endsWith('bv_public_settings'))value={disabled:false,banner:'BOOKIVO knowledge for your future',offers:[]};
 if(u.pathname.endsWith('bv_books'))value=[{id:'book-3'}];
 if(u.pathname.endsWith('bookivo-store')){const b=r.request().postDataJSON();writes.push(b);value=b.action==='account-exists'?{exists:true}:b.action==='guest-start'?{ready:true}:b.action==='checkout'?{id:b.id,session:'test-live-session',mode:'production'}:{};}
 return r.fulfill({json:value,headers});});
 await page.goto(origin+'/sign%20in/index.html');await page.locator('#signupForm .verify').waitFor();
 for(const [width,height] of [[390,844],[320,568]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'no empty mobile scroll');assert.equal(await page.locator('.chat-fab,.prime-standalone').count(),0);}
 await page.locator('#signupForm [name=username]').fill('Reader');await page.locator('#signupForm [name=email]').fill('existing@example.test');await page.locator('#signupForm .verify').click();await page.locator('.card.open').waitFor();assert.match(await page.locator('#toast').textContent(),/already have an account/);assert.equal(await page.locator('#loginForm [name=email]').inputValue(),'existing@example.test');
 await page.screenshot({path:path.join(root,'../.bookivo-qa/launch-signin.png')});
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/BOOK-3/index.html');await page.locator('#buyNowBtn').waitFor();await page.evaluate(()=>scrollTo(0,600));await page.waitForTimeout(300);
 const a=await page.locator('#shell-announcement').boundingBox();assert.equal(Math.round(a.y),0);
 const dock=await page.locator('.floating-actions').boundingBox();assert.ok(844-dock.y-dock.height<=12,'dock at bottom');
 await page.locator('#buyNowBtn').click();await page.locator('#checkoutModal.is-open').waitFor();assert.equal(await page.locator('#guestVerify,#guestCodeRow').count(),0);
 for(const [name,value] of Object.entries({name:'Test reader',email:'guest@example.test',phone:'9000000000'}))await page.locator('#checkoutModal [name='+name+']').fill(value);
 await page.locator('.checkout-submit').click();await page.waitForFunction(()=>window.testCheckout);assert.equal(await page.evaluate(()=>testCheckout.options.mode),'production');assert.ok(writes.some(b=>b.action==='guest-start'));assert.ok(!writes.some(b=>b.action==='guest-otp'));assert.equal(writes.find(b=>b.action==='checkout').expectedAmount,19900);
 await page.keyboard.press('Escape');await page.setViewportSize({width:1366,height:768});await page.reload();await page.locator('#buyNowBtn').waitFor();await page.evaluate(()=>scrollTo(0,1800));await page.waitForTimeout(500);const bar=await page.locator('#mobilePurchaseBar').boundingBox();assert.ok(bar.width<=380);assert.ok(bar.y<768);assert.ok(Math.abs(bar.x+bar.width/2-683)<2);
 console.log('PASS: mobile sign-in height, no PRIME, existing-account switch, sticky banner, bottom dock, no-OTP guest checkout, production SDK and compact desktop buy bar');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
