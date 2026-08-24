/* =========================================================
   FESTIVAL DE COMETAS XVII — web de inscripción
   ========================================================= */
(function () {
  'use strict';

  var M = window.MARCA || {};
  var estado = {
    cfg: {
      EVENTO_NOMBRE: M.EVENTO_NOMBRE, EVENTO_LEMA: M.EVENTO_LEMA, EVENTO_HOMENAJE: M.EVENTO_HOMENAJE,
      EVENTO_LUGAR: M.EVENTO_LUGAR, EVENTO_MAPS: M.EVENTO_MAPS, EVENTO_LAT: M.EVENTO_LAT,
      EVENTO_LNG: M.EVENTO_LNG, EVENTO_INICIO_ISO: M.EVENTO_INICIO_ISO, CATEGORIAS: []
    },
    documento: '',
    categoria: '',
    desfase: 0,          // reloj del servidor − reloj del teléfono
    reloj: null
  };

  /* ---------------- utilidades ---------------- */

  function $(id) { return document.getElementById(id); }

  function soloDigitos(v) { return String(v == null ? '' : v).replace(/\D+/g, ''); }

  function valDocumento(v) {
    var d = soloDigitos(v);
    if (!d) return 'Escribe el número de documento.';
    if (d.length < 6 || d.length > 10) return 'El documento debe tener entre 6 y 10 dígitos.';
    return '';
  }

  function valWhatsapp(v) {
    var d = soloDigitos(v);
    return d.length === 10 ? '' : 'El WhatsApp debe tener 10 dígitos.';
  }

  /** Convierte 'yyyy-MM-ddTHH:mm:ss-05:00' a Date; cualquier otra forma → null. */
  function fechaIso(txt) {
    var s = String(txt == null ? '' : txt).trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(s)) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Tiempo que falta entre dos instantes, ya partido en días/horas/min/seg. */
  function restante(destinoMs, ahoraMs) {
    var ms = destinoMs - ahoraMs;
    if (ms <= 0) return { pasado: true, d: 0, h: 0, m: 0, s: 0 };
    var s = Math.floor(ms / 1000);
    return {
      pasado: false,
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60
    };
  }

  function dos(n) { return (n < 10 ? '0' : '') + n; }

  function fechaLarga(d) {
    try {
      return d.toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota'
      });
    } catch (e) { return ''; }
  }

  function ahora() { return Date.now() + estado.desfase; }

  function toast(txt) {
    var t = $('toast');
    t.textContent = txt; t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('ver'); });
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      t.classList.remove('ver');
      setTimeout(function () { t.hidden = true; }, 300);
    }, 3200);
  }

  function cargando(btn, on) {
    btn.classList.toggle('cargando', !!on);
    btn.disabled = !!on;
  }

  function verError(id, msg) {
    var e = $(id);
    if (!msg) { e.hidden = true; e.textContent = ''; return; }
    e.textContent = msg; e.hidden = false;
  }

  function pantalla(cual) {
    ['pasoDocumento', 'pasoDatos', 'pasoCerrado', 'pasoEvento'].forEach(function (id) {
      $(id).hidden = (id !== cual);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- servidor ---------------- */

  function api(action, datos) {
    var cuerpo = Object.assign({ action: action }, datos || {});
    var url = (window.MARCA && window.MARCA.API_URL) || '';
    if (!url || url.indexOf('PEGA_AQUI') === 0) {
      return Promise.reject(new Error('Falta pegar la URL del backend en marca.js'));
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // texto plano = sin preflight CORS
      body: JSON.stringify(cuerpo)
    })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r && r.cfg) guardarCfg(r.cfg);
        return r;
      });
  }

  function guardarCfg(cfg) {
    Object.keys(cfg).forEach(function (k) { if (cfg[k] !== '' && cfg[k] != null) estado.cfg[k] = cfg[k]; });
    var srv = fechaIso(cfg.SERVIDOR_ISO);
    if (srv) estado.desfase = srv.getTime() - Date.now();
    pintarMarca();
  }

  /* ---------------- pintado ---------------- */

  function pintarMarca() {
    var c = estado.cfg;
    if (c.EVENTO_NOMBRE) { $('tituloEvento').textContent = c.EVENTO_NOMBRE; document.title = c.EVENTO_NOMBRE; }
    if (c.EVENTO_LEMA) $('lemaEvento').textContent = c.EVENTO_LEMA;
    if (c.EVENTO_HOMENAJE) $('homenajeEvento').textContent = c.EVENTO_HOMENAJE;
    if (c.EVENTO_LUGAR) $('lugarEvento').textContent = c.EVENTO_LUGAR;
    if (c.MSG_CIERRE) $('txtCerrado').textContent = c.MSG_CIERRE;
    if (Array.isArray(c.CATEGORIAS) && c.CATEGORIAS.length) pintarCategorias(c.CATEGORIAS);
  }

  function pintarCategorias(lista) {
    var cont = $('listaCategorias');
    if (cont.dataset.pintado === lista.join('|')) return;
    cont.dataset.pintado = lista.join('|');
    cont.innerHTML = '';
    lista.forEach(function (nombre, i) {
      var l = document.createElement('label');
      l.className = 'cat';
      l.innerHTML = '<input type="radio" name="categoria" value="' + nombre.replace(/"/g, '&quot;') + '">' +
                    '<i class="moño"></i><span>' + nombre + '</span>';
      l.querySelector('input').addEventListener('change', function () {
        estado.categoria = nombre;
        Array.prototype.forEach.call(cont.children, function (x) { x.classList.remove('sel'); });
        l.classList.add('sel');
        verError('errDatos', '');
      });
      cont.appendChild(l);
      void i;
    });
  }

  function pintarMapa() {
    var lat = estado.cfg.EVENTO_LAT, lng = estado.cfg.EVENTO_LNG;
    var marco = $('mapa');
    if (lat && lng && !marco.src) {
      marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng) +
                  '&z=17&hl=es&output=embed';
    }
    $('btnComoLlegar').href = estado.cfg.EVENTO_MAPS || ('https://www.google.com/maps?q=' + lat + ',' + lng);
  }

  function pintarEvento(reg, recienCreado) {
    $('okEyebrow').textContent = recienCreado ? '¡Inscripción confirmada!' : 'Ya estás en el festival';
    $('okNombre').textContent = (reg.nombres + ' ' + reg.apellidos).trim();
    $('okCategoria').textContent = reg.categoria;
    $('okDocumento').textContent = reg.documento;
    var chip = $('okEstado');
    chip.textContent = reg.estado;
    chip.classList.toggle('activo', reg.estado === 'ACTIVO');
    pintarMapa();
    arrancarReloj();
    pantalla('pasoEvento');
  }

  function arrancarReloj() {
    var d = fechaIso(estado.cfg.EVENTO_INICIO_ISO);
    if (!d) { $('cuentaTitulo').textContent = 'Te esperamos en el festival'; return; }
    $('cuentaFecha').textContent = fechaLarga(d);

    function tic() {
      var r = restante(d.getTime(), ahora());
      if (r.pasado) {
        $('cuentaTitulo').textContent = '¡El festival ya empezó!';
        $('cDias').textContent = '00'; $('cHoras').textContent = '00';
        $('cMin').textContent = '00'; $('cSeg').textContent = '00';
        clearInterval(estado.reloj);
        return;
      }
      $('cuentaTitulo').textContent = 'Faltan para elevar cometa';
      $('cDias').textContent = dos(r.d);
      $('cHoras').textContent = dos(r.h);
      $('cMin').textContent = dos(r.m);
      $('cSeg').textContent = dos(r.s);
    }
    clearInterval(estado.reloj);
    tic();
    estado.reloj = setInterval(tic, 1000);
  }

  /* ---------------- flujo ---------------- */

  function iniciar() {
    var btn = $('btnIniciar');
    var doc = soloDigitos($('inDocumento').value);
    var err = valDocumento(doc);
    verError('errDocumento', err);
    if (err) { $('inDocumento').focus(); return; }

    cargando(btn, true);
    api('consultarDocumento', { documento: doc })
      .then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'No pudimos consultar el documento.');
        estado.documento = doc;
        if (r.existe) return pintarEvento(r.registro, false);
        if (r.cerrada) { if (r.mensaje) $('txtCerrado').textContent = r.mensaje; return pantalla('pasoCerrado'); }
        $('docFijo').textContent = doc;
        pantalla('pasoDatos');
        setTimeout(function () { $('inNombres').focus(); }, 250);
      })
      .catch(function (e) { verError('errDocumento', e.message); })
      .then(function () { cargando(btn, false); });
  }

  function guardar() {
    var btn = $('btnGuardar');
    var datos = {
      documento: estado.documento,
      nombres: $('inNombres').value.trim(),
      apellidos: $('inApellidos').value.trim(),
      whatsapp: soloDigitos($('inWhatsapp').value),
      categoria: estado.categoria
    };
    var err = '';
    if (datos.nombres.length < 2) err = 'Escribe los nombres del adulto responsable.';
    else if (datos.apellidos.length < 2) err = 'Escribe los apellidos del adulto responsable.';
    else if (valWhatsapp(datos.whatsapp)) err = valWhatsapp(datos.whatsapp);
    else if (!datos.categoria) err = 'Selecciona una categoría.';
    verError('errDatos', err);
    if (err) return;

    cargando(btn, true);
    api('inscribir', datos)
      .then(function (r) {
        if (r && r.ok) return pintarEvento(r.registro, true);
        if (r && r.duplicado && r.registro) return pintarEvento(r.registro, false);
        if (r && r.cerrada) { $('txtCerrado').textContent = r.error; return pantalla('pasoCerrado'); }
        throw new Error((r && r.error) || 'No pudimos guardar la inscripción.');
      })
      .catch(function (e) { verError('errDatos', e.message); })
      .then(function () { cargando(btn, false); });
  }

  function volverInicio() {
    clearInterval(estado.reloj);
    $('inDocumento').value = '';
    $('inNombres').value = ''; $('inApellidos').value = ''; $('inWhatsapp').value = '';
    estado.categoria = '';
    Array.prototype.forEach.call($('listaCategorias').children, function (x) {
      x.classList.remove('sel');
      var i = x.querySelector('input'); if (i) i.checked = false;
    });
    verError('errDocumento', ''); verError('errDatos', '');
    pantalla('pasoDocumento');
    $('inDocumento').focus();
  }

  function compartir() {
    var c = estado.cfg;
    var txt = c.EVENTO_NOMBRE + '\n' + (c.EVENTO_HOMENAJE || '') +
              '\n\nNos vemos en ' + (c.EVENTO_LUGAR || '') + '.\nInscríbete aquí: ' + location.href;
    if (navigator.share) {
      navigator.share({ title: c.EVENTO_NOMBRE, text: txt }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function () { toast('Invitación copiada'); })
        .catch(function () { toast('Copia el enlace desde la barra del navegador'); });
    }
  }

  /**
   * Esto es una web, no una aplicación instalable: no se registra nada.
   * Si un teléfono alcanzó a guardar una versión anterior que sí lo hacía,
   * aquí se le quita para que siempre vea la página al día.
   */
  function limpiarAppVieja() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      }).catch(function () {});
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (ks) {
        ks.forEach(function (k) { if (k.indexOf('cometas-pub') === 0) caches.delete(k); });
      }).catch(function () {});
    }
  }

  /* ---------------- arranque ---------------- */

  function arrancar() {
    pintarMarca();
    $('btnIniciar').addEventListener('click', iniciar);
    $('inDocumento').addEventListener('keydown', function (e) { if (e.key === 'Enter') iniciar(); });
    $('inDocumento').addEventListener('input', function () { this.value = soloDigitos(this.value).slice(0, 10); });
    $('inWhatsapp').addEventListener('input', function () { this.value = soloDigitos(this.value).slice(0, 10); });
    $('btnGuardar').addEventListener('click', guardar);
    $('btnCambiarDoc').addEventListener('click', volverInicio);
    $('btnVolverCierre').addEventListener('click', volverInicio);
    $('btnVolverInicio').addEventListener('click', volverInicio);
    $('btnCompartir').addEventListener('click', compartir);

    api('bootstrap').catch(function () { /* si el servidor tarda, se ve el respaldo de marca.js */ });

    setTimeout(function () {
      $('loader').style.display = 'none';
      $('app').hidden = false;
      $('inDocumento').focus({ preventScroll: true });
    }, 900);

    limpiarAppVieja();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* Se exponen para las pruebas automáticas */
  window.COM = { soloDigitos: soloDigitos, valDocumento: valDocumento, valWhatsapp: valWhatsapp,
                 fechaIso: fechaIso, restante: restante, dos: dos, estado: estado };
})();
