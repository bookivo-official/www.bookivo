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
      if(endpoint==='bv_public_settings')return reply({disabled:false,offers:[],banner:'BOOKIVO'});
      if(endpoint==='bv_books')return reply([{id:'book-2'}]);
      if(endpoint==='user')return reply(user);
      if(endpoint==='bv_profiles')return reply({bits:0,welcome_state:'dismissed'});
      if(endpoint==='bv_library')return libraryError?reply({message:'Offline'},503):reply(entries);
      if(endpoint==='bookivo-store'){const body=route.request().postDataJSON();writes.push(body);if(body.action==='prime')return reply({reply:'Once payment is confirmed, open My Shelf.'});return body.action==='checkout'?reply({id:body.id,session:'offline-session'}):reply({revision:body.revision+1});}
      return reply([]);
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/books.html');await page.waitForFunction(()=>document.querySelector('#catalogCount')?.textContent.includes('12'));
    // PRIME stays alongside the storefront and survives full document navigation.
    const prime = page.locator('#chatModal');
    for (const width of [1440, 390]) {
      await page.setViewportSize({width,height:844});
      await page.goto(origin+'/cart.html');
      const empty = page.locator('#cartEmpty');
      await empty.waitFor();
      const card = await empty.boundingBox(), main = await page.locator('#pageMain').boundingBox();
      assert.ok(Math.abs(card.width-main.width)<2 && Math.abs(card.x-main.x)<2,'Empty cart fills the centred content area');
      for (const cls of ['.chat-fab','.contact-fab']) {
        assert.equal(await page.locator(cls).evaluate(el=>getComputedStyle(el).borderTopWidth),'3px');
      }
      await page.getByRole('button',{name:'Chat PRIME',exact:true}).click();
      await prime.waitFor();
      const dock = await page.locator('.chat-fab').boundingBox(), panel = await prime.boundingBox();
      assert.ok(panel.y>=0 && panel.y+panel.height<=dock.y+1 && Math.abs(panel.x+panel.width-dock.x-dock.width)<3);
      assert.equal(await page.locator('body.modal-open,.modal-backdrop.is-open').count(),0);
      await page.evaluate(()=>window.scrollTo(0,500));
      assert.ok(await page.evaluate(()=>scrollY>0),'Store scrolls under open chat');
      await prime.getByRole('textbox').fill('How do I get my ebook?');
      await prime.getByRole('button',{name:'Send message'}).click();
      await prime.getByText(/Once payment is confirmed/).first().waitFor();
      await prime.getByRole('textbox').fill('Unsent question');
      await page.getByRole('link',{name:'Browse ebooks',exact:true}).click();
      await page.waitForURL('**/books.html');
      await prime.waitFor();
      assert.equal(await prime.getByRole('textbox').inputValue(),'Unsent question');
      await prime.getByText(/Once payment is confirmed/).first().waitFor();
      await page.goto(origin+'/BOOK-2/index.html');
      await prime.waitFor();
      await page.keyboard.press('Escape');
      assert.ok(await prime.isVisible());
      await page.goto(origin+'/Free%20calculater/index.html');
      await prime.waitFor();
      await prime.getByText(/Once payment is confirmed/).first().waitFor();
      await prime.getByRole('button',{name:'Close Chat PRIME'}).click();
      await page.goto(origin+'/cart.html');
      await page.locator('#cartEmpty').waitFor();
      assert.ok(await prime.isHidden());
    }
    await page.goto(origin+'/BOOK-2/index.html');await page.waitForFunction(()=>window.BookivoBookCanReview===false && document.scripts.length>20);
    await page.waitForFunction(()=>Array.from(document.scripts).some(s=>s.src.endsWith('/BOOK-2/book.js')));
    await page.locator('#addToCartBtn').click();await page.waitForFunction(()=>window.Bookivo.CartStore.count()===1);
    await page.locator('#buyNowBtn').click();await page.locator('#checkoutModal.is-open').waitFor();
    assert.equal(await page.locator('[data-grand-total]').innerText(),'₹25');
    await page.locator('#checkoutModal input[name=phone]').fill('9000000000');
    await page.evaluate(()=>{window.Cashfree=()=>({checkout:async options=>{window.fixtureGatewaySession=options.paymentSessionId;return {};}});});
    await page.locator('.checkout-submit').click();await page.waitForFunction(()=>window.fixtureGatewaySession==='offline-session');
    assert.ok(writes.some(w=>w.action==='checkout' && w.books[0]==='book-2' && w.expectedAmount===2500));
    await page.goto(origin+'/my-books.html');await page.locator('.shelf-empty').waitFor();
    assert.equal(await page.locator('.shelf-section').count(),3);assert.equal(await page.locator('.wood-deck > *').count(),18);
    assert.match(await page.locator('.shelf-discovery').getAttribute('href'),/BOOK-2\/index.html/);
    for(const width of [360,390,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Shelf overflow at '+width);
    }
    for(const count of [2,18,21]){
      entries=Array.from({length:count},(_,i)=>({...row,book_id:'qa-'+i,reading_status:['currently_reading','next_up','finished'][i%3],book:{...book,id:'qa-'+i,title:'Owned '+i}}));
      await page.reload();await page.getByRole('button',{name:'All Books',exact:true}).click();
      await page.waitForFunction(n=>document.querySelectorAll('a.shelf-volume:not(.shelf-discovery)').length===n,count);
    }
    entries=Array.from({length:8},(_,i)=>({...row,book_id:'qa-'+i,book:{...book,id:'qa-'+i,title:'Library title '+i}}));
    await page.reload();await page.locator('[data-expand]').click();
    assert.equal(await page.locator('.shelf-section').first().locator('a').count(),8);
    await page.getByRole('button',{name:'All Books',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search in My Shelf'}).fill('title 3');assert.equal(await page.locator('.shelf-volume').count(),1);
    await page.getByLabel('Sort books').selectOption('progress');
    libraryError=true;await page.reload();await page.getByText('Try again',{exact:true}).waitFor();libraryError=false;entries=[row];
    await page.getByText('Try again',{exact:true}).click();await page.getByText('Continue · p. 17').waitFor();assert.equal(await page.locator('.shelf-discovery').count(),0);
    await page.setViewportSize({width:390,height:844});await page.locator('.shelf-volume').click();
    const frame=page.frameLocator('iframe');
    await frame.locator('.my-page img[src^="blob:"]').first().waitFor({state:'attached'});
    await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#pageNum')?.textContent.includes('17 of 30'));
    await page.waitForTimeout(600);assert.ok(writes.some(w=>w.page===17));assert.ok(new Set(loads).size<=5);
    await frame.locator('.copy-prompt-btn[data-page="17"]:visible').first().click();
    await frame.locator('#copyToast.show').waitFor();
    assert.equal(await frame.locator('#copyToast').innerText(),'COPIED SUCCESSFULLY');
    const expected=process.env.BOOKIVO_TEST_PROMPTS?JSON.parse(fs.readFileSync(process.env.BOOKIVO_TEST_PROMPTS,'utf8'))['17']:'Offline clipboard test';
    assert.ok(await page.evaluate(async value=>{
      const normalise=text=>text.replace(/\r\n/g,'\n');
      return normalise(await navigator.clipboard.readText())===normalise(value);
    },expected),'Clipboard content matches the private page');
    await frame.locator('.my-page img[data-page="17"]:visible').first().click({position:{x:25,y:70}});
    await frame.locator('#imgViewer.open').waitFor();await frame.locator('#viewerClose').click();
    await frame.locator('#nextBtn').click();await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#pageNum').textContent.includes('18 of 30'),null,{timeout:6000}).catch(async e=>{console.error('After next:',await frame.locator('#pageNum').innerText(),errors);throw e;});
    await page.waitForTimeout(800);assert.ok(writes.some(w=>w.page===18));
    for (const width of [390,1440]) {
      await page.setViewportSize({width,height:844});
      await page.reload();
      await frame.locator('.my-page img[src^="blob:"]').first().waitFor({state:'attached'});
      await page.waitForFunction(()=>/of 30/.test(document.querySelector('iframe')?.contentDocument?.querySelector('#pageNum')?.textContent));
      assert.equal(await page.locator('.site-header,.secondary-nav,.announcement,.floating-actions,#chatModal').count(),0);
      const initial = await frame.locator('#pageNum').innerText();
      await frame.locator('#prevBtn').click();
      await page.waitForFunction(value=>document.querySelector('iframe').contentDocument.querySelector('#pageNum').textContent!==value,initial);
      const previous = await frame.locator('#pageNum').innerText();
      assert.ok(parseInt(previous)<parseInt(initial),'Previous moves backward at '+width);
      await frame.locator('#nextBtn').click();
      await page.waitForFunction(value=>document.querySelector('iframe').contentDocument.querySelector('#pageNum').textContent===value,initial);
      await frame.locator('.my-page img[src^="blob:"]:visible').first().click({position:{x:40,y:80}});
      await frame.locator('#imgViewer.open').waitFor();
      const expanded = await page.locator('iframe').boundingBox();
      assert.deepEqual(expanded,{x:0,y:0,width,height:844});
      const enlargedPage = await frame.locator('#viewerImg').getAttribute('data-page');
      await frame.locator('#viewerPrev').click();
      assert.equal(Number(await frame.locator('#viewerImg').getAttribute('data-page')),Number(enlargedPage)-1);
      await frame.locator('#viewerNext').click();
      assert.equal(await frame.locator('#viewerImg').getAttribute('data-page'),enlargedPage);
      await page.keyboard.press('Escape');
      await frame.locator('#imgViewer.open').waitFor({state:'hidden'});
      assert.ok((await page.locator('iframe').boundingBox()).y>0);
    }
    await page.getByText('Mark unread',{exact:true}).click();await page.waitForURL('**/my-books.html');assert.ok(writes.some(w=>w.state==='next_up'));
    missing=true;await page.goto(origin+'/read.html?book=book-2');await frame.getByRole('button',{name:'Retry'}).waitFor();
    missing=false;await frame.getByRole('button',{name:'Retry'}).click({timeout:4000}).catch(async e=>{console.error('Retry layout:',await frame.locator('#readerStatus').evaluate(el=>[innerWidth,innerHeight,el.getBoundingClientRect().toJSON(),el.querySelector('button')?.getBoundingClientRect().toJSON()]),await page.locator('iframe').boundingBox());throw e;});await frame.locator('.my-page img[src^="blob:"]').first().waitFor({state:'attached'});
    const cookbook = {id:'cookbook',title:'Bachelor 99 Survival Cookbook',pages:114,storage_prefix:'bachelor-cookbook'};
    entries = [{...row,book_id:cookbook.id,book:cookbook,last_page:34}];
    await page.goto(origin+'/read.html?book=cookbook');
    await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#pageNum')?.textContent==='34 of 114');
    await frame.locator('#prevBtn').click();
    await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#pageNum').textContent==='32 of 114');
    await frame.locator('#nextBtn').click();
    await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#pageNum').textContent==='34 of 114');
    entries=[];await page.reload();await page.getByText('This book is not on your shelf').waitFor();assert.equal(await page.locator('iframe').count(),0);
    const guest=await browser.newContext();
    await guest.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.request().url().endsWith('/bv_public_settings')?r.fulfill({json:{disabled:false,offers:[]},headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}}):r.abort());
    const gp=await guest.newPage();await gp.goto(origin+'/read.html?book=book-2');await gp.waitForURL('**/sign%20in/index.html');
    await gp.getByRole('button',{name:'Chat PRIME',exact:true}).click();
    await gp.locator('#chatModal').waitFor();
    await gp.goto(origin+'/books.html');
    await gp.locator('#chatModal').waitFor();
    await gp.getByRole('button',{name:'Close Chat PRIME'}).click();
    await guest.close();
    assert.deepEqual(errors,[]);console.log('PASS: desktop and mobile spread navigation, viewport zoom, centred cart and persistent nonmodal chat; catalogue boot; five responsive widths; empty, full, search, retry and discovery shelves; owner and non-owner reader; resume, page turn, progress, reset and missing-image retry');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());

