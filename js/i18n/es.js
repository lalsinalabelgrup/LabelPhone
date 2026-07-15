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
      'contacts.title':       'Contactos',
      'contacts.search':      'Buscar',
      'contacts.empty':       'Sin resultados',
      'contacts.new':         'Nuevo contacto',
      'contacts.favorites':   'Favoritos',
      'contacts.empty.title': 'Aún no tienes contactos',
      'contacts.empty.sub':   'Crea tu primer contacto para empezar a llamar más fácilmente.',
      'contacts.empty.cta':   'Crear contacto',

      /* Contact modal (create/edit) */
      'contact_modal.title.new':                 'Nuevo contacto',
      'contact_modal.title.edit':                'Editar contacto',
      'contact_modal.first_name':                'Nombre',
      'contact_modal.last_name':                 'Apellidos',
      'contact_modal.company':                   'Empresa',
      'contact_modal.phone':                      'Teléfono',
      'contact_modal.extension':                  'Extensión',
      'contact_modal.email':                      'Correo',
      'contact_modal.notes':                      'Notas',
      'contact_modal.favorite':                   'Favorito',
      'contact_modal.save':                       'Guardar',
      'contact_modal.error.name_required':        'El nombre es obligatorio.',
      'contact_modal.error.phone_or_ext_required': 'Indica un teléfono o una extensión.',

      /* Contact delete confirmation */
      'contact_delete.title':   'Eliminar contacto',
      'contact_delete.message': '¿Eliminar a',
      'contact_delete.warning': 'Esta acción no se puede deshacer.',
      'contact_delete.confirm': 'Eliminar',
      'contact_delete.cancel':  'Cancelar',

      /* Contact toasts */
      'toast.contact_saved':   'Contacto guardado',
      'toast.contact_deleted': 'Contacto eliminado',

      /* Registration status */
      'registration.status.not_registered': 'No registrado',
      'registration.status.registering':    'Registrando…',
      'registration.status.registered':     'Registrado',
      'registration.status.failed':         'Error de registro',
      'registration.status.disconnected':   'Desconectado',
      'registration.extension':             'Extensión {ext}',

      /* Home screen */
      'home.btn_register':       'Registrar',
      'home.btn_registering':    'Registrando…',
      'home.btn_unregister':     'Cerrar sesión',
      'home.btn_dial':           'Marcar',
      'home.btn_retry':          'Reintentar registro',
      'home.context.not_registered': 'Registra tu cuenta SIP para poder hacer y recibir llamadas.',
      'home.context.registered':     'Listo para hacer o recibir llamadas.',
      'home.error.generic':          'No se pudo completar el registro.',
      'home.recents_title':      'Recientes',
      'home.recents_empty':      'Sin llamadas recientes',
      'home.btn_back':           'Inicio',

      /* Wallpaper */
      'wallpaper.title':          'Fondo de pantalla',
      'wallpaper.default':        'Predeterminado',
      'wallpaper.dark':           'Oscuro minimal',
      'wallpaper.gradient':       'Degradado',
      'wallpaper.corporate':      'Corporativo',
      'wallpaper.custom':         'Personalizado',
      'wallpaper.choose_image':   'Elegir imagen…',
      'wallpaper.reset':          'Restablecer',
      'toast.wallpaper.invalid_type': 'Selecciona un archivo de imagen válido',
      'toast.wallpaper.too_large':    'La imagen supera el tamaño máximo (5 MB)',
      'toast.wallpaper.saved':        'Fondo de pantalla actualizado',
      'toast.wallpaper.reset':        'Fondo de pantalla restablecido',

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
      'toast.login.success':           'Extensión registrada',
      'toast.login.failed':            'Error al iniciar sesión',
      'toast.logout.success':          'Sesión cerrada',
      'toast.logout.failed':           'Error al cerrar sesión',
      'login.btn.connecting':          'Conectando a LabelGateway…',
      'login.btn.registering':         'Registrando extensión…',

      /* Quick register modal */
      'register_modal.title':                   'Registrar extensión',
      'register_modal.show_password':            'Mostrar contraseña',
      'register_modal.hide_password':            'Ocultar contraseña',
      'register_modal.save':                     'Registrar',
      'register_modal.saving':                   'Registrando…',
      'register_modal.advanced':                  'Ajustes avanzados',
      'register_modal.error.extension_required':  'Introduce tu extensión',
      'register_modal.error.password_required':   'Introduce tu contraseña',

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
      'call.disabled_hint':     'Registra el teléfono antes de realizar una llamada.',
      'toast.call_in_progress': 'Ya hay una llamada activa',
      'toast.transfer_stub':    'Transferencia: función no disponible',
      'toast.conference_stub':  'Conferencia: función no disponible',
      'toast.sim_incoming_pre': 'Llamada entrante en 3 s de',
      'toast.not_implemented':  'No implementado todavía',
      'toast.disconnected':     'Desconectado del servidor',
      'toast.auto_answer_on':   'Respuesta automática activada',
      'toast.auto_answer_off':  'Respuesta automática desactivada',
      'toast.mic_denied':       'Micrófono no disponible',
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
