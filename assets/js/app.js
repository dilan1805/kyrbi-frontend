/* ==========================================================================
   Kyrbi frontend app
   - Navigation behavior
   - Chat UI render
   - Session/history/memory handling
   - User chat settings
   ========================================================================== */

(() => {
  "use strict";

  const CONFIG = window.KYRBI_CONFIG || {};
  const MODES = CONFIG.modes || {};

  const MODE_TO_API = {
    general: "guia",
    chef: "chef",
    coach: "coach",
    descanso: "descanso",
  };

  const API_TO_MODE = {
    guia: "general",
    general: "general",
    chef: "chef",
    coach: "coach",
    descanso: "descanso",
  };

  const STORAGE_KEYS = {
    session: CONFIG.storage?.key || "kyrbi_session_v1",
    settings: "kyrbi_preferences_v1",
    publicMemory: "kyrbi_public_memory_v1",
    onboarding: "kyrbi_onboarding_v1",
  };

  const NAV_LINK_ITEMS = [
    { key: "index", href: "index.html", label: "Inicio" },
    { key: "assistant", href: "assistant.html", label: "Kyrbi IA" },
    { key: "habitos", href: "habitos.html", label: "Habitos" },
    { key: "equipo", href: "equipo.html", label: "Equipo" },
    { key: "evaluacion", href: "evaluacion.html", label: "Evaluacion" },
    { key: "seguridad", href: "seguridad.html", label: "Seguridad" },
    { key: "pricing", href: "pricing.html", label: "Pricing" },
    { key: "status", href: "status.html", label: "Status" },
  ];

  const DEFAULT_SETTINGS = {
    autoSave: true,
    defaultMode: "general",
    theme: "system", // system | light | dark
  };

  const state = {
    mode: "general",
    messages: [],
    typing: false,
    conversationId: null,
    history: [],
    historyQuery: "",
    networkOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    settings: { ...DEFAULT_SETTINGS },
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

    historyList: document.getElementById("conversation-history"),
    historyStatus: document.getElementById("history-status"),
    historySearch: document.getElementById("history-search"),
    newChatBtn: document.getElementById("new-chat-btn"),

    memorySummary: document.getElementById("memory-summary"),
    memoryMeta: document.getElementById("memory-meta"),

    settingsForm: document.getElementById("chat-settings"),
    settingsAutoSave: document.getElementById("setting-autosave"),
    settingsTheme: document.getElementById("setting-theme"),
    settingsDefaultMode: document.getElementById("setting-default-mode"),
    settingsSave: document.getElementById("settings-save"),
    onboardingReset: document.getElementById("onboarding-reset"),
    onboardingBanner: document.getElementById("onboarding-banner"),
    onboardingDismiss: document.getElementById("onboarding-dismiss"),
  };

  const LOCKED_CHAT_MESSAGE = "Para escribir en Kyrbi debes iniciar sesión o crear una cuenta.";
  const isUserAuthenticated = () => Boolean(window.KyrbiAPI?.isAuthenticated?.());
  const AUTH_REDIRECT_KEY = "kyrbi_auth_next";
  const DEFAULT_POST_AUTH_ROUTE = "dashboard.html";
  const ASSISTANT_ROUTE = "assistant.html";

  const sanitizeRelativePath = (value, fallback = DEFAULT_POST_AUTH_ROUTE) => {
    const raw = String(value || "").trim();
    if (!raw) return fallback;

    let normalized = raw;
    try {
      normalized = decodeURIComponent(raw).trim();
    } catch {}

    if (!normalized) return fallback;
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized) || normalized.startsWith("//")) return fallback;

    normalized = normalized.startsWith("/") ? normalized.slice(1) : normalized;
    if (!normalized || normalized.startsWith("#") || /[\r\n]/.test(normalized)) return fallback;
    if (/^(login|register)\.html(?:$|\?)/i.test(normalized)) return fallback;

    return normalized;
  };

  const buildAuthUrl = (page, nextPath) => {
    const safeNext = sanitizeRelativePath(nextPath, DEFAULT_POST_AUTH_ROUTE);
    return `${page}?next=${encodeURIComponent(safeNext)}`;
  };

  const currentRelativePath = () => {
    const path = window.location.pathname.split("/").pop() || "index.html";
    return `${path}${window.location.search || ""}`;
  };

  const onAssistantRoute = () => getActiveNavKey() === "assistant" || Boolean(document.getElementById("kyrbi-app"));

  const redirectAssistantToLogin = () => {
    const nextPath = sanitizeRelativePath(currentRelativePath(), ASSISTANT_ROUTE);
    try {
      sessionStorage.setItem(AUTH_REDIRECT_KEY, nextPath);
    } catch {}
    window.location.replace(buildAuthUrl("login.html", nextPath));
  };

  const nowTime = () => {
    const d = new Date();
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  const sanitizeUserText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const clampText = (text, max = 320) => (text.length > max ? `${text.slice(0, max).trim()}...` : text);
  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const scrollToBottom = (el) => {
    if (el) el.scrollTop = el.scrollHeight;
  };

  const mapModeFromApi = (mode) => API_TO_MODE[String(mode || "").toLowerCase()] || "general";
  const mapModeToApi = (mode) => MODE_TO_API[String(mode || "").toLowerCase()] || "guia";

  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const parseJSON = (raw, fallback) => {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const getMemoryMap = () => parseJSON(localStorage.getItem(STORAGE_KEYS.publicMemory) || "{}", {});
  const setMemoryMap = (value) => {
    try {
      localStorage.setItem(STORAGE_KEYS.publicMemory, JSON.stringify(value));
    } catch {}
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
      return;
    }
    root.removeAttribute("data-theme");
  };

  const buildLocalMemory = (messages) => {
    const userMessages = messages.filter((m) => m.role === "user").slice(-6).map((m) => m.text).filter(Boolean);
    if (!userMessages.length) return "Aun no hay memoria guardada.";
    const compact = userMessages.map((text, i) => `${i + 1}. ${text}`).join("\n");
    return `Resumen local (sesion):\n${compact}`;
  };

  const getSettingsFromStorage = () => {
    const data = parseJSON(localStorage.getItem(STORAGE_KEYS.settings) || "{}", {});
    return {
      autoSave: data.autoSave !== false,
      defaultMode: MODES[data.defaultMode] ? data.defaultMode : DEFAULT_SETTINGS.defaultMode,
      theme: ["system", "light", "dark"].includes(data.theme) ? data.theme : DEFAULT_SETTINGS.theme,
    };
  };

  const escapeHtmlUnsafe = (rawText) =>
    String(rawText || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const renderInlineTokens = (target, lineText) => {
    const text = String(lineText || "");
    const tokenRegex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
    let cursor = 0;
    let match = tokenRegex.exec(text);

    while (match) {
      if (match.index > cursor) {
        target.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }

      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        target.appendChild(strong);
      } else if (token.startsWith("*") && token.endsWith("*")) {
        const em = document.createElement("em");
        em.textContent = token.slice(1, -1);
        target.appendChild(em);
      } else {
        target.appendChild(document.createTextNode(token));
      }

      cursor = tokenRegex.lastIndex;
      match = tokenRegex.exec(text);
    }

    if (cursor < text.length) {
      target.appendChild(document.createTextNode(text.slice(cursor)));
    }
  };

  const parseSafeMarkdownToFragment = (rawText) => {
    const source = String(rawText || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u0000/g, "")
      .trim();
    const fragment = document.createDocumentFragment();
    if (!source) return fragment;

    const lines = source.split("\n");
    let paragraphBuffer = [];
    let currentList = null;

    const flushParagraph = () => {
      if (!paragraphBuffer.length) return;
      const paragraph = document.createElement("p");
      renderInlineTokens(paragraph, paragraphBuffer.join(" "));
      fragment.appendChild(paragraph);
      paragraphBuffer = [];
    };

    const closeList = () => {
      currentList = null;
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        closeList();
        return;
      }

      if (/^###\s+/.test(trimmed)) {
        flushParagraph();
        closeList();
        const heading = document.createElement("h3");
        renderInlineTokens(heading, trimmed.replace(/^###\s+/, ""));
        fragment.appendChild(heading);
        return;
      }

      if (/^-\s+/.test(trimmed)) {
        flushParagraph();
        if (!currentList) {
          currentList = document.createElement("ul");
          fragment.appendChild(currentList);
        }
        const li = document.createElement("li");
        renderInlineTokens(li, trimmed.replace(/^-\s+/, ""));
        currentList.appendChild(li);
        return;
      }

      closeList();
      paragraphBuffer.push(trimmed);
    });

    flushParagraph();
    return fragment;
  };

  const renderAssistantRichText = (targetNode, text) => {
    try {
      const fragment = parseSafeMarkdownToFragment(text);
      if (!fragment.childNodes.length) {
        targetNode.textContent = String(text || "");
        return;
      }
      targetNode.replaceChildren(fragment);
    } catch {
      targetNode.innerHTML = `<p>${escapeHtmlUnsafe(String(text || "")).replace(/\n/g, "<br>")}</p>`;
    }
  };

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
    subtitle.textContent = "Acompanamiento educativo";

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
    resetBtn.setAttribute("aria-label", "Nueva conversacion");
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
    input.placeholder = opts.variant === "hero" ? "Escribe algo..." : "Escribe tu mensaje...";
    input.dataset.defaultPlaceholder = input.placeholder;
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
    hint.textContent =
      opts.variant === "hero"
        ? "Tip: abre la vista completa para guardar tu progreso."
        : "Tip: Kyrbi guarda tus conversaciones para continuidad.";

    const actions = document.createElement("div");
    actions.className = "helper-row__actions";

    const quick1 = document.createElement("button");
    quick1.className = "link-btn";
    quick1.type = "button";
    quick1.textContent = "Plan semanal";
    quick1.dataset.quick = "plan";

    const quick2 = document.createElement("button");
    quick2.className = "link-btn";
    quick2.type = "button";
    quick2.textContent = "Me falta energia";
    quick2.dataset.quick = "energia";

    actions.appendChild(quick1);
    actions.appendChild(quick2);

    helper.appendChild(hint);
    helper.appendChild(actions);

    const gateNotice = document.createElement("div");
    gateNotice.className = "chat-gate";
    gateNotice.hidden = true;
    const gateRegisterHref = buildAuthUrl("register.html", ASSISTANT_ROUTE);
    const gateLoginHref = buildAuthUrl("login.html", ASSISTANT_ROUTE);
    gateNotice.innerHTML = `
      <p class="chat-gate__text">Para usar Kyrbi necesitas una cuenta activa.</p>
      <div class="chat-gate__actions">
        <a class="button button--primary button--sm" href="${gateRegisterHref}">Crear cuenta</a>
        <a class="button button--ghost button--sm" href="${gateLoginHref}">Iniciar sesión</a>
      </div>
    `;

    composerWrap.appendChild(form);
    composerWrap.appendChild(helper);
    composerWrap.appendChild(gateNotice);

    root.appendChild(top);
    root.appendChild(log);
    root.appendChild(composerWrap);

    mount.appendChild(root);

    return { root, log, input, form, send, resetBtn, quick1, quick2, chipText, gateNotice };
  }

  const ui = {
    hero: null,
    app: null,

    normalizeNavigationLinks() {
      if (!dom.navLinks) return;

      const currentNavAuth = dom.navLinks.querySelector("#nav-auth");
      const navAuth =
        currentNavAuth ||
        Object.assign(document.createElement("div"), {
          id: "nav-auth",
          className: "nav__auth",
        });

      if (currentNavAuth) currentNavAuth.remove();

      const activeKey = getActiveNavKey();
      const fragment = document.createDocumentFragment();

      NAV_LINK_ITEMS.forEach((item) => {
        const anchor = document.createElement("a");
        anchor.className = "nav__link";
        anchor.href = item.href;
        anchor.dataset.nav = item.key;
        anchor.textContent = item.label;
        if (activeKey && activeKey === item.key) anchor.classList.add("is-active");
        fragment.appendChild(anchor);
      });

      dom.navLinks.replaceChildren(fragment, navAuth);
      dom.navAnchors = Array.from(dom.navLinks.querySelectorAll(".nav__link"));
    },

    syncAssistantEntryPoints(isAuth = isUserAuthenticated()) {
      const links = Array.from(document.querySelectorAll('a[href^="assistant.html"]'));
      links.forEach((link) => {
        const href = link.getAttribute("href") || ASSISTANT_ROUTE;
        if (!link.dataset.originalHref) link.dataset.originalHref = href;
        const originalHref = link.dataset.originalHref || ASSISTANT_ROUTE;

        if (isAuth) {
          link.setAttribute("href", originalHref);
          link.classList.remove("is-assistant-locked");
          link.removeAttribute("title");
          return;
        }

        if (link.classList.contains("nav__link")) return;

        const safeNext = sanitizeRelativePath(originalHref, ASSISTANT_ROUTE);
        link.setAttribute("href", buildAuthUrl("register.html", safeNext));
        link.classList.add("is-assistant-locked");
        link.title = "Crea tu cuenta para desbloquear Kyrbi IA";
      });
    },

    updateNavigation() {
      const isAuth = isUserAuthenticated();
      const navAuth = document.getElementById("nav-auth");
      const logoutBtn = document.getElementById("logout-btn");
      const assistantLinks = dom.navAnchors.filter((anchor) => {
        const href = String(anchor.getAttribute("href") || "").trim().toLowerCase();
        return anchor.dataset.nav === "assistant" || href.startsWith("assistant.html");
      });

      assistantLinks.forEach((link) => {
        link.classList.toggle("is-auth-hidden", !isAuth);
        link.hidden = !isAuth;
        link.setAttribute("aria-hidden", isAuth ? "false" : "true");
        if (!isAuth) {
          link.setAttribute("tabindex", "-1");
        } else {
          link.removeAttribute("tabindex");
        }
      });

      this.syncAssistantEntryPoints(isAuth);

      if (logoutBtn) {
        logoutBtn.addEventListener("click", (event) => {
          event.preventDefault();
          window.KyrbiAPI?.logout?.();
        });
      }

      if (!navAuth) return;

      navAuth.innerHTML = "";

      if (isAuth) {
        const dashboardLink = document.createElement("a");
        dashboardLink.href = "dashboard.html";
        dashboardLink.className = "button button--ghost button--sm";
        dashboardLink.textContent = "Dashboard";

        const logoutLink = document.createElement("a");
        logoutLink.href = "#";
        logoutLink.className = "button button--primary button--sm";
        logoutLink.textContent = "Cerrar sesión";
        logoutLink.addEventListener("click", (event) => {
          event.preventDefault();
          window.KyrbiAPI?.logout?.();
        });

        navAuth.appendChild(dashboardLink);
        navAuth.appendChild(logoutLink);
        return;
      }

      const loginLink = document.createElement("a");
      loginLink.href = onAssistantRoute() ? buildAuthUrl("login.html", currentRelativePath()) : "login.html";
      loginLink.className = "button button--ghost button--sm";
      loginLink.textContent = "Entrar";

      const registerLink = document.createElement("a");
      registerLink.href = onAssistantRoute() ? buildAuthUrl("register.html", currentRelativePath()) : "register.html";
      registerLink.className = "button button--primary button--sm";
      registerLink.textContent = "Crear cuenta";

      navAuth.appendChild(loginLink);
      navAuth.appendChild(registerLink);
    },

    syncModeTabs() {
      dom.modeTabs.forEach((btn) => {
        const active = btn.dataset.mode === state.mode;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    },

    syncSettingsForm() {
      if (dom.settingsAutoSave) dom.settingsAutoSave.checked = Boolean(state.settings.autoSave);
      if (dom.settingsTheme) dom.settingsTheme.value = state.settings.theme;
      if (dom.settingsDefaultMode) dom.settingsDefaultMode.value = state.settings.defaultMode;
    },

    renderHistory() {
      if (!dom.historyList) return;
      dom.historyList.innerHTML = "";

      const list = state.history.filter((conv) => {
        if (!state.historyQuery) return true;
        const text = `${conv?.title || ""} ${conv?.mode || ""}`.toLowerCase();
        return text.includes(state.historyQuery.toLowerCase());
      });

      if (!list.length) {
        const message = state.historyQuery ? "No hay resultados para la búsqueda." : "Aún no hay conversaciones guardadas.";
        dom.historyList.innerHTML = `<li class="history-item history-item--empty">${message}</li>`;
        return;
      }

      list.slice(0, 30).forEach((conv) => {
        const li = document.createElement("li");
        li.className = `history-item ${state.conversationId === conv.id ? "is-active" : ""}`;
        li.innerHTML = `
          <div class="history-item__row">
            <button type="button" class="history-item__button" data-conversation-id="${conv.id}">
              <span class="history-item__title">${conv.title || "Conversación sin título"}</span>
              <span class="history-item__meta">${formatDate(conv.updatedAt)} · Modo ${mapModeFromApi(conv.mode)}</span>
            </button>
            <div class="history-item__actions">
              <button type="button" class="icon-btn icon-btn--tiny" data-action="rename" data-id="${conv.id}" aria-label="Renombrar conversación">
                <i class="fa-solid fa-pen" aria-hidden="true"></i>
              </button>
              <button type="button" class="icon-btn icon-btn--tiny" data-action="delete" data-id="${conv.id}" aria-label="Eliminar conversación">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        `;
        dom.historyList.appendChild(li);
      });
    },

    renderMemory(text, updated = "") {
      if (dom.memorySummary) dom.memorySummary.textContent = text || "Sin memoria disponible.";
      if (dom.memoryMeta) dom.memoryMeta.textContent = updated ? `Actualizado: ${updated}` : "";
    },

    setHistoryStatus(text) {
      if (dom.historyStatus) dom.historyStatus.textContent = text || "";
    },

    setConnectionChip(text) {
      if (this.hero?.chipText) this.hero.chipText.textContent = text;
      if (this.app?.chipText) this.app.chipText.textContent = text;
    },

    syncChatAccess() {
      const authLocked = !isUserAuthenticated();
      const networkLocked = !state.networkOnline;

      const applyState = (chatRefs) => {
        if (!chatRefs) return;
        const shouldDisableInput = authLocked || networkLocked;
        const placeholder = authLocked
          ? "Inicia sesión para escribir en Kyrbi"
          : (networkLocked ? "Sin conexión temporal. Reintentando..." : chatRefs.input.dataset.defaultPlaceholder || "Escribe tu mensaje...");

        chatRefs.input.disabled = shouldDisableInput;
        chatRefs.input.placeholder = placeholder;
        chatRefs.send.disabled = shouldDisableInput;
        chatRefs.quick1.disabled = shouldDisableInput;
        chatRefs.quick2.disabled = shouldDisableInput;
        chatRefs.root.classList.toggle("chat--locked", authLocked);

        if (chatRefs.gateNotice) {
          chatRefs.gateNotice.hidden = !authLocked;
          chatRefs.gateNotice.setAttribute("aria-hidden", authLocked ? "false" : "true");
        }
      };

      applyState(this.hero);
      applyState(this.app);

      if (dom.newChatBtn) dom.newChatBtn.disabled = authLocked;
      if (dom.settingsAutoSave) dom.settingsAutoSave.disabled = authLocked;
      if (dom.settingsTheme) dom.settingsTheme.disabled = authLocked;
      if (dom.settingsDefaultMode) dom.settingsDefaultMode.disabled = authLocked;
      if (dom.settingsSave) {
        dom.settingsSave.disabled = authLocked;
        dom.settingsSave.textContent = authLocked ? "Inicia sesión para guardar" : "Guardar configuración";
      }
    },

    init() {
      if (dom.year) dom.year.textContent = String(new Date().getFullYear());
      document.body.classList.add("is-ready");
      this.normalizeNavigationLinks();

      const syncNavOffset = () => {
        const header = document.querySelector(".app-header");
        const fallback = 80;
        const height = Math.max(56, Math.round(header?.getBoundingClientRect().height || fallback));
        document.documentElement.style.setProperty("--nav-offset", `${height}px`);
      };

      const closeMobileMenu = () => {
        if (!dom.navLinks?.classList.contains("is-open")) return;
        dom.navLinks.classList.remove("is-open");
        dom.navToggle?.classList.remove("is-active");
        dom.navToggle?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      };

      syncNavOffset();
      window.addEventListener("resize", syncNavOffset, { passive: true });
      window.addEventListener("scroll", syncNavOffset, { passive: true });

      if (dom.navToggle && dom.navLinks) {
        dom.navToggle.addEventListener("click", () => {
          syncNavOffset();
          const open = dom.navLinks.classList.toggle("is-open");
          dom.navToggle.classList.toggle("is-active", open);
          dom.navToggle.setAttribute("aria-expanded", open ? "true" : "false");
          document.body.classList.toggle("nav-open", open);
        });

        document.addEventListener("click", (event) => {
          const isOpen = dom.navLinks.classList.contains("is-open");
          if (!isOpen) return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          const clickInsideMenu = dom.navLinks.contains(target) || dom.navToggle.contains(target);
          if (!clickInsideMenu) closeMobileMenu();
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") closeMobileMenu();
        });
      }

      this.updateNavigation();

      dom.navAnchors.forEach((a) => {
        a.addEventListener("click", () => closeMobileMenu());
      });

      const active = getActiveNavKey();
      if (active) dom.navAnchors.forEach((a) => a.classList.toggle("is-active", a.dataset.nav === active));

      this.hero = dom.heroMount ? createChatUI(dom.heroMount, { variant: "hero" }) : null;
      this.app = dom.appMount ? createChatUI(dom.appMount, { variant: "app" }) : null;

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

        chatRefs.quick1.addEventListener("click", () =>
          actions.sendUserMessage(
            "Quiero un plan semanal. Responde con resumen rapido, recomendaciones en puntos y siguiente paso.",
            { focusAfterSend }
          )
        );
        chatRefs.quick2.addEventListener("click", () =>
          actions.sendUserMessage(
            "Tengo poca energia en clases. Ordena tu respuesta con resumen rapido, puntos accionables y una pregunta final.",
            { focusAfterSend }
          )
        );
      };

      bindChat(this.hero, false);
      bindChat(this.app, true);
      this.syncChatAccess();

      dom.modeTabs.forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.dataset.mode;
          if (!mode) return;
          actions.setMode(mode, { announce: true });
        });
      });

      dom.startButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          actions.ensureAssistantVisible();
          window.setTimeout(() => this.app?.input?.focus?.(), 120);
        });
      });

      dom.newChatBtn?.addEventListener("click", () => actions.resetConversation());

      dom.historyList?.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const actionBtn = target.closest("[data-action]");
        if (actionBtn) {
          const action = actionBtn.getAttribute("data-action");
          const id = actionBtn.getAttribute("data-id");
          if (!id) return;
          if (action === "rename") actions.renameConversation(id);
          if (action === "delete") actions.deleteConversation(id);
          return;
        }

        const button = target.closest("[data-conversation-id]");
        const id = button?.getAttribute("data-conversation-id");
        if (!id) return;
        actions.loadConversation(id);
      });

      dom.historySearch?.addEventListener("input", () => {
        state.historyQuery = String(dom.historySearch.value || "").trim();
        this.renderHistory();
      });

      dom.settingsSave?.addEventListener("click", async () => {
        await actions.saveSettings({ syncRemote: true });
      });

      dom.settingsAutoSave?.addEventListener("change", () => {
        state.settings.autoSave = Boolean(dom.settingsAutoSave.checked);
      });

      dom.settingsTheme?.addEventListener("change", () => {
        state.settings.theme = dom.settingsTheme.value;
        applyTheme(state.settings.theme);
      });

      dom.settingsDefaultMode?.addEventListener("change", () => {
        if (MODES[dom.settingsDefaultMode.value]) {
          state.settings.defaultMode = dom.settingsDefaultMode.value;
        }
      });

      dom.onboardingReset?.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEYS.onboarding);
        actions.showOnboarding(true);
      });

      window.addEventListener("online", () => actions.setNetworkStatus(true));
      window.addEventListener("offline", () => actions.setNetworkStatus(false));
    },

    render() {
      const renderInto = (chatRefs, limit) => {
        if (!chatRefs) return;
        chatRefs.log.innerHTML = "";
        const msgs = limit ? state.messages.slice(-limit) : state.messages;

        msgs.forEach((msg) => chatRefs.log.appendChild(renderMessage(msg)));

        const modeMeta = MODES[state.mode] || MODES.general || { label: "Kyrbi", tone: "" };
        const subtitle = chatRefs.root.querySelector(".chat__subtitle");
        if (subtitle) subtitle.textContent = `${modeMeta.label}${modeMeta.tone ? ` · ${modeMeta.tone}` : ""}`;
        scrollToBottom(chatRefs.log);
      };

      renderInto(this.hero, 5);
      renderInto(this.app, null);
      this.syncModeTabs();
      this.syncSettingsForm();
      this.renderHistory();
      this.syncChatAccess();
    },
  };

  function renderMessage(msg) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${msg.role === "user" ? "msg--user" : "msg--kyrbi"}`;

    const avatar = document.createElement("div");
    avatar.className = "msg__avatar";
    avatar.textContent = msg.role === "user" ? "Tu" : "K";

    const bubble = document.createElement("div");
    bubble.className = "msg__bubble";

    const text = document.createElement(msg.role === "assistant" ? "div" : "p");
    text.className = msg.role === "assistant" ? "msg__text msg__rich" : "msg__text";
    if (msg.role === "assistant") {
      renderAssistantRichText(text, msg.text);
    } else {
      text.textContent = msg.text;
    }

    const meta = document.createElement("div");
    meta.className = "msg__meta";

    const time = document.createElement("span");
    time.textContent = msg.time || "";

    const tag = document.createElement("span");
    tag.className = "msg__tag";
    tag.textContent = msg.role === "user" ? "Tu mensaje" : (MODES[msg.mode || state.mode]?.label || "Kyrbi");

    meta.appendChild(tag);
    meta.appendChild(time);
    bubble.appendChild(text);
    bubble.appendChild(meta);
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    return wrap;
  }

  const actions = {
    ensureAssistantVisible(scroll = false) {
      if (dom.navLinks?.classList.contains("is-open")) {
        dom.navLinks.classList.remove("is-open");
        dom.navToggle?.classList.remove("is-active");
        dom.navToggle?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      }
      if (scroll) document.getElementById("asistente")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    setNetworkStatus(online) {
      state.networkOnline = Boolean(online);
      if (!state.networkOnline) {
        ui.setConnectionChip("Sin conexión");
        ui.setHistoryStatus("Sin conexión. Reintentaremos al recuperar red.");
      } else {
        ui.setConnectionChip("Disponible");
        this.refreshHistory().catch(() => {});
        this.refreshMemory().catch(() => {});
      }
      ui.syncChatAccess();
    },

    setMode(mode, opts = {}) {
      if (!MODES[mode]) return;
      const prev = state.mode;
      state.mode = mode;
      ui.syncModeTabs();

      if (opts.announce && prev !== mode) {
        const modeMeta = MODES[mode];
        const switchMessage = `He cambiado a modo ${modeMeta?.label || mode}. ${modeMeta?.tone || ""}`.trim();
        this.addAssistantMessage(switchMessage, { mode });
        if (state.messages.filter((m) => m.role === "user").length === 0) {
          const intro = MODES[mode]?.intro?.[1];
          if (intro) this.addAssistantMessage(intro, { mode });
        }
      }

      if (dom.appMount) this.persistSession();
      ui.render();
    },

    resetConversation(opts = {}) {
      const keepMode = Boolean(opts.keepMode);
      const nextMode = keepMode ? state.mode : state.settings.defaultMode || "general";
      state.mode = MODES[nextMode] ? nextMode : "general";
      state.messages = [];
      state.typing = false;
      state.conversationId = null;

      (MODES[state.mode]?.intro || []).forEach((line) => this.addAssistantMessage(line, { mode: state.mode }));
      if (dom.appMount) this.persistSession();
      ui.render();
      this.refreshHistory().catch(() => {});
      this.refreshMemory().catch(() => {});
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
        text: String(text || ""),
        time: nowTime(),
        mode: opts.mode || state.mode,
      });
      if (dom.appMount) this.persistSession();
    },

    persistSession() {
      if (!CONFIG.storage?.enabled || !dom.appMount || !state.settings.autoSave) return;
      const payload = {
        mode: state.mode,
        conversationId: state.conversationId,
        messages: state.messages.slice(-50),
      };
      try {
        window.sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(payload));
      } catch {}
    },

    restoreSession() {
      if (!CONFIG.storage?.enabled) return;
      const raw = window.sessionStorage.getItem(STORAGE_KEYS.session);
      if (!raw) return;
      const data = parseJSON(raw, null);
      if (!data) return;
      if (data.mode && MODES[data.mode]) state.mode = data.mode;
      if (data.conversationId) state.conversationId = data.conversationId;
      if (Array.isArray(data.messages) && data.messages.length) {
        state.messages = data.messages.filter((m) => m && (m.role === "user" || m.role === "assistant"));
      }
    },

    async loadSettings() {
      state.settings = { ...DEFAULT_SETTINGS, ...getSettingsFromStorage() };
      applyTheme(state.settings.theme);

      if (!window.KyrbiAPI?.isAuthenticated?.()) return;

      try {
        const me = await window.KyrbiAPI.getMe();
        const remote = me?.preferences?.chatSettings;
        if (remote && typeof remote === "object") {
          state.settings = {
            autoSave: remote.autoSave !== false,
            defaultMode: MODES[remote.defaultMode] ? remote.defaultMode : state.settings.defaultMode,
            theme: ["system", "light", "dark"].includes(remote.theme) ? remote.theme : state.settings.theme,
          };
          localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
          applyTheme(state.settings.theme);
        }
      } catch (error) {
        console.warn("No se pudieron cargar preferencias remotas:", error?.message || error);
      }
    },

    async saveSettings(opts = {}) {
      const syncRemote = opts.syncRemote !== false;
      try {
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
      } catch {}

      applyTheme(state.settings.theme);

      if (!syncRemote || !window.KyrbiAPI?.isAuthenticated?.()) {
        ui.setHistoryStatus("Configuracion guardada localmente.");
        return;
      }

      try {
        await window.KyrbiAPI.updatePreferences({ chatSettings: state.settings });
        ui.setHistoryStatus("Configuracion guardada en tu cuenta.");
      } catch (error) {
        ui.setHistoryStatus(`Configuracion local guardada. Sincronizacion pendiente: ${error.message || "error"}`);
      }
    },

    async refreshHistory() {
      if (!dom.historyList || !window.KyrbiAPI) return;
      if (!isUserAuthenticated()) {
        state.history = [];
        ui.renderHistory();
        ui.setHistoryStatus("Inicia sesión para desbloquear historial.");
        return;
      }
      try {
        const history = await window.KyrbiAPI.getHistory();
        state.history = Array.isArray(history) ? history : [];
        ui.renderHistory();
        ui.setHistoryStatus(state.history.length ? `Conversaciones: ${state.history.length}` : "Sin conversaciones guardadas");
      } catch (error) {
        state.history = [];
        ui.renderHistory();
        ui.setHistoryStatus(`No se pudo cargar historial: ${error.message || "error"}`);
      }
    },

    async renameConversation(conversationId) {
      if (!window.KyrbiAPI || !conversationId || !isUserAuthenticated()) return;
      const current = state.history.find((conv) => String(conv.id) === String(conversationId));
      const currentTitle = String(current?.title || "Conversación");
      const nextTitle = window.prompt("Nuevo nombre de la conversación:", currentTitle);
      const cleanTitle = sanitizeUserText(nextTitle);
      if (!cleanTitle || cleanTitle === currentTitle) return;
      try {
        await window.KyrbiAPI.updateConversation(conversationId, { title: cleanTitle.slice(0, 120) });
        await this.refreshHistory();
        ui.setHistoryStatus("Título actualizado.");
      } catch (error) {
        ui.setHistoryStatus(`No se pudo renombrar: ${error.message || "error"}`);
      }
    },

    async deleteConversation(conversationId) {
      if (!window.KyrbiAPI || !conversationId || !isUserAuthenticated()) return;
      const ok = window.confirm("¿Eliminar esta conversación? Esta acción no se puede deshacer.");
      if (!ok) return;
      try {
        await window.KyrbiAPI.deleteConversation(conversationId);
        if (String(state.conversationId) === String(conversationId)) {
          state.conversationId = null;
          this.resetConversation({ keepMode: true });
        }
        await this.refreshHistory();
        await this.refreshMemory();
        ui.setHistoryStatus("Conversación eliminada.");
      } catch (error) {
        ui.setHistoryStatus(`No se pudo eliminar: ${error.message || "error"}`);
      }
    },

    showOnboarding(force = false) {
      if (!dom.onboardingBanner) return;
      const alreadySeen = localStorage.getItem(STORAGE_KEYS.onboarding) === "done";
      const shouldShow = force || !alreadySeen;
      dom.onboardingBanner.hidden = !shouldShow;
      if (!shouldShow) return;
      dom.onboardingBanner.setAttribute("aria-hidden", "false");
      const complete = () => {
        localStorage.setItem(STORAGE_KEYS.onboarding, "done");
        dom.onboardingBanner.hidden = true;
        dom.onboardingBanner.setAttribute("aria-hidden", "true");
      };
      dom.onboardingDismiss?.addEventListener("click", complete, { once: true });
    },

    async refreshMemory() {
      if (!dom.memorySummary) return;
      if (!isUserAuthenticated()) {
        ui.renderMemory("Inicia sesión para desbloquear memoria persistente.");
        return;
      }
      if (!state.conversationId) {
        ui.renderMemory("Sin memoria disponible.");
        return;
      }

      try {
        const data = await window.KyrbiAPI.getConversationMemory(state.conversationId);
        const summary = data?.summary?.trim() || buildLocalMemory(state.messages);
        ui.renderMemory(summary, nowTime());
      } catch {
        ui.renderMemory(buildLocalMemory(state.messages), nowTime());
      }
    },

    toLocalMessages(messages, mode) {
      const safeMode = MODES[mode] ? mode : "general";
      if (!Array.isArray(messages)) return [];
      return messages.map((msg) => ({
        id: msg.id || makeId(),
        role: msg.role,
        text: msg.content || msg.text || "",
        time: msg.createdAt
          ? new Date(msg.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
          : nowTime(),
        mode: safeMode,
      }));
    },

    async loadConversation(conversationId) {
      if (!window.KyrbiAPI || !conversationId || !isUserAuthenticated()) return;
      try {
        const conversation = await window.KyrbiAPI.getConversation(conversationId);
        const mappedMode = mapModeFromApi(conversation?.mode);
        state.mode = MODES[mappedMode] ? mappedMode : "general";
        state.conversationId = conversation?.id || conversationId;
        state.messages = this.toLocalMessages(conversation?.Messages || [], state.mode);
        if (!state.messages.length) this.resetConversation({ keepMode: true });
        this.persistSession();
        ui.render();
        await this.refreshMemory();
      } catch (error) {
        console.error("No se pudo abrir la conversacion:", error);
      }
    },

    async loadInitialConversation() {
      if (!window.KyrbiAPI || !isUserAuthenticated()) return;
      const fromQuery = getConversationIdFromUrl();
      if (fromQuery) {
        await this.loadConversation(fromQuery);
        return;
      }
      try {
        const history = await window.KyrbiAPI.getHistory();
        const first = Array.isArray(history) && history.length ? history[0] : null;
        if (first?.id) {
          await this.loadConversation(first.id);
        }
      } catch {}
    },

    async sendUserMessage(text, opts = {}) {
      const clean = sanitizeUserText(text);
      if (!clean) return;

      if (!isUserAuthenticated()) {
        const last = state.messages[state.messages.length - 1];
        const alreadyWarned = last?.role === "assistant" && String(last?.text || "").includes("iniciar sesión");
        if (!alreadyWarned) this.addAssistantMessage(LOCKED_CHAT_MESSAGE, { mode: state.mode });
        ui.render();
        return;
      }

      if (!state.networkOnline) {
        this.addAssistantMessage("No hay conexión a internet en este momento. Intenta de nuevo cuando vuelva la red.");
        ui.render();
        return;
      }

      this.addUserMessage(clean);
      ui.render();

      state.typing = true;
      ui.setConnectionChip("Kyrbi está pensando...");

      if (!window.KyrbiAPI) {
        state.typing = false;
        this.addAssistantMessage("No se pudo conectar al backend.");
        ui.render();
        return;
      }

      try {
        const response = await window.KyrbiAPI.sendMessage(clean, mapModeToApi(state.mode), state.conversationId);
        if (response.conversationId) state.conversationId = response.conversationId;

        const serverMode = mapModeFromApi(response.mode);
        if (MODES[serverMode]) state.mode = serverMode;

        state.typing = false;
        ui.setConnectionChip("Disponible");

        this.addAssistantMessage(response.text, { mode: state.mode });
        if (dom.appMount) this.persistSession();
        ui.render();

        await this.refreshHistory();
        await this.refreshMemory();

        if (opts.focusAfterSend && ui.app?.input) ui.app.input.focus();
      } catch (error) {
        state.typing = false;
        ui.setConnectionChip("Error");

        const errorMessage = error.message || "error al comunicarse con Kyrbi.";
        this.addAssistantMessage(`Lo siento, ${errorMessage.toLowerCase()}`);
        if (dom.appMount) this.persistSession();
        ui.render();
        console.error("Error al enviar mensaje:", error);
      }
    },

    async boot() {
      await this.loadSettings();
      const isAuth = isUserAuthenticated();

      const requestedMode = getModeFromUrl();
      if (requestedMode && MODES[requestedMode]) {
        state.mode = requestedMode;
      } else if (MODES[state.settings.defaultMode]) {
        state.mode = state.settings.defaultMode;
      }

      if (dom.appMount) {
        this.restoreSession();
        if (!state.messages.length) {
          this.resetConversation({ keepMode: true });
        }
        if (isAuth) {
          await this.loadInitialConversation();
          await this.refreshHistory();
          await this.refreshMemory();
          this.showOnboarding(false);
        } else {
          state.history = [];
          ui.renderHistory();
          ui.setHistoryStatus("Inicia sesión para desbloquear historial.");
          ui.renderMemory("Inicia sesión para desbloquear memoria persistente.");
          if (dom.onboardingBanner) {
            dom.onboardingBanner.hidden = true;
            dom.onboardingBanner.setAttribute("aria-hidden", "true");
          }
        }
      } else {
        this.resetConversation({ keepMode: true });
      }

      ui.render();
      this.setNetworkStatus(state.networkOnline);
    },
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (onAssistantRoute() && !isUserAuthenticated()) {
      redirectAssistantToLogin();
      return;
    }
    ui.init();
    await actions.boot();
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

function getConversationIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("id") || "").trim();
    return id || null;
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
  if (file === "pricing.html") return "pricing";
  if (file === "status.html") return "status";
  return null;
}
