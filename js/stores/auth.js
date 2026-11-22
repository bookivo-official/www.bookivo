'use strict';
(function (w) {
  const store = w.Bookivo.Store.create(null, 'auth');
  const client = w.Bookivo.supabase;
  let resolveReady;
  let readyResolved = false;
  const ready = new Promise(resolve => { resolveReady = () => { if (!readyResolved) { readyResolved = true; resolve(); } }; });
  function fromSupabaseUser(user) {
    if (!user) return null;
    const metadata = user.user_metadata || {};
    return {
      id: user.id,
      name: metadata.username || metadata.full_name || metadata.name || localStorage.getItem('bv_name_'+user.id) || 'bookivouser',
      email: user.email || '',
      createdAt: user.created_at || null,
      avatarUrl: metadata.avatar_url || null
    };
  }
  function syncSession(session) {
    store.set(fromSupabaseUser(session && session.user));
    resolveReady();
  }
  if (client) {
    client.auth.onAuthStateChange((_event, session) => syncSession(session));
    client.auth.getSession().then(({ data }) => syncSession(data && data.session)).catch(() => syncSession(null));
  } else {
    store.set(null);
    resolveReady();
  }
  let checking=false;
  async function checkDevice(){
    if(checking || !client || !store.get())return;
    checking=true;
    try{
      const {data,error}=await client.rpc('bv_session_current');
      if(!error && data===false){
        await client.auth.signOut({scope:'local'});
        location.replace(new URL('session-ended.html',document.baseURI));
      }
    }finally{checking=false;}
  }
  ready.then(checkDevice);window.addEventListener('focus',checkDevice);setInterval(checkDevice,15000);
  const AuthStore = {
    get:store.get,
    set:store.set,
    subscribe:store.subscribe,
    ready,
    isSignedIn:() => !!store.get(),
    logout:async() => {
      if (client) {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }
      store.set(null);
      return true;
    }
  };
  w.Bookivo.AuthStore = AuthStore;
})(window);

