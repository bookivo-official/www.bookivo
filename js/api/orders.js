'use strict';
(function (B) {
  async function result(query) {
    const {data,error}=await query;
    if(error) throw new Error(error.message);
    return data;
  }
  async function action(action, values={}) {
    const {data,error}=await B.supabase.functions.invoke('bookivo-store',{body:{action,...values}});
    if(error) {
      const detail=await error.context?.json?.().catch(()=>null);
      throw new Error(detail?.error || error.message || 'Please retry.');
    }
    return data;
  }
  function signIn() {
    const next=new URL(location.href);
    sessionStorage.setItem('bv_after_signin',next.pathname+next.search);
    location.assign(new URL('sign in/index.html',document.baseURI));
  }
  async function library(id) {
    let query=B.supabase.from('bv_library').select('*,book:bv_books(*)').is('revoked_at',null);
    if(id) query=query.eq('book_id',id);
    return result(query.order('purchased_at',{ascending:false}));
  }
  function present(row) {
    return {orderId:row.id,createdAt:row.created_at,status:row.status,ownerId:row.user_id,
      items:row.bv_order_items.map(i=>({id:i.book_id,title:i.bv_books.title})),pricing:{total:row.amount/100}};
  }
  const selection='*,bv_order_items(book_id,bv_books(title))';
  B.Api.orders={result,action,signIn,library,
    async owns(id){return B.AuthStore.get() ? (await library(id)).length>0 : false;},
    async ownedBooks(){return (await library()).map(row=>row.book);},
    async list(){return (await result(B.supabase.from('bv_orders').select(selection).order('created_at',{ascending:false}))).map(present);},
    async createOrder(details){
      const fingerprint=JSON.stringify([B.AuthStore.get().id,details]);
      const saved=JSON.parse(sessionStorage.getItem('bv_checkout')||'null');
      const id=saved?.fingerprint===fingerprint ? saved.id : crypto.randomUUID();
      sessionStorage.setItem('bv_checkout',JSON.stringify({id,fingerprint}));
      try { return await action('checkout',{...details,id}); }
      catch(error){if(error.message==='This payment session has ended.')sessionStorage.removeItem('bv_checkout');throw error;}
    },
    async getStatus(id){
      if(!B.AuthStore.get()){signIn();return null;}
      let row=await result(B.supabase.from('bv_orders').select(selection).eq('id',id).maybeSingle());
      if(!row)return null;
      if(['pending','failed'].includes(row.status)) row.status=(await action('status',{id})).status;
      return present(row);
    }
  };
})(window.Bookivo);

