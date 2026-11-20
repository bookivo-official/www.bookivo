(async function(){
  const config=window.BOOKIVO_SUPABASE_CONFIG;
  const client=window.supabase.createClient(config.url,config.publishableKey);
  const {data,error}=await client.auth.getUser();
  if(error || !data.user){
    sessionStorage.setItem('bv_after_signin',location.pathname);
    location.replace('../sign%20in/index.html');
    return;
  }
  const script=document.createElement('script');script.src='script.js';document.head.append(script);
})();
