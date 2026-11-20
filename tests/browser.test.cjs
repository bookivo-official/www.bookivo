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
        const image=process.env.BOOKIVO_TEST_IMAGES?path.join(process.env.BOOKIVO_TEST_IMAGES,endpoint):path.join(root,book.cover);
        return route.fulfill({path:image,contentType:'image/png',headers:{'access-control-allow-origin':'*'}});
      }
      if(endpoint==='user')return reply(user);
      if(endpoint==='bv_profiles')return reply({bits:0,welcome_state:'dismissed'});
      if(endpoint==='bv_library')return libraryError?reply({message:'Offline'},503):reply(entries);
      if(endpoint==='bookivo-store'){const body=route.request().postDataJSON();writes.push(body);return reply({revision:body.revision+1});}
      return reply([]);
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/books.html');await page.waitForFunction(()=>document.querySelector('#catalogCount')?.textContent.includes('12'));
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
    await page.getByText('Mark unread',{exact:true}).click();await page.waitForURL('**/my-books.html');assert.ok(writes.some(w=>w.state==='next_up'));
    missing=true;await page.goto(origin+'/read.html?book=book-2');await frame.getByRole('button',{name:'Retry'}).waitFor();
    missing=false;await frame.getByRole('button',{name:'Retry'}).click({timeout:4000}).catch(async e=>{console.error('Retry layout:',await frame.locator('#readerStatus').evaluate(el=>[innerWidth,innerHeight,el.getBoundingClientRect().toJSON(),el.querySelector('button')?.getBoundingClientRect().toJSON()]),await page.locator('iframe').boundingBox());throw e;});await frame.locator('.my-page img[src^="blob:"]').first().waitFor({state:'attached'});
    entries=[];await page.reload();await page.getByText('This book is not on your shelf').waitFor();assert.equal(await page.locator('iframe').count(),0);
    const guest=await browser.newContext();
    await guest.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const gp=await guest.newPage();await gp.goto(origin+'/read.html?book=book-2');await gp.waitForURL('**/sign%20in/index.html');await guest.close();
    assert.deepEqual(errors,[]);console.log('PASS: catalogue boot; five responsive widths; empty, full, search, retry and discovery shelves; owner and non-owner reader; resume, page turn, progress, reset and missing-image retry');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());

