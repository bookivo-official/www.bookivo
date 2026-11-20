'use strict';
(function (w) {
  function openBookivoSignIn() {
    w.location.replace(new URL('sign in/index.html', w.location.href).href);
  }
  w.Bookivo.PageHandlers.login = openBookivoSignIn;
  w.Bookivo.PageHandlers.signup = openBookivoSignIn;
})(window);
