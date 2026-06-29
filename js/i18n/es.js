/**
 * es.js — Spanish UI strings (default language).
 * Extend with additional language catalogs as needed.
 */

const I18N = (() => {

  const catalogs = {
    es: {
      /* Navigation */
      'nav.phone':    'Teléfono',
      'nav.recents':  'Recientes',
      'nav.contacts': 'Contactos',
      'nav.settings': 'Ajustes',

      /* Screen titles */
      'screen.recents':  'Recientes',
      'screen.contacts': 'Contactos',
      'screen.settings': 'Ajustes',

      /* Call status */
      'call.status.calling':   'Llamando…',
      'call.status.connected': 'Conectado',
      'call.status.onhold':    'En espera',

      /* Call controls */
      'call.ctrl.mute':        'Silencio',
      'call.ctrl.speaker':     'Altavoz',
      'call.ctrl.hold':        'Espera',
      'call.ctrl.keypad':      'Teclado',
      'call.ctrl.transfer':    'Transferir',
      'call.ctrl.conference':  'Conferencia',
      'call.ctrl.record':      'Grabar',
      'call.end':              'Finalizar',

      /* Transfer sheet */
      'transfer.title':          'Transferir llamada',
      'transfer.tab.blind':      'Ciega',
      'transfer.tab.attended':   'Anunciada',
      'transfer.blind.hint':     'Introduce el número o extensión de destino',
      'transfer.blind.ph':       '+34 o extensión',
      'transfer.blind.confirm':  'Transferir ahora',
      'transfer.attended.soon':  'Próximamente',
      'transfer.attended.desc':  'Disponible en la siguiente versión',
      'cancel':                  'Cancelar',

      /* Toasts */
      'toast.transfer.no_number':    'Introduce un número de destino',
      'toast.transfer.success':      'Transferencia iniciada',
      'toast.recording_unavailable': 'Grabación no disponible',
      'toast.conference_unavailable':'Conferencia no disponible',

      /* Incoming call */
      'incoming.label':   'Llamada entrante',
      'incoming.accept':  'Aceptar',
      'incoming.decline': 'Rechazar',

      /* History */
      'history.title':          'Recientes',
      'history.filter.all':     'Todas',
      'history.filter.missed':  'Perdidas',
      'history.empty':          'Sin llamadas',
      'history.today':          'Hoy',
      'history.yesterday':      'Ayer',
      'history.lastweek':       'Esta semana',
      'history.missed':         'Perdida',
      'call.type.incoming':     'Entrante',
      'call.type.outgoing':     'Saliente',

      /* Contacts */
      'contacts.title':  'Contactos',
      'contacts.search': 'Buscar',
      'contacts.empty':  'Sin resultados',

      /* Settings — Login */
      'settings.section.login':        'Acceso',
      'login.extension':               'Extensión',
      'login.extension.ph':            'Ej. 1001',
      'login.password':                'Contraseña',
      'login.password.ph':             '••••••••',
      'login.display_name':            'Nombre (opcional)',
      'login.display_name.ph':         'Ej. Lluis Alsina',
      'login.remember_extension':      'Recordar extensión',
      'login.remember_password':       'Recordar contraseña',
      'login.btn_login':               'Registrar',
      'login.btn_logout':              'Cerrar sesión',
      'toast.login.no_extension':      'Introduce tu extensión',
      'toast.login.no_password':       'Introduce tu contraseña',
      'toast.login.success':           'Sesión iniciada',
      'toast.login.failed':            'Error al iniciar sesión',
      'toast.logout.success':          'Sesión cerrada',
      'toast.logout.failed':           'Error al cerrar sesión',

      /* Settings */
      'settings.title':                'Ajustes',
      'settings.section.account':      'Cuenta',
      'settings.section.audio':        'Audio',
      'settings.section.appearance':   'Apariencia',
      'settings.section.integrations': 'Integraciones',
      'settings.section.developer':    'Desarrollador',
      'settings.section.about':        'Acerca de',
      'settings.auto_answer':          'Respuesta automática',
      'settings.presence':             'Estado',
      'settings.extension':            'Extensión',
      'settings.organization':         'Organización',
      'settings.dtmf':                 'Tonos DTMF',
      'settings.ringtone':             'Tono de llamada',
      'settings.ringtone.default':     'Por defecto',
      'settings.display_mode':         'Modo de pantalla',
      'settings.sip':                  'Servidor SIP',
      'settings.rest':                 'API REST',
      'settings.cti':                  'SDK CTI',
      'settings.coming_soon':          'Próximamente',
      'settings.simulate_incoming':    'Simular llamada entrante',
      'settings.version':              'v2.0.0',

      /* Presence */
      'presence.title':     'Estado',
      'presence.available': 'Disponible',
      'presence.busy':      'Ocupado',
      'presence.away':      'Ausente',
      'presence.dnd':       'No molestar',
      'presence.offline':   'Sin conexión',

      /* Layout */
      'layout.btn':     'Diseño',
      'layout.mobile':  'Teléfono',
      'layout.compact': 'Compacto',
      'layout.desktop': 'Escritorio',
      'layout.sidebar': 'Lateral',

      /* Toasts */
      'toast.voicemail':        'Buzón de voz no configurado',
      'toast.no_number':        'Introduce un número para llamar',
      'toast.call_in_progress': 'Ya hay una llamada activa',
      'toast.transfer_stub':    'Transferencia: función no disponible',
      'toast.conference_stub':  'Conferencia: función no disponible',
      'toast.sim_incoming_pre': 'Llamada entrante en 3 s de',
      'toast.not_implemented':  'No implementado todavía',
      'toast.disconnected':     'Desconectado del servidor',
      'toast.auto_answer_on':   'Respuesta automática activada',
      'toast.auto_answer_off':  'Respuesta automática desactivada',
      'auto_answer.countdown':  'Auto respuesta en {s}s',
      'auto_answer.cancel':     'Cancelar',
      'auto_answer.status.on':  'Auto Answer ON',
      'unknown':                'Desconocido',
    },
  };

  let _lang = (typeof appConfig !== 'undefined')
    ? (appConfig.i18n.language || 'es')
    : 'es';

  function setLanguage(lang) {
    if (catalogs[lang]) {
      _lang = lang;
      localStorage.setItem('lp-language', lang);
    }
  }

  function t(key, fallback) {
    const catalog = catalogs[_lang] || catalogs['es'];
    const val = catalog[key];
    if (val !== undefined) return val;
    if (fallback !== undefined) return fallback;
    return key;
  }

  function applyDOM(root) {
    const el = root || document;
    el.querySelectorAll('[data-i18n]').forEach(node => {
      const val = t(node.dataset.i18n);
      if (val !== node.dataset.i18n) node.textContent = val;
    });
    el.querySelectorAll('[data-i18n-ph]').forEach(node => {
      const val = t(node.dataset.i18nPh);
      if (val !== node.dataset.i18nPh) node.placeholder = val;
    });
  }

  return { t, setLanguage, applyDOM };
})();
