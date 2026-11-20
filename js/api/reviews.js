'use strict';
(function(B){
  const cache=new Map();
  B.Api.reviews={
    async list(bookId){
      if(!cache.has(bookId)){
        const query=B.supabase.from('bv_reviews').select('id,book_id,display_name,rating,title,body,created_at').eq('book_id',bookId).order('created_at',{ascending:false});
        cache.set(bookId,B.Api.orders.result(query).then(rows=>rows.map(r=>({...r,name:r.display_name,verified:true,date:B.Format.date(r.created_at)}))).catch(()=>{cache.delete(bookId);return [];}));
      }
      return cache.get(bookId);
    },
    async add(review){
      if(!B.AuthStore.get())throw Error('You must buy this book before you can review it.');
      await B.Api.orders.action('review',review);
      cache.delete(review.bookId);
    }
  };
})(window.Bookivo);
