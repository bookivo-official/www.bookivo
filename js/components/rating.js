'use strict';
(function (w) {
  function summary(reviews) { const rows=reviews||[]; const count=rows.length; return {count, average:count?Math.round(rows.reduce((s,r)=>s+Number(r.rating||0),0)/count*10)/10:0}; }
  function html(value) { const n=Math.max(0,Math.min(5,Number(value)||0)); const full=Math.round(n); return `<span class="rating-stars" aria-label="${n} out of 5 stars">${'★'.repeat(full)}${'☆'.repeat(5-full)}</span>`; }
  w.Bookivo.Rating={summary,html};
})(window);

