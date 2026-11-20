'use strict';
(function(B){
  const api=()=>B.Api.orders;
  async function profile(){
    if(!B.AuthStore.get())return null;
    return api().result(B.supabase.from('bv_profiles').select('bits,welcome_state').eq('id',B.AuthStore.get().id).single());
  }
  B.Api.pages={
    async getBalance(){const row=await profile();B.PagesStore.set(row?.bits||0);return B.PagesStore.get();},
    async getHistory(){const rows=await api().result(B.supabase.from('bv_bit_history').select('reason,amount,created_at').order('created_at',{ascending:false}));return rows.map(r=>({...r,date:r.created_at}));},
    async welcomeStatus(){return (await profile())?.welcome_state;},
    async dismissWelcome(){return api().action('welcome',{claim:false});},
    async claimWelcome(){const {state}=await api().action('welcome',{claim:true});return {claimed:state==='claimed',reward:state==='claimed'?10:0,balance:await this.getBalance()};}
  };
})(window.Bookivo);
