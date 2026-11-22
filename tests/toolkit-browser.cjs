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
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const ctx=await browser.newContext({permissions:['clipboard-read','clipboard-write']}),page=await ctx.newPage(),errors=[],writes=[],loads=[];
    await ctx.addInitScript(args=>localStorage.setItem('sb-xwfzuqbkckmmzzidmsgf-auth-token',JSON.stringify(args)),session);
    let entries=[],missing=false,libraryError=false;
    await ctx.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin || url.protocol==='blob:')return route.continue();
      if(url.hostname==='raw.githubusercontent.com')return route.fulfill({body:'%PDF-1.7 test fixture',contentType:'application/pdf',headers:{'access-control-allow-origin':'*'}});
      if(!url.hostname.endsWith('.supabase.co'))return route.abort();
      const endpoint=url.pathname.split('/').pop(),method=route.request().method();
      async function reply(data,status=200){return route.fulfill({status,json:data,headers:{'access-control-allow-origin':'*'}});}
      if(method==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'*'}});
      if(url.pathname.startsWith('/storage/')){
        loads.push(endpoint);
        if(endpoint==='prompts.json'){
          const data=process.env.BOOKIVO_TEST_PROMPTS ? JSON.parse(fs.readFileSync(process.env.BOOKIVO_TEST_PROMPTS,'utf8')) : {17:'Offline clipboard test'};
          return reply(data);
        }
        if(missing)return reply({message:'Missing'},404);
        const folder = url.pathname.includes('/bachelor-cookbook/') ? process.env.BOOKIVO_TEST_COOKBOOK_IMAGES : process.env.BOOKIVO_TEST_IMAGES;
        const image = folder ? path.join(folder,endpoint) : path.join(root,book.cover);
        return route.fulfill({path:image,contentType:'image/png',headers:{'access-control-allow-origin':'*'}});
      }
      if(endpoint==='bv_public_settings')return reply({disabled:false,offers:[{code:'BOOKIVO',percent:2,minimum:10000,cap:null,listed:true,show_product:true,book_ids:['book-3']}],banner:'BOOKIVO'});
      if(endpoint==='bv_books')return reply([{id:'book-2'},{id:'book-3'}].filter(b=>!url.searchParams.get('id')||url.searchParams.get('id').includes(b.id)));
      if(endpoint==='user')return reply(user);
      if(endpoint==='bv_profiles')return reply({bits:0,welcome_state:'dismissed'});
      if(endpoint==='bv_library')return libraryError?reply({message:'Offline'},503):reply(entries);
      if(endpoint==='bookivo-store'){const body=route.request().postDataJSON();writes.push(body);if(body.action==='prime')return reply({reply:'Once payment is confirmed, open My Shelf.'});return body.action==='checkout'?reply({id:body.id,session:'offline-session'}):reply({revision:body.revision+1});}
      return reply([]);
    });
    page.on('pageerror',e=>errors.push(e.message));

    await page.goto(origin+'/BOOK-3/index.html');await page.getByRole('heading',{name:'The AI Toolkit: Turn Everyday Tasks into Done',exact:true}).waitFor();
    assert.equal(await page.locator('[data-gallery-index]').count(),5);
    await page.getByRole('button',{name:'APPLY NOW',exact:true}).click();
    assert.match(await page.locator('.book-price').textContent(),/195\.02/);
    assert.match(await page.locator('[data-sticky-buy] strong').textContent(),/195\.02/);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('bv_selected_coupon')),'BOOKIVO');
    await page.locator('[data-book-buy]').click();await page.locator('#checkoutModal').waitFor();assert.equal(await page.locator('#checkoutModal [name=coupon]').inputValue(),'BOOKIVO');assert.match(await page.locator('#checkoutModal').textContent(),/195\.02/);await page.keyboard.press('Escape');

    const faq=page.locator('[data-accordion-trigger]');await faq.nth(0).click();await faq.nth(1).click();assert.equal(await page.locator('.accordion-item.is-open').count(),1);assert.equal(await faq.nth(0).getAttribute('aria-expanded'),'false');
    for(const width of [390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    await page.locator('.site-footer').scrollIntoViewIfNeeded();const author=await page.locator('.footer-author').boundingBox(),social=await page.locator('.social-strip').boundingBox();assert.ok(author.x>social.x+social.width-1);await page.screenshot({path:path.join(root,'../.bookivo-qa/toolkit-footer.png')});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(root,'../.bookivo-qa/toolkit-product.png')});
    await page.goto(origin+'/coupons.html');await page.getByRole('button',{name:'Copy code',exact:true}).first().click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'BOOKIVO');
    entries=[{...row,book_id:'book-3',book:{id:'book-3',title:'AI Toolkit',pages:38,cover:'BOOK-3/images/cover.png'}}];
    await page.goto(origin+'/read.html?book=book-3');await page.getByRole('button',{name:'DOWNLOAD NOW',exact:true}).waitFor();assert.equal(await page.locator('iframe').count(),0);
    const before=page.url();const dl=page.waitForEvent('download');await page.getByRole('button',{name:'DOWNLOAD NOW',exact:true}).click();assert.equal((await dl).suggestedFilename(),'BOOKIVO-AI-Toolkit.pdf');assert.equal(page.url(),before);
    entries=[];await page.reload();await page.getByText('This book is not on your shelf').waitFor();assert.equal(await page.locator('[data-download]').count(),0);
    await page.goto(origin+'/thankyou.html?order_id=test');
    // Inject only the order response, then exercise the real Thank You renderer.
    await page.waitForFunction(()=>window.Bookivo?.PageHandlers?.thankyou);
    await page.evaluate(async()=>{Bookivo.Api.orders.getStatus=async()=>({status:'paid',orderId:'test',items:[{id:'book-3'}],pricing:{total:199}});await Bookivo.PageHandlers.thankyou();});
    await page.getByRole('button',{name:/Download your ebook/}).waitFor();
    await page.evaluate(async()=>{Bookivo.Api.orders.getStatus=async()=>({status:'cancelled',orderId:'test',items:[]});await Bookivo.PageHandlers.thankyou();});
    assert.equal(await page.getByRole('button',{name:/Download your ebook/}).count(),0);
    assert.deepEqual(errors,[]);console.log('PASS toolkit gallery, responsive product page, scoped Apply Now, FAQ exclusivity, copy code, download without navigation, ownership and paid-only download controls.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
