document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const errorContainer = document.getElementById("error-message");
  const params = new URLSearchParams(window.location.search);
  const toastContainer = document.getElementById("toast-container") || createToastContainer();

  if (!window.KyrbiAPI) {
    showError("No se pudo cargar el sistema de autenticacion. Recarga la pagina.");
    return;
  }

  const showToast = (text, type = "info") => {
    if (!toastContainer) return;
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    const icon = type === "success" ? "OK" : type === "error" ? "!" : "i";
    el.innerHTML = `
      <span class="toast__icon">${icon}</span>
      <div class="toast__text">${text}</div>
      <button class="toast__close" aria-label="Cerrar">x</button>
    `;
    const close = () => el.remove();
    el.querySelector(".toast__close")?.addEventListener("click", close);
    toastContainer.appendChild(el);
    setTimeout(close, 4500);
  };

  const showError = (message) => {
    if (errorContainer) {
      errorContainer.textContent = message;
      errorContainer.style.display = "block";
      errorContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    showToast(message, "error");
  };

  const clearError = () => {
    if (!errorContainer) return;
    errorContainer.style.display = "none";
    errorContainer.textContent = "";
  };

  const validateEmail = (email) =>
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
      String(email).toLowerCase()
    );

  const cleanUrlParam = (key) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    history.replaceState({}, "", url.toString());
  };

  let recaptchaLoaded = false;
  const siteKeyMeta = document.querySelector('meta[name="recaptcha-sitekey"]');
  if (siteKeyMeta && siteKeyMeta.content) {
    window.RECAPTCHA_SITE_KEY = siteKeyMeta.content;
  }

  const ensureRecaptcha = () =>
    new Promise((resolve) => {
      const key = window.RECAPTCHA_SITE_KEY;
      if (!key) return resolve(false);
      if (recaptchaLoaded && window.grecaptcha) return resolve(true);
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
      script.async = true;
      script.onload = () => {
        recaptchaLoaded = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

  const getCaptchaToken = async (action) => {
    const key = window.RECAPTCHA_SITE_KEY;
    if (!key) return null;
    const ok = await ensureRecaptcha();
    if (!ok || !window.grecaptcha) return null;
    return new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(key, { action })
          .then(resolve)
          .catch(() => resolve(null));
      });
    });
  };

  if (window.KyrbiAPI?.getCsrfToken) {
    window.KyrbiAPI.getCsrfToken().catch(() => {});
  }

  const token = params.get("token");
  const username = params.get("username");
  const id = params.get("id");
  const isSocialCallback = Boolean(token && (username || id));

  if (isSocialCallback) {
    const socialUser = { id: id || null, username: username || "Usuario", emailVerified: true };
    localStorage.setItem("kyrbi_token", token);
    localStorage.setItem("kyrbi_user", JSON.stringify(socialUser));
    sessionStorage.removeItem("kyrbi_token");
    if (window.KyrbiAPI) window.KyrbiAPI.token = token;
    history.replaceState({}, document.title, window.location.pathname);
    showToast(`Bienvenido ${socialUser.username}`, "success");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 700);
    return;
  }

  const oauthError = params.get("error");
  if (oauthError) {
    showError(decodeURIComponent(oauthError));
    cleanUrlParam("error");
  }

  if (params.get("verified") === "1") {
    showToast("Correo verificado correctamente", "success");
    cleanUrlParam("verified");
  }

  const resetToken = params.get("token");
  if (resetToken && loginForm && !isSocialCallback) {
    const newPass = prompt("Ingresa tu nueva contrasena");
    if (newPass && newPass.length >= 6) {
      window.KyrbiAPI
        .confirmPasswordReset(resetToken, newPass)
        .then(() => showToast("Contrasena actualizada. Puedes iniciar sesion.", "success"))
        .catch(() => showToast("No se pudo actualizar la contrasena", "error"))
        .finally(() => cleanUrlParam("token"));
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const email = document.getElementById("email")?.value.trim().toLowerCase();
      const password = document.getElementById("password")?.value || "";
      const remember = document.getElementById("remember")?.checked;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      if (!email || !password) {
        showError("Por favor, completa todos los campos.");
        return;
      }

      if (!validateEmail(email)) {
        showError("Por favor, ingresa un correo electronico valido.");
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Iniciando sesion...";

        const captchaToken = await getCaptchaToken("login");
        const loginData = await window.KyrbiAPI.login(email, password, captchaToken);

        let authToken = loginData?.token || null;
        let authUser = loginData?.user || null;

        if (loginData?.require2FA) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Iniciar Sesion";
          const code = prompt("Ingresa el codigo de 6 digitos de tu app de autenticacion (2FA).");
          if (!code) return;
          const twoFaResult = await window.KyrbiAPI.verify2FA(email, code.trim());
          authToken = twoFaResult?.token || null;
          authUser = twoFaResult?.user || authUser;
        }

        if (!authToken) {
          throw new Error("No se pudo completar la autenticacion.");
        }

        if (authUser) {
          localStorage.setItem("kyrbi_user", JSON.stringify(authUser));
          if (authUser.preferences?.chatSettings) {
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

        if (window.KyrbiAPI) window.KyrbiAPI.token = authToken;
        sessionStorage.removeItem("kyrbi_chat_v1");
        sessionStorage.removeItem("kyrbi_session_v1");

        showToast("Inicio de sesion exitoso.", "success");
        window.location.href = "dashboard.html";
      } catch (error) {
        showError(error.message || "Error al iniciar sesion.");
        showToast("No se pudo iniciar sesion.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Iniciar Sesion";
      }
    });

    const forgotLink = document.getElementById("forgot-link");
    forgotLink?.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = prompt("Ingresa tu correo para recuperar la contrasena");
      if (!email) return;
      if (!validateEmail(email)) {
        showError("Correo electronico invalido.");
        return;
      }
      try {
        await window.KyrbiAPI.requestPasswordReset(email.trim());
        showToast("Si el correo existe, se envio un enlace.", "success");
      } catch {
        showToast("No se pudo iniciar la recuperacion.", "error");
      }
    });
  }

  if (registerForm) {
    const emailEl = document.getElementById("email");
    const passEl = document.getElementById("password");
    const confirmEl = document.getElementById("confirm-password");

    emailEl?.addEventListener("input", () => {
      emailEl.setCustomValidity(validateEmail(emailEl.value) ? "" : "Correo no valido");
    });

    confirmEl?.addEventListener("input", () => {
      confirmEl.setCustomValidity(confirmEl.value === passEl.value ? "" : "Las contrasenas no coinciden");
    });

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const usernameField = document.getElementById("username");
      const emailField = document.getElementById("email");
      const passwordField = document.getElementById("password");
      const confirmField = document.getElementById("confirm-password");
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      const usernameValue = (usernameField?.value || "").trim().replace(/\s+/g, " ");
      const emailValue = (emailField?.value || "").trim().toLowerCase();
      const passwordValue = passwordField?.value || "";
      const confirmValue = confirmField?.value || "";

      if (!usernameValue || !emailValue || !passwordValue || !confirmValue) {
        showError("Por favor, completa todos los campos obligatorios.");
        return;
      }

      if (!validateEmail(emailValue)) {
        showError("El correo electronico no es valido.");
        return;
      }

      if (usernameValue.length < 3) {
        showError("El nombre de usuario debe tener al menos 3 caracteres.");
        return;
      }

      if (passwordValue.length < 6) {
        showError("La contrasena debe tener al menos 6 caracteres.");
        return;
      }

      if (passwordValue !== confirmValue) {
        showError("Las contrasenas no coinciden.");
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creando cuenta...";

        const captchaToken = await getCaptchaToken("register");
        const registerData = await window.KyrbiAPI.register(
          usernameValue,
          emailValue,
          passwordValue,
          captchaToken
        );

        if (registerData?.token && window.KyrbiAPI) {
          window.KyrbiAPI.token = registerData.token;
        }
        if (registerData?.user?.preferences?.chatSettings) {
          localStorage.setItem("kyrbi_preferences_v1", JSON.stringify(registerData.user.preferences.chatSettings));
        }

        sessionStorage.removeItem("kyrbi_chat_v1");
        sessionStorage.removeItem("kyrbi_session_v1");

        showToast("Cuenta creada correctamente.", "success");
        window.location.href = "dashboard.html";
      } catch (error) {
        showError(error.message || "Error al registrarse.");
        showToast("No se pudo crear la cuenta.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Crear cuenta";
      }
    });
  }

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
