/* nine — interacciones mínimas de la página. */
(function () {
  'use strict';

  var anio = document.getElementById('anio');
  if (anio) {
    anio.textContent = String(new Date().getFullYear());
  }

  function copiarTexto(texto, listo) {
    function alternativa() {
      var area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'absolute';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        listo(true);
      } catch (err) {
        listo(false);
      }
      document.body.removeChild(area);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(
        function () { listo(true); },
        function () { alternativa(); }
      );
    } else {
      alternativa();
    }
  }

  document.querySelectorAll('[data-copiar]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      var pre = document.getElementById(boton.getAttribute('data-copiar'));
      if (!pre) {
        return;
      }
      copiarTexto(pre.textContent.trim(), function (ok) {
        if (!ok) {
          return;
        }
        var original = boton.textContent;
        boton.textContent = 'Copiado';
        setTimeout(function () {
          boton.textContent = original;
        }, 1600);
      });
    });
  });
})();
