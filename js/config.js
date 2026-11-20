'use strict';
(function (w) {
  const params = new URLSearchParams(w.location.search);
  const host = w.location.hostname;
  w.BOOKIVO_CONFIG = { USE_MOCK: false, AUTH_PROVIDER: 'supabase', META_PIXEL_ID: '' };
  w.Bookivo = w.Bookivo || {};
  const publicConfig = w.BOOKIVO_SUPABASE_CONFIG || {};
  const supabaseGlobal = w.supabase;
  const supabaseClient = supabaseGlobal && publicConfig.url && publicConfig.publishableKey
    ? supabaseGlobal.createClient(publicConfig.url, publicConfig.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  w.Bookivo.supabase = supabaseClient;
  w.Bookivo.config = {
    dev: host === 'localhost' || host === '127.0.0.1' || host === '' || params.get('dev') === '1',
    brand: 'BOOKIVO',
    author: 'the_samsonpaul',
    supabaseEnabled: !!supabaseClient
  };
})(window);

