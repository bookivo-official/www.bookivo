(async function(){
  const config=window.BOOKIVO_SUPABASE_CONFIG;
  const client=window.supabase.createClient(config.url,config.publishableKey);
  const {data,error}=await client.auth.getUser();
  if(error || !data.user){
    sessionStorage.setItem('bv_after_signin',location.pathname);
    location.replace('../sign%20in/index.html');
    return;
  }
  async function checkDevice(){
    const {data}=await client.rpc('bv_session_current');
    if(data===false){await client.auth.signOut({scope:'local'});location.replace('../session-ended.html');return false;}
    return true;
  }
  if(!await checkDevice())return;
  setInterval(checkDevice,15000);window.addEventListener('focus',checkDevice);
  window.Bookivo.Chat.init(client.auth);
  const script=document.createElement('script');script.src='script.js';document.head.append(script);
})();
