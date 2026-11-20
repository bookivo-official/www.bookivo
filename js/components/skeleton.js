'use strict';
(function (w) { w.Bookivo.Skeleton={book:()=>'<div class="book-skeleton" aria-hidden="true"><i></i><b></b><span></span><span></span></div>', grid:(n)=>Array.from({length:n||4},()=>w.Bookivo.Skeleton.book()).join('')}; })(window);

