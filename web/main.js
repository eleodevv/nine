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
        boton.textContent = 'COPIADO';
        setTimeout(function () {
          boton.textContent = original;
        }, 1600);
      });
    });
  });

  /* Acordeón */
  document.querySelectorAll('.fila__boton').forEach(function (boton) {
    boton.addEventListener('click', function () {
      var abierto = boton.getAttribute('aria-expanded') === 'true';
      var panel = document.getElementById(boton.getAttribute('aria-controls'));
      var signo = boton.querySelector('.fila__signo');
      boton.setAttribute('aria-expanded', String(!abierto));
      if (signo) {
        signo.textContent = abierto ? '+' : '×';
      }
      if (panel) {
        panel.hidden = abierto;
      }
    });
  });

  /* Menú móvil */
  var menuBoton = document.querySelector('.menu');
  var menuLista = document.getElementById('menu-lista');
  if (menuBoton && menuLista) {
    menuBoton.addEventListener('click', function () {
      var abierto = menuBoton.getAttribute('aria-expanded') === 'true';
      menuBoton.setAttribute('aria-expanded', String(!abierto));
      menuLista.hidden = abierto;
    });
    menuLista.querySelectorAll('a').forEach(function (enlace) {
      enlace.addEventListener('click', function () {
        menuBoton.setAttribute('aria-expanded', 'false');
        menuLista.hidden = true;
      });
    });
  }

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
      detectado.textContent = 'DISPOSITIVO MÓVIL → INSTALA NINE EN TU LAPTOP';
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
        ? 'SISTEMA DETECTADO: ' + so + ' · ' + arq + ' → ' + activo
        : 'SISTEMA NO LISTADO → USA ./install.sh --build';
    }
  }
})();
