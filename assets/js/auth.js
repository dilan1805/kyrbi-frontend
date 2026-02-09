document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const errorContainer = document.getElementById('error-message');
  const toastContainer = document.getElementById('toast-container');
  const params = new URLSearchParams(window.location.search);
  
  // Manejo de redirección desde login social
  const token = params.get('token');
  if (token) {
      const username = params.get('username') || 'Usuario';
      const id = params.get('id');
      const user = { id, username, emailVerified: true }; // Asumimos verificado si viene de social
      
      localStorage.setItem('kyrbi_token', token);
      localStorage.setItem('kyrbi_user', JSON.stringify(user));
      
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      showToast(`Bienvenido ${username}`, 'success');
      setTimeout(() => window.location.href = 'index.html', 1000);
      return; // Detener ejecución para redirigir
  }

  const siteKeyMeta = document.querySelector('meta[name="recaptcha-sitekey"]');
  if (siteKeyMeta && siteKeyMeta.content) {
    window.RECAPTCHA_SITE_KEY = siteKeyMeta.content;
  }
  
  // Obtener CSRF token (si el backend lo requiere)
  if (window.KyrbiAPI?.getCsrfToken) {
    window.KyrbiAPI.getCsrfToken().catch(() => {});
  }

  // Utilidad para mostrar errores
  const showError = (message) => {
    if (errorContainer) {
      errorContainer.textContent = message;
      errorContainer.style.display = 'block';
      errorContainer.classList.add('animate-shake');
      setTimeout(() => errorContainer.classList.remove('animate-shake'), 500);
    } else {
      alert(message);
    }
  };

  const clearError = () => {
    if (errorContainer) {
      errorContainer.style.display = 'none';
      errorContainer.textContent = '';
    }
  };

  const showToast = (text, type = 'info') => {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    const icon = type === 'success' ? '✔' : type === 'error' ? '⚠' : 'ℹ';
    el.innerHTML = `<span class="toast__icon">${icon}</span><div class="toast__text">${text}</div><button class="toast__close" aria-label="Cerrar">×</button>`;
    const close = () => el.remove();
    el.querySelector('.toast__close').addEventListener('click', close);
    toastContainer.appendChild(el);
    setTimeout(close, 4500);
  };

  let recaptchaLoaded = false;
  const ensureRecaptcha = () => new Promise((resolve) => {
    const key = window.RECAPTCHA_SITE_KEY;
    if (!key) return resolve(false);
    if (recaptchaLoaded && window.grecaptcha) return resolve(true);
    const script = document.createElement('script');
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
        window.grecaptcha.execute(key, { action }).then(resolve).catch(() => resolve(null));
      });
    });
  };

  // Mensajes por parámetros (verificación y reset)
  if (params.get('verified') === '1') {
    showToast('Correo verificado correctamente', 'success');
    const url = new URL(window.location.href);
    url.searchParams.delete('verified');
    history.replaceState({}, '', url.toString());
  }
  const resetToken = params.get('token');
  if (resetToken && loginForm) {
    const newPass = prompt('Ingresa tu nueva contraseña');
    if (newPass && newPass.length >= 6) {
      window.KyrbiAPI.confirmPasswordReset(resetToken, newPass)
        .then(() => {
          showToast('Contraseña actualizada. Puedes iniciar sesión.', 'success');
        })
        .catch(() => {
          showToast('No se pudo actualizar la contraseña', 'error');
        })
        .finally(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('token');
          history.replaceState({}, '', url.toString());
        });
    }
  }

  // Manejo de Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember')?.checked;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Iniciando sesión...';
        const captchaToken = await getCaptchaToken('login');
        const data = await window.KyrbiAPI.login(email, password, captchaToken);
        if (data?.require2FA) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Ingresar';
          const msg = data.type === 'totp' 
              ? 'Ingresa el código de 6 dígitos de tu aplicación de autenticación (2FA)' 
              : 'Ingresa el código de verificación enviado a tu correo';
          const code = prompt(msg);
          if (!code) return;
          const done = await window.KyrbiAPI.verify2FA(email, code);
          if (done?.token) {
            localStorage.setItem('kyrbi_user', JSON.stringify(done.user));
            localStorage.setItem('kyrbi_token', done.token);
          }
        }
        if (!remember) {
          sessionStorage.setItem('kyrbi_token', data.token);
          localStorage.removeItem('kyrbi_token');
        }
        showToast('Inicio de sesión exitoso', 'success');
        
        // Redirigir al dashboard o home
        window.location.href = 'index.html';
      } catch (error) {
        showError(error.message || 'Error al iniciar sesión');
        showToast('No se pudo iniciar sesión', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ingresar';
      }
    });
    const forgotLink = document.getElementById('forgot-link');
    forgotLink?.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = prompt('Ingresa tu correo para recuperar la contraseña');
      if (!email) return;
      try {
        await window.KyrbiAPI.requestPasswordReset(email);
        showToast('Si el correo existe, se envió un enlace', 'success');
      } catch {
        showToast('No se pudo iniciar la recuperación', 'error');
      }
    });
  }

  // Manejo de Registro
  if (registerForm) {
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    const confirmEl = document.getElementById('confirm-password');
    const strengthEl = document.getElementById('strength');

    const emailValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).toLowerCase());
    const calcStrength = (v) => {
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[a-z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      return score;
    };

    emailEl?.addEventListener('input', () => {
      emailEl.setCustomValidity(emailValid(emailEl.value) ? '' : 'Correo no válido');
    });

    passEl?.addEventListener('input', () => {
      const score = calcStrength(passEl.value);
      const cls = score <= 2 ? 'strength--weak' : score <= 4 ? 'strength--medium' : 'strength--strong';
      if (strengthEl) {
        strengthEl.className = `strength ${cls}`;
      }
    });

    confirmEl?.addEventListener('input', () => {
      confirmEl.setCustomValidity(confirmEl.value === passEl.value ? '' : 'Las contraseñas no coinciden');
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const username = document.getElementById('username').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      if (password !== confirmPassword) {
        showError('Las contraseñas no coinciden');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando cuenta...';

        const captchaToken = await getCaptchaToken('register');
        const r = await window.KyrbiAPI.register(username, email, password, captchaToken);
        showToast('Cuenta creada. Verifica tu correo (simulado).', 'success');
        if (r?.verifyTokenPreview) {
          const useToken = confirm('¿Verificar correo automáticamente (solo desarrollo)?');
          if (useToken) {
            try {
              await window.KyrbiAPI.verifyEmail(r.verifyTokenPreview);
              showToast('Correo verificado', 'success');
            } catch {
              showToast('No se pudo verificar el correo', 'error');
            }
          }
        }

        // Redirigir al dashboard o home
        window.location.href = 'index.html';
      } catch (error) {
        showError(error.message || 'Error al registrarse');
        showToast('No se pudo crear la cuenta', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear cuenta';
      }
    });
  }
});
