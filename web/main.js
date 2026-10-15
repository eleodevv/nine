/* nine — interacciones mínimas de la página. */
(function () {
  'use strict';

  var anio = document.getElementById('anio');
  if (anio) {
    anio.textContent = String(new Date().getFullYear());
  }

  /* Menú móvil */
  var botonMenu = document.querySelector('[data-menu]');
  var menuMovil = document.getElementById('menu-movil');
  if (botonMenu && menuMovil) {
    botonMenu.addEventListener('click', function () {
      var abierto = botonMenu.getAttribute('aria-expanded') === 'true';
      botonMenu.setAttribute('aria-expanded', abierto ? 'false' : 'true');
      menuMovil.hidden = abierto;
    });
    menuMovil.querySelectorAll('a').forEach(function (enlace) {
      enlace.addEventListener('click', function () {
        botonMenu.setAttribute('aria-expanded', 'false');
        menuMovil.hidden = true;
      });
    });
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
      var etiqueta = boton.querySelector('span') || boton;
      copiarTexto(pre.textContent.trim(), function (ok) {
        if (!ok) {
          return;
        }
        var original = etiqueta.textContent;
        etiqueta.textContent = 'Copiado';
        setTimeout(function () {
          etiqueta.textContent = original;
        }, 1600);
      });
    });
  });

  /* Detección de plataforma (informativa; el instalador confirma al correr) */
  var detectado = document.getElementById('detectado');
  if (detectado) {
    var pista = '';
    try {
      var ud = navigator.userAgentData;
      pista = ((ud && ud.platform) || navigator.platform || '') + ' ' + (navigator.userAgent || '');
    } catch (err) {
      pista = '';
    }
    var l = pista.toLowerCase();
    var esMovil = /android|iphone|ipad|ipod/.test(l) && !/windows|macintosh|linux/.test(l);
    if (esMovil) {
      detectado.textContent = 'Estás en el móvil → instala nine en tu laptop';
    } else {
      var so = /win/.test(l) ? 'WINDOWS' : (/mac|darwin/.test(l) ? 'MACOS' : 'LINUX');
      var arq = /arm64|aarch64/.test(l) ? 'ARM64' : 'X86-64';
      var mapa = {
        'LINUX|X86-64': 'nine-linux-amd64',
        'LINUX|ARM64': 'nine-linux-arm64',
        'MACOS|X86-64': 'nine-darwin-amd64',
        'MACOS|ARM64': 'nine-darwin-arm64',
        'WINDOWS|X86-64': 'nine-windows-amd64.exe'
      };
      var activo = mapa[so + '|' + arq];
      detectado.textContent = activo
        ? 'Detectado: ' + so + ' · ' + arq + ' → ' + activo
        : 'Sistema no listado → usa ./install.sh --build';
    }
  }
})();
