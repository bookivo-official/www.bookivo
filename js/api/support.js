'use strict';
(function(B){
  B.Api.support={
    async createTicket(data){
      const user=B.AuthStore.get();
      if(!user)throw Error('Sign in to send a support ticket or contact BOOKIVO using the Instagram link in the footer.');
      if(data.email.trim().toLowerCase()!==user.email.toLowerCase())throw Error('Enter the email address for your signed-in account.');
      return B.Api.orders.action('ticket',data);
    },
    async listTickets(){
      const rows=await B.Api.orders.result(B.supabase.from('bv_tickets').select('id,status,subject,topic,bv_ticket_messages(id,sender,body)').order('created_at',{ascending:false}));
      return rows.map(t=>({...t,messages:t.bv_ticket_messages.sort((a,b)=>a.id-b.id).map(m=>({from:m.sender,body:m.body}))}));
    },
    async reply(id,message){return B.Api.orders.action('ticket',{id,message});}
  };
})(window.Bookivo);
