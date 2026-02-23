/* ==========================================================================
   Ciencias para vivir mejor — Kyrbi (chat simulado, listo para integrar IA)
   - Sin frameworks, ES6+, arquitectura modular simple.
   - Usa KYRBI_CONFIG y KyrbiEngine (definidos en archivos separados).
   ========================================================================== */

/**
 * Arquitectura (lista para conectar API real):
 * - state: { mode, messages }
 * - engine: genera respuestas (simuladas) según modo e historial
 * - ui: renderiza el chat en 1 o más contenedores (hero + vista dedicada)
 *
 * Para integrar IA real en el futuro:
 * - reemplazar `engine.getAssistantReply()` por un fetch a tu API
 * - mantener el mismo contrato: (state, userText) -> {text, followups?}
 */

(() => {
  "use strict";

  const CONFIG = window.KYRBI_CONFIG || {};
  const MODES = CONFIG.modes || {};

  /** @type {{mode: keyof typeof MODES, messages: Array<any>, typing: boolean, conversationId: string|null}} */
  const state = {
    mode: "general",
    messages: [],
    typing: false,
    conversationId: null,
  };

  const dom = {
    year: document.getElementById("year"),
    navToggle: document.querySelector(".nav__toggle"),
    navLinks: document.getElementById("nav-links"),
    navAnchors: Array.from(document.querySelectorAll(".nav__link")),
    modeTabs: Array.from(document.querySelectorAll(".mode-tab")),
    startButtons: Array.from(document.querySelectorAll('[data-action="start-kyrbi"]')),
    heroMount: document.getElementById("kyrbi-hero"),
    appMount: document.getElementById("kyrbi-app"),
  };

  /* ---------------------------
   * Utilidades
   * ------------------------- */

  const nowTime = () => {
    const d = new Date();
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  const clampText = (text, max = 320) => (text.length > max ? `${text.slice(0, max).trim()}…` : text);

  const sanitizeUserText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const scrollToBottom = (el) => {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // El engine simulado ya no se usa - ahora usamos el backend real vía API

  /* ---------------------------
   * UI (render + eventos)
   * ------------------------- */

  /**
   * Crea el DOM de un chat y devuelve referencias (para render).
   * @param {HTMLElement} mount
   * @param {{variant: "hero"|"app"}} opts
   */
  function createChatUI(mount, opts) {
    mount.innerHTML = "";

    const root = document.createElement("div");
    root.className = "chat";

    const top = document.createElement("div");
    top.className = "chat__top";

    const topLeft = document.createElement("div");
    topLeft.className = "chat__top-left";

    const title = document.createElement("p");
    title.className = "chat__title";
    title.textContent = "Kyrbi";

    const subtitle = document.createElement("p");
    subtitle.className = "chat__subtitle";
    subtitle.textContent = "Acompañamiento educativo • Conversación activa";

    topLeft.appendChild(title);
    topLeft.appendChild(subtitle);

    const tools = document.createElement("div");
    tools.className = "chat__tools";

        const chip = document.createElement("div");
    chip.className = "chip";
    chip.setAttribute("aria-label", "Estado del asistente");

    const chipDot = document.createElement("span");
    chipDot.className = "chip__dot";
    chipDot.setAttribute("aria-hidden", "true");

    const chipText = document.createElement("span");
    chipText.className = "chip__text";
    chipText.textContent = "Disponible";

    chip.appendChild(chipDot);
    chip.appendChild(chipText);

    const resetBtn = document.createElement("button");
    resetBtn.className = "icon-btn";
    resetBtn.type = "button";
    resetBtn.setAttribute("aria-label", "Reiniciar conversación");
    resetBtn.textContent = "↻";

    tools.appendChild(chip);
    tools.appendChild(resetBtn);

    top.appendChild(topLeft);
    top.appendChild(tools);

    const log = document.createElement("div");
    log.className = "chat__log";
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    log.setAttribute("aria-relevant", "additions");

    const composerWrap = document.createElement("div");
    composerWrap.className = "chat__composer";

    const form = document.createElement("form");
    form.className = "composer";
    form.autocomplete = "off";

    const input = document.createElement("input");
    input.className = "composer__input";
    input.name = "message";
    input.type = "text";
    input.inputMode = "text";
    input.placeholder = opts.variant === "hero" ? "Escribe algo (vista rápida)…" : "Escribe tu mensaje…";
    input.maxLength = opts.variant === "hero" ? (CONFIG.limits?.userText || 140) : (CONFIG.limits?.userTextApp || 260);
    input.setAttribute("aria-label", "Escribir mensaje");

    const send = document.createElement("button");
    send.className = "send-btn";
    send.type = "submit";
    send.setAttribute("aria-label", "Enviar mensaje");
    send.textContent = "➤";

    form.appendChild(input);
    form.appendChild(send);

    const helper = document.createElement("div");
    helper.className = "helper-row";

    const hint = document.createElement("div");
    hint.className = "helper-row__hint";
    hint.textContent = opts.variant === "hero" ? "Tip: cambia a la vista completa para más espacio." : "Tip: responde corto; Kyrbi hará preguntas.";

    const actions = document.createElement("div");
    actions.className = "helper-row__actions";

    const quick1 = document.createElement("button");
    quick1.className = "link-btn";
    quick1.type = "button";
    quick1.textContent = "Quiero un plan";
    quick1.dataset.quick = "plan";

    const quick2 = document.createElement("button");
    quick2.className = "link-btn";
    quick2.type = "button";
    quick2.textContent = "Tengo poca energía";
    quick2.dataset.quick = "energia";

    actions.appendChild(quick1);
    actions.appendChild(quick2);

    helper.appendChild(hint);
    helper.appendChild(actions);

    composerWrap.appendChild(form);
    composerWrap.appendChild(helper);

    root.appendChild(top);
    root.appendChild(log);
    root.appendChild(composerWrap);

    mount.appendChild(root);

    return { root, log, input, form, resetBtn, quick1, quick2, chipText };
  }

  const ui = {
    hero: null,
    app: null,

    updateNavigation() {
      const user = localStorage.getItem('kyrbi_user');
      const navLinks = document.getElementById('nav-links');
      if (!navLinks) return;

      // Eliminar enlaces de auth existentes para evitar duplicados
      const authLinks = navLinks.querySelectorAll('.nav-auth-link');
      authLinks.forEach(el => el.remove());

      if (user) {
        // Usuario Logueado: Añadir Dashboard y Logout
        const dashboardLink = document.createElement('a');
        dashboardLink.className = 'nav__link nav-auth-link';
        dashboardLink.href = 'dashboard.html';
        dashboardLink.textContent = 'Dashboard';
        if (window.location.pathname.includes('dashboard.html')) {
            dashboardLink.classList.add('is-active');
        }
        
        const logoutLink = document.createElement('a');
        logoutLink.className = 'nav__link nav-auth-link';
        logoutLink.href = '#';
        logoutLink.textContent = 'Cerrar Sesión';
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.KyrbiAPI) window.KyrbiAPI.logout();
        });

        navLinks.appendChild(dashboardLink);
        navLinks.appendChild(logoutLink);
      } else {
        // Usuario No Logueado: Añadir Login
        const loginLink = document.createElement('a');
        loginLink.className = 'nav__link nav-auth-link';
        loginLink.href = 'login.html';
        loginLink.textContent = 'Iniciar Sesión';

        navLinks.appendChild(loginLink);
      }
    },

    init() {
      if (dom.year) dom.year.textContent = String(new Date().getFullYear());
      document.body.classList.add("is-ready");

      // Navbar (mobile)
      if (dom.navToggle && dom.navLinks) {
        dom.navToggle.addEventListener("click", () => {
          const open = dom.navLinks.classList.toggle("is-open");
          dom.navToggle.classList.toggle("is-active", open);
          dom.navToggle.setAttribute("aria-expanded", open ? "true" : "false");
        });

        document.addEventListener("click", (event) => {
          const isOpen = dom.navLinks.classList.contains("is-open");
          if (!isOpen) return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          const clickInsideMenu = dom.navLinks.contains(target) || dom.navToggle.contains(target);
          if (!clickInsideMenu) {
            dom.navLinks.classList.remove("is-open");
            dom.navToggle.classList.remove("is-active");
            dom.navToggle.setAttribute("aria-expanded", "false");
          }
        });

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          if (!dom.navLinks.classList.contains("is-open")) return;
          dom.navLinks.classList.remove("is-open");
          dom.navToggle.classList.remove("is-active");
          dom.navToggle.setAttribute("aria-expanded", "false");
        });
      }

      this.updateNavigation();

      // Cierra menú móvil al navegar
      dom.navAnchors.forEach((a) => {
        a.addEventListener("click", () => {
          if (dom.navLinks?.classList.contains("is-open")) {
            dom.navLinks.classList.remove("is-open");
            dom.navToggle?.classList.remove("is-active");
            dom.navToggle?.setAttribute("aria-expanded", "false");
          }
        });
      });

      // Resalta el link activo según la página actual (multi-page real)
      const active = getActiveNavKey();
      if (active) {
        dom.navAnchors.forEach((a) => a.classList.toggle("is-active", a.dataset.nav === active));
      }

      // Render UI
      this.hero = dom.heroMount ? createChatUI(dom.heroMount, { variant: "hero" }) : null;
      this.app = dom.appMount ? createChatUI(dom.appMount, { variant: "app" }) : null;

      // Eventos de envío (ambas vistas comparten el mismo estado)
      const bindChat = (chatRefs, focusAfterSend = true) => {
        if (!chatRefs) return;
        chatRefs.form.addEventListener("submit", (e) => {
          e.preventDefault();
          const value = sanitizeUserText(chatRefs.input.value);
          if (!value) return;
          chatRefs.input.value = "";
          actions.sendUserMessage(value, { focusAfterSend });
        });

        chatRefs.resetBtn.addEventListener("click", () => {
          actions.resetConversation();
          chatRefs.input.focus();
        });

        chatRefs.quick1.addEventListener("click", () => actions.sendUserMessage("Quiero un plan semanal.", { focusAfterSend }));
        chatRefs.quick2.addEventListener("click", () => actions.sendUserMessage("Tengo poca energía en clases.", { focusAfterSend }));
      };

      bindChat(this.hero, false);
      bindChat(this.app, true);

      // Tabs de modo
      dom.modeTabs.forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.dataset.mode;
          if (!mode) return;
          actions.setMode(mode, { announce: true });
        });
      });

      // Botón principal del hero
      dom.startButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          actions.ensureAssistantVisible();
          window.setTimeout(() => this.app?.input?.focus?.(), 120);
        });
      });

      // Modo inicial por URL (assistant.html?mode=chef)
      const urlMode = getModeFromUrl();
      if (urlMode && MODES[urlMode]) {
        actions.setMode(urlMode, { announce: false });
      }

      // En páginas multipágina, no se necesita scroll-spy de secciones
    },

    initScrollSpy() {
      const sections = ["inicio", "asistente", "habitos", "equipo"]
        .map((id) => document.getElementById(id))
        .filter(Boolean);

      if (!sections.length) return;

      const obs = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
          if (!visible) return;
          const id = visible.target.id;
          dom.navAnchors.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
        },
        { rootMargin: "-35% 0px -60% 0px", threshold: [0.1, 0.2, 0.3] }
      );

      sections.forEach((s) => obs.observe(s));
    },

    render() {
      const renderInto = (chatRefs, limit) => {
        if (!chatRefs) return;
        chatRefs.log.innerHTML = "";
        const msgs = limit ? state.messages.slice(-limit) : state.messages;

        for (const msg of msgs) {
          chatRefs.log.appendChild(renderMessage(msg));
        }

        // Título contextual por modo
        const modeMeta = MODES[state.mode];
        const subtitle = chatRefs.root.querySelector(".chat__subtitle");
        if (subtitle) subtitle.textContent = `${modeMeta.label} • ${modeMeta.tone}`;

        scrollToBottom(chatRefs.log);
      };

      renderInto(this.hero, 5);
      renderInto(this.app, null);
    },
  };

  function renderMessage(msg) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${msg.role === "user" ? "msg--user" : "msg--kyrbi"}`;

    const avatar = document.createElement("div");
    avatar.className = "msg__avatar";
    avatar.textContent = msg.role === "user" ? "Tú" : "K";

    const bubble = document.createElement("div");
    bubble.className = "msg__bubble";

    const text = document.createElement("p");
    text.className = "msg__text";
    text.textContent = msg.text;

    const meta = document.createElement("div");
    meta.className = "msg__meta";

    const time = document.createElement("span");
    time.textContent = msg.time || "";

    const tag = document.createElement("span");
    tag.className = "msg__tag";
    tag.textContent = msg.role === "user" ? "Tu mensaje" : MODES[msg.mode || state.mode]?.label || "Kyrbi";

    meta.appendChild(tag);
    meta.appendChild(time);

    bubble.appendChild(text);
    bubble.appendChild(meta);

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    return wrap;
  }

  /* ---------------------------
   * Acciones (control de estado)
   * ------------------------- */

  const actions = {
    async loadRemoteSession() {
      if (!window.KyrbiAPI || !window.KyrbiAPI.token) return;
      try {
        const history = await window.KyrbiAPI.getHistory();
        if (history && history.length > 0) {
          // Cargar la última conversación
          const lastConv = history[0];
          const fullConv = await window.KyrbiAPI.getConversation(lastConv.id);
          
          if (fullConv) {
            state.conversationId = fullConv.id;
            state.mode = fullConv.mode || "general";
            // Mapear mensajes de BD a formato local
            state.messages = (fullConv.Messages || []).map(msg => ({
              id: msg.id,
              role: msg.role,
              text: msg.content,
              time: new Date(msg.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
              mode: state.mode
            }));
            
            // Actualizar UI
            ui.render();
            
            // Actualizar tabs visualmente sin re-anunciar
            dom.modeTabs.forEach((b) => {
                const active = b.dataset.mode === state.mode;
                b.classList.toggle("is-active", active);
                b.setAttribute("aria-selected", active ? "true" : "false");
            });
          }
        }
      } catch (e) {
        console.error("Error loading remote session", e);
      }
    },

    boot() {
      if (dom.appMount) {
        this.restoreSession();
        this.loadRemoteSession(); // Intentar cargar del backend
      } else {
        this.resetConversation({ keepMode: true });
      }
      ui.render();
    },

    ensureAssistantVisible(scroll = false) {
      // Cierra menú móvil si está abierto
      if (dom.navLinks?.classList.contains("is-open")) {
        dom.navLinks.classList.remove("is-open");
        dom.navToggle?.classList.remove("is-active");
        dom.navToggle?.setAttribute("aria-expanded", "false");
      }
      if (scroll) {
        document.getElementById("asistente")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },

    setMode(mode, opts = {}) {
      if (!MODES[mode]) return;
      const prev = state.mode;
      state.mode = mode;

      // Tabs UI
      dom.modeTabs.forEach((b) => {
        const active = b.dataset.mode === mode;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });

      if (opts.announce && prev !== mode) {
        // Mensaje de cambio de modo
        const modeMeta = MODES[mode];
        const switchMessage = `He cambiado a modo ${modeMeta?.label || mode}.\n${modeMeta?.tone || ''} Dime qué te gustaría mejorar y te haré preguntas cortas para guiarte.`;
        this.addAssistantMessage(switchMessage, { mode });
        // Añade 1 pregunta inicial si la conversación está “fría”
        if (state.messages.filter((m) => m.role === "user").length === 0) {
          const intro = MODES[mode].intro?.[1];
          if (intro) this.addAssistantMessage(intro, { mode });
        }
      }

      if (dom.appMount) this.persistSession();
      ui.render();
    },

    resetConversation(opts = {}) {
      const keepMode = Boolean(opts.keepMode);
      const mode = keepMode ? state.mode : "general";
      state.mode = mode;
      state.messages = [];
      state.typing = false;

      const intro = MODES[mode].intro || [];
      for (const line of intro) {
        this.addAssistantMessage(line, { mode, silent: true });
      }

      if (dom.appMount) this.persistSession();
      ui.render();
    },

    async sendUserMessage(text, opts = {}) {
      const clean = sanitizeUserText(text);
      if (!clean) return;

      this.addUserMessage(clean);
      ui.render();

      // Indicador de "Kyrbi está pensando..."
      state.typing = true;
      ui.hero?.chipText && (ui.hero.chipText.textContent = "Kyrbi está pensando…");
      ui.app?.chipText && (ui.app.chipText.textContent = "Kyrbi está pensando…");

      try {
        // Llamar al backend real
        const response = await window.KyrbiAPI.sendMessage(
          clean,
          state.mode,
          state.conversationId
        );

        if (response.conversationId) {
          state.conversationId = response.conversationId;
        }

        state.typing = false;
        ui.hero?.chipText && (ui.hero.chipText.textContent = "Disponible");
        ui.app?.chipText && (ui.app.chipText.textContent = "Disponible");

        this.addAssistantMessage(response.text, { mode: response.mode || state.mode });
        if (dom.appMount) this.persistSession();
        ui.render();

        if (opts.focusAfterSend && ui.app?.input) ui.app.input.focus();
      } catch (error) {
        state.typing = false;
        ui.hero?.chipText && (ui.hero.chipText.textContent = "Error");
        ui.app?.chipText && (ui.app.chipText.textContent = "Error");

        // Mostrar mensaje de error amigable
        const errorMessage = error.message || 'Ocurrió un error al comunicarse con Kyrbi. Por favor, intenta de nuevo.';
        this.addAssistantMessage(
          `Lo siento, ${errorMessage.toLowerCase()}\n\nPor favor, verifica que el servidor backend esté ejecutándose.`,
          { mode: state.mode }
        );
        if (dom.appMount) this.persistSession();
        ui.render();

        console.error('Error al enviar mensaje:', error);
      }
    },

    addUserMessage(text) {
      state.messages.push({
        id: makeId(),
        role: "user",
        text: clampText(text, 600),
        time: nowTime(),
        mode: state.mode,
      });
      if (dom.appMount) this.persistSession();
    },

    addAssistantMessage(text, opts = {}) {
      state.messages.push({
        id: makeId(),
        role: "assistant",
        text: String(text || "").replace(/\*\*(.+?)\*\*/g, "$1"), // evita markdown visible
        time: nowTime(),
        mode: opts.mode || state.mode,
      });
      if (dom.appMount) this.persistSession();
    },

    persistSession() {
      if (!CONFIG.storage?.enabled) return;
      if (!dom.appMount) return; // solo en vista dedicada
      const payload = {
        mode: state.mode,
        messages: state.messages.slice(-40), // memoria corta
      };
      try {
        window.sessionStorage.setItem(CONFIG.storage.key, JSON.stringify(payload));
      } catch {
        /* storage opcional */
      }
    },

    restoreSession() {
      if (!CONFIG.storage?.enabled) {
        this.resetConversation({ keepMode: true });
        return;
      }
      try {
        const raw = window.sessionStorage.getItem(CONFIG.storage.key);
        if (!raw) {
          this.resetConversation({ keepMode: true });
          return;
        }
        const data = JSON.parse(raw);
        if (data?.mode && MODES[data.mode]) state.mode = data.mode;
        if (Array.isArray(data?.messages)) state.messages = data.messages;
        if (state.messages.length === 0) this.resetConversation({ keepMode: true });
      } catch {
        this.resetConversation({ keepMode: true });
      }
    },
  };

  /* ---------------------------
   * Arranque
   * ------------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    ui.init();
    actions.boot();
  });
})();

function getModeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get("mode") || "").toLowerCase();
    return mode || null;
  } catch {
    return null;
  }
}

function getActiveNavKey() {
  const p = (window.location.pathname || "").toLowerCase();
  const file = p.split("/").pop() || "index.html";
  if (file === "" || file === "index.html") return "index";
  if (file === "assistant.html") return "assistant";
  if (file === "habitos.html") return "habitos";
  if (file === "equipo.html") return "equipo";
  if (file === "evaluacion.html") return "evaluacion";
  if (file === "seguridad.html") return "seguridad";
  return null;
}

