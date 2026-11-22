const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
 const page=await browser.newPage(),calls=[],payloads=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let disabled=false;
 await page.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.host==='bookivo.test'){const file=path.join(__dirname,'..',u.pathname);return route.fulfill({path:file});}
 if(route.request().method()==='OPTIONS')return route.fulfill({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
 const b=route.request().postDataJSON();calls.push(b.action);payloads.push(b);
 let data={ok:true};
 if(b.action==='login')data={token:'test'};
 if(b.action==='overview')data={metrics:{activity:[],sales:[],buyers:{1:0,7:0,30:0},outcomes:[]},books:[{id:'book-2',title:'Portraits'},{id:'book-3',title:'AI Toolkit'}],controls:{disabled,banner:'BOOKIVO'},offers:[]};
 if(b.action==='funnel')data={sources:[],counts:{}};
 if(['orders','support'].includes(b.action))data=[];
 if(b.action==='shutdown')disabled=true;
 return route.fulfill({json:data,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
 });
 await page.goto('http://bookivo.test/admin.html');
 await page.getByLabel('Email',{exact:true}).fill('owner@example.test');await page.getByLabel('Password').fill('fixture-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByText('Guest email verification',{exact:true}).waitFor();
 for(const tab of ['All orders','Visitor insights','Contact support','Coupons','BOOKIVO','Danger']){
 await page.getByRole('button',{name:tab,exact:true}).click();await page.getByRole('heading',{name:tab,exact:true}).waitFor();
 if(tab==='Coupons'){await page.getByText('Generate code',{exact:true}).click();assert.match(await page.getByLabel('Coupon code').inputValue(),/^BOOKIVO-[A-Z0-9]{4}$/);
 await page.locator('[name=percent]').fill('10');await page.locator('[name=scope]').selectOption('selected');await page.getByLabel('AI Toolkit',{exact:true}).check();await page.locator('[name=show_product]').check();await page.locator('[name=listed]').uncheck();await page.getByRole('button',{name:'Create coupon',exact:true}).click();await page.locator('#yes').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await page.getByRole('heading',{name:'Coupons',exact:true}).waitFor();
 await new Promise(r=>setTimeout(r,100));const created=payloads.find(x=>x.action==='create');assert.deepEqual(created.book_ids,['book-3']);assert.equal(created.show_product,true);assert.equal(created.listed,false);
}
 }
 await page.clock.install();await page.locator('#power').click();await page.locator('dialog[open]').waitFor();
 assert.equal(await page.locator('#yes').isDisabled(),true);await page.clock.fastForward(11000);await page.locator('#yes').click();await page.getByRole('heading',{name:'Customer preview'}).waitFor();
 assert.equal(await page.locator('#yes').isDisabled(),true);await page.clock.fastForward(31000);await page.locator('#yes').click();await page.getByRole('button',{name:'Restore BOOKIVO'}).waitFor();
 await page.locator('#calcBtn').click();for(const key of ['2','+','3','='])await page.locator('#calc').getByRole('button',{name:key,exact:true}).click();
 assert.equal(await page.locator('output').textContent(),'5');assert.deepEqual(errors,[]);
 await page.locator('#logout').click();await page.locator('dialog[open]').waitFor();await page.locator('#cancel').click();assert.ok(await page.locator('#console').isVisible());
 await page.locator('#logout').click();await page.locator('#yes').click();await page.locator('#login').waitFor({state:'visible'});
 console.log('PASS admin login, seven sections, code generation, maintenance timers and calculator.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
