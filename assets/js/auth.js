document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const errorContainer = document.getElementById("error-message");
  const toastContainer = document.getElementById("toast-container") || createToastContainer();
  const params = new URLSearchParams(window.location.search);
  const AUTH_REDIRECT_KEY = "kyrbi_auth_next";
  const DEFAULT_POST_AUTH = "dashboard.html";

  if (!window.KyrbiAPI) {
    showError("No se pudo cargar el sistema de autenticación. Recarga la página.");
    return;
  }

  const sanitizeRelativePath = (value, fallback = DEFAULT_POST_AUTH) => {
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

  const getStoredNextTarget = () => {
    try {
      return sessionStorage.getItem(AUTH_REDIRECT_KEY);
    } catch {
      return null;
    }
  };

  const setStoredNextTarget = (value) => {
    try {
      sessionStorage.setItem(AUTH_REDIRECT_KEY, sanitizeRelativePath(value, DEFAULT_POST_AUTH));
    } catch {}
  };

  const clearStoredNextTarget = () => {
    try {
      sessionStorage.removeItem(AUTH_REDIRECT_KEY);
    } catch {}
  };

  const resolvePostAuthTarget = () => {
    const queryNext = params.get("next");
    const storedNext = getStoredNextTarget();
    const candidate = queryNext || storedNext || DEFAULT_POST_AUTH;
    return sanitizeRelativePath(candidate, DEFAULT_POST_AUTH);
  };

  const postAuthTarget = resolvePostAuthTarget();
  if (postAuthTarget) setStoredNextTarget(postAuthTarget);

  const goAfterAuth = () => {
    clearStoredNextTarget();
    window.location.href = postAuthTarget || DEFAULT_POST_AUTH;
  };

  const withNextParam = (path) => {
    const safePath = String(path || "").trim();
    if (!safePath || !postAuthTarget || postAuthTarget === DEFAULT_POST_AUTH) return safePath;
    try {
      const url = new URL(safePath, window.location.origin);
      url.searchParams.set("next", postAuthTarget);
      return `${url.pathname.split("/").pop()}${url.search}`;
    } catch {
      return safePath;
    }
  };

  const validateEmail = (email) =>
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
      String(email || "").toLowerCase()
    );

  const setBusy = (button, busyText, idleText, busy) => {
    if (!button) return;
    button.disabled = Boolean(busy);
    button.textContent = busy ? busyText : idleText;
  };

  const showToast = (text, type = "info") => {
    if (!toastContainer) return;
    const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span class="toast__icon">${icon}</span>
      <div class="toast__text">${text}</div>
      <button class="toast__close" aria-label="Cerrar">×</button>
    `;
    const close = () => el.remove();
    el.querySelector(".toast__close")?.addEventListener("click", close);
    toastContainer.appendChild(el);
    window.setTimeout(close, 4200);
  };

  function showError(message) {
    if (!errorContainer) {
      showToast(message, "error");
      return;
    }
    errorContainer.textContent = message;
    errorContainer.style.display = "block";
  }

  const clearError = () => {
    if (!errorContainer) return;
    errorContainer.style.display = "none";
    errorContainer.textContent = "";
  };

  const cleanUrlParam = (key) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    window.history.replaceState({}, "", url.toString());
  };

  let recaptchaReady = false;
  const siteKeyMeta = document.querySelector('meta[name="recaptcha-sitekey"]');
  if (siteKeyMeta?.content) window.RECAPTCHA_SITE_KEY = siteKeyMeta.content;

  const ensureRecaptcha = () =>
    new Promise((resolve) => {
      const key = window.RECAPTCHA_SITE_KEY;
      if (!key) return resolve(false);
      if (recaptchaReady && window.grecaptcha) return resolve(true);
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        recaptchaReady = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

  const getCaptchaToken = async (action) => {
    const key = window.RECAPTCHA_SITE_KEY;
    if (!key) return null;
    const loaded = await ensureRecaptcha();
    if (!loaded || !window.grecaptcha) return null;
    return new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(key, { action })
          .then(resolve)
          .catch(() => resolve(null));
      });
    });
  };

  const handleOAuthCallback = () => {
    const token = params.get("token");
    const username = params.get("username");
    const id = params.get("id");
    const hasSocialPayload = Boolean(token && (username || id));
    if (!hasSocialPayload) return false;

    const socialUser = {
      id: id || null,
      username: username || "Usuario",
      emailVerified: true,
    };
    localStorage.setItem("kyrbi_token", token);
    localStorage.setItem("kyrbi_user", JSON.stringify(socialUser));
    sessionStorage.removeItem("kyrbi_token");
    window.KyrbiAPI.token = token;
    window.history.replaceState({}, document.title, window.location.pathname);
    showToast(`Bienvenido, ${socialUser.username}.`, "success");
    window.setTimeout(() => {
      goAfterAuth();
    }, 620);
    return true;
  };

  const syncOAuthButtons = async () => {
    const oauthButtons = Array.from(document.querySelectorAll("[data-oauth-provider]"));
    if (!oauthButtons.length || !window.KyrbiAPI?.request) return;

    oauthButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const provider = String(button.getAttribute("data-oauth-provider") || "").trim().toLowerCase();
        if (!provider) return;
        const token = localStorage.getItem("kyrbi_token") || sessionStorage.getItem("kyrbi_token");
        const baseURL = String(window.API_CONFIG?.baseURL || window.location.origin).replace(/\/+$/, "");
        const search = new URLSearchParams();
        if (token) search.set("token", token);
        if (postAuthTarget && postAuthTarget !== DEFAULT_POST_AUTH) search.set("next", postAuthTarget);
        setStoredNextTarget(postAuthTarget);
        const suffix = search.toString();
        window.location.href = `${baseURL}/api/auth/${provider}${suffix ? `?${suffix}` : ""}`;
      });
    });

    try {
      const providers = await window.KyrbiAPI.request("/api/auth/providers", "GET");
      let disabled = 0;
      oauthButtons.forEach((button) => {
        const provider = String(button.getAttribute("data-oauth-provider") || "").toLowerCase();
        const enabled = Boolean(providers?.[provider]);
        if (enabled) return;
        button.disabled = true;
        button.classList.add("button--disabled");
        button.setAttribute("aria-disabled", "true");
        button.title = `Inicio con ${provider} no disponible actualmente`;
        disabled += 1;
      });
      if (disabled === oauthButtons.length && disabled > 0) {
        showToast("Inicio social no disponible en este momento. Usa correo y contraseña.", "info");
      }
    } catch {
      // Fallback: mantener botones activos.
    }
  };

  const initLogin = () => {
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearError();

      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");
      const rememberInput = document.getElementById("remember");
      const submitButton = loginForm.querySelector('button[type="submit"]');

      const email = String(emailInput?.value || "").trim().toLowerCase();
      const password = String(passwordInput?.value || "");
      const remember = Boolean(rememberInput?.checked);

      if (!email || !password) {
        showError("Completa correo y contraseña.");
        return;
      }
      if (!validateEmail(email)) {
        showError("Ingresa un correo electrónico válido.");
        return;
      }

      try {
        setBusy(submitButton, "Iniciando sesión...", "Iniciar sesión", true);
        const captchaToken = await getCaptchaToken("login");
        const loginData = await window.KyrbiAPI.login(email, password, captchaToken);

        let authToken = loginData?.token || null;
        let authUser = loginData?.user || null;

        if (loginData?.require2FA) {
          const code = window.prompt("Ingresa el código de 6 dígitos de tu app de autenticación:");
          if (!code) throw new Error("Código 2FA cancelado.");
          const twoFaData = await window.KyrbiAPI.verify2FA(email, String(code).trim());
          authToken = twoFaData?.token || null;
          authUser = twoFaData?.user || authUser;
        }

        if (!authToken) throw new Error("No se pudo completar la autenticación.");

        if (authUser) {
          localStorage.setItem("kyrbi_user", JSON.stringify(authUser));
          if (authUser?.preferences?.chatSettings) {
            localStorage.setItem("kyrbi_preferences_v1", JSON.stringify(authUser.preferences.chatSettings));
          }
        }

        if (remember) {
          localStorage.setItem("kyrbi_token", authToken);
          sessionStorage.removeItem("kyrbi_token");
        } else {
          sessionStorage.setItem("kyrbi_token", authToken);
          localStorage.removeItem("kyrbi_token");
        }

        window.KyrbiAPI.token = authToken;
        sessionStorage.removeItem("kyrbi_chat_v1");
        sessionStorage.removeItem("kyrbi_session_v1");
        showToast("Inicio de sesión exitoso.", "success");
        goAfterAuth();
      } catch (error) {
        showError(error?.message || "No se pudo iniciar sesión.");
        showToast("No se pudo iniciar sesión.", "error");
      } finally {
        setBusy(submitButton, "Iniciando sesión...", "Iniciar sesión", false);
      }
    });

    const forgotLink = document.getElementById("forgot-link");
    forgotLink?.addEventListener("click", async (event) => {
      event.preventDefault();
      const email = window.prompt("Ingresa tu correo para recuperación de contraseña:");
      if (!email) return;
      if (!validateEmail(email)) {
        showError("Correo electrónico inválido.");
        return;
      }
      try {
        await window.KyrbiAPI.requestPasswordReset(String(email).trim().toLowerCase());
        showToast("Si el correo existe, se envió un enlace de recuperación.", "success");
      } catch {
        showToast("No se pudo iniciar la recuperación.", "error");
      }
    });
  };

  const initRegister = () => {
    if (!registerForm) return;

    const emailField = document.getElementById("email");
    const passwordField = document.getElementById("password");
    const confirmField = document.getElementById("confirm-password");

    emailField?.addEventListener("input", () => {
      emailField.setCustomValidity(validateEmail(emailField.value) ? "" : "Correo no válido");
    });
    confirmField?.addEventListener("input", () => {
      confirmField.setCustomValidity(confirmField.value === passwordField?.value ? "" : "Las contraseñas no coinciden");
    });

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearError();

      const usernameInput = document.getElementById("username");
      const submitButton = registerForm.querySelector('button[type="submit"]');
      const username = String(usernameInput?.value || "")
        .trim()
        .replace(/\s+/g, " ");
      const email = String(emailField?.value || "").trim().toLowerCase();
      const password = String(passwordField?.value || "");
      const confirm = String(confirmField?.value || "");

      if (!username || !email || !password || !confirm) {
        showError("Completa todos los campos obligatorios.");
        return;
      }
      if (!validateEmail(email)) {
        showError("El correo electrónico no es válido.");
        return;
      }
      if (username.length < 3) {
        showError("El nombre de usuario debe tener al menos 3 caracteres.");
        return;
      }
      if (password.length < 6) {
        showError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (password !== confirm) {
        showError("Las contraseñas no coinciden.");
        return;
      }

      try {
        setBusy(submitButton, "Creando cuenta...", "Crear cuenta", true);
        const captchaToken = await getCaptchaToken("register");
        const registerData = await window.KyrbiAPI.register(username, email, password, captchaToken);
        if (registerData?.token) window.KyrbiAPI.token = registerData.token;
        if (registerData?.user?.preferences?.chatSettings) {
          localStorage.setItem("kyrbi_preferences_v1", JSON.stringify(registerData.user.preferences.chatSettings));
        }
        sessionStorage.removeItem("kyrbi_chat_v1");
        sessionStorage.removeItem("kyrbi_session_v1");
        showToast("Cuenta creada correctamente.", "success");
        goAfterAuth();
      } catch (error) {
        showError(error?.message || "No se pudo crear la cuenta.");
        showToast("No se pudo crear la cuenta.", "error");
      } finally {
        setBusy(submitButton, "Creando cuenta...", "Crear cuenta", false);
      }
    });
  };

  const oauthError = params.get("error");
  if (oauthError) {
    showError(decodeURIComponent(oauthError));
    cleanUrlParam("error");
  }

  if (params.get("verified") === "1") {
    showToast("Correo verificado correctamente.", "success");
    cleanUrlParam("verified");
  }

  if (handleOAuthCallback()) return;

  Array.from(document.querySelectorAll('a[href="login.html"], a[href="register.html"]')).forEach((anchor) => {
    anchor.setAttribute("href", withNextParam(anchor.getAttribute("href")));
  });

  const resetToken = params.get("token");
  if (resetToken && loginForm) {
    const newPassword = window.prompt("Ingresa tu nueva contraseña:");
    if (newPassword && newPassword.length >= 6) {
      window.KyrbiAPI
        .confirmPasswordReset(resetToken, newPassword)
        .then(() => showToast("Contraseña actualizada. Ya puedes iniciar sesión.", "success"))
        .catch(() => showToast("No se pudo actualizar la contraseña.", "error"))
        .finally(() => cleanUrlParam("token"));
    }
  }

  if (window.KyrbiAPI.getCsrfToken) {
    window.KyrbiAPI.getCsrfToken().catch(() => {});
  }

  syncOAuthButtons();
  initLogin();
  initRegister();

  function createToastContainer() {
    const el = document.createElement("div");
    el.id = "toast-container";
    el.className = "toast-container";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    document.body.appendChild(el);
    return el;
  }
});
