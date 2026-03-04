document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("kyrbi_token") || sessionStorage.getItem("kyrbi_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const welcomeEl = document.getElementById("welcomeMsg");
  const statusEl = document.getElementById("securityStatus");
  const toggle2faBtn = document.getElementById("toggle2faBtn");
  const resendVerifyBtn = document.getElementById("resendVerifyBtn");
  const linkedAccountsEl = document.getElementById("linkedAccounts");
  const conversationsCountEl = document.getElementById("conversationsCount");
  const activityListEl = document.getElementById("activityList");
  const kpiUsersEl = document.getElementById("kpiUsers");
  const kpiUptimeEl = document.getElementById("kpiUptime");
  const kpiSlaEl = document.getElementById("kpiSla");

  const providers = [
    { id: "google", name: "Google", icon: "fa-brands fa-google", colorClass: "account-provider--google" },
    { id: "facebook", name: "Facebook", icon: "fa-brands fa-facebook-f", colorClass: "account-provider--facebook" },
    { id: "github", name: "GitHub", icon: "fa-brands fa-github", colorClass: "account-provider--github" },
    { id: "microsoft", name: "Microsoft", icon: "fa-brands fa-microsoft", colorClass: "account-provider--microsoft" },
  ];

  let user = null;

  const mapModeLabel = (mode) => {
    const normalized = String(mode || "").toLowerCase();
    if (normalized === "guia" || normalized === "general") return "Guía general";
    if (normalized === "chef") return "Chef";
    if (normalized === "coach") return "Coach";
    if (normalized === "descanso") return "Descanso";
    return "General";
  };

  const formatDateTime = (value) => {
    try {
      return new Date(value).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const createActivityItem = (conversation) => {
    const item = document.createElement("article");
    item.className = "activity-item";
    item.innerHTML = `
      <div class="activity-icon activity-icon--chat" aria-hidden="true">
        <i class="fa-regular fa-comment-dots"></i>
      </div>
      <div class="activity-details activity-details--fill">
        <h4>${conversation.title || "Conversación sin título"}</h4>
        <span>${formatDateTime(conversation.updatedAt)} · ${mapModeLabel(conversation.mode)}</span>
      </div>
      <a href="assistant.html?id=${encodeURIComponent(conversation.id)}" class="button button--ghost button--sm">Ver</a>
    `;
    return item;
  };

  const renderActivity = (history) => {
    if (!activityListEl) return;
    activityListEl.innerHTML = "";
    if (!Array.isArray(history) || history.length === 0) {
      activityListEl.innerHTML =
        '<div class="activity-item activity-item--empty">Aún no hay actividad reciente. Inicia una conversación con Kyrbi.</div>';
      return;
    }
    history.slice(0, 6).forEach((conversation) => {
      activityListEl.appendChild(createActivityItem(conversation));
    });
  };

  const renderLinkedAccounts = () => {
    if (!linkedAccountsEl || !user) return;
    linkedAccountsEl.innerHTML = providers
      .map((provider) => {
        const linked = Boolean(user?.[`${provider.id}Id`]);
        return `
          <div class="account-card ${linked ? "is-linked" : ""}">
            <div class="account-info">
              <span class="account-icon ${provider.colorClass}" aria-hidden="true">
                <i class="${provider.icon}"></i>
              </span>
              <span>${provider.name}</span>
            </div>
            ${
              linked
                ? '<span class="account-status"><i class="fa-solid fa-check"></i> Conectado</span>'
                : `<button class="button button--ghost button--sm" data-link-provider="${provider.id}">Conectar</button>`
            }
          </div>
        `;
      })
      .join("");
  };

  const updateSecurityStatus = () => {
    if (!user) return;
    const emailStatus = user.emailVerified ? "verificado" : "pendiente";
    const twoFaStatus = user.twoFactorEnabled ? "activado" : "desactivado";
    if (statusEl) statusEl.textContent = `Correo: ${emailStatus} · 2FA: ${twoFaStatus}`;
    if (toggle2faBtn) toggle2faBtn.textContent = user.twoFactorEnabled ? "Desactivar 2FA" : "Activar 2FA";
    if (resendVerifyBtn) resendVerifyBtn.hidden = Boolean(user.emailVerified);
  };

  const renderMetaKpis = async () => {
    try {
      const [meta, health] = await Promise.all([
        window.KyrbiAPI.getMeta?.() || Promise.resolve(null),
        window.KyrbiAPI.getHealth?.() || Promise.resolve(null),
      ]);
      if (kpiUsersEl) kpiUsersEl.textContent = String(meta?.metrics?.registeredUsers ?? "N/D");
      if (kpiUptimeEl) kpiUptimeEl.textContent = String(meta?.metrics?.uptime ?? health?.uptime ?? "99.9%");
      if (kpiSlaEl) kpiSlaEl.textContent = String(meta?.metrics?.sla ?? "99.5%");
    } catch {
      if (kpiUsersEl) kpiUsersEl.textContent = "N/D";
      if (kpiUptimeEl) kpiUptimeEl.textContent = "N/D";
      if (kpiSlaEl) kpiSlaEl.textContent = "N/D";
    }
  };

  const bindLinkedAccounts = () => {
    linkedAccountsEl?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-link-provider]");
      const provider = button?.getAttribute("data-link-provider");
      if (!provider) return;
      const jwt = localStorage.getItem("kyrbi_token") || sessionStorage.getItem("kyrbi_token");
      const query = jwt ? `?token=${encodeURIComponent(jwt)}` : "";
      const baseURL = String(window.API_CONFIG?.baseURL || window.location.origin).replace(/\/+$/, "");
      window.location.href = `${baseURL}/api/auth/${provider}${query}`;
    });
  };

  const bindSecurityActions = () => {
    resendVerifyBtn?.addEventListener("click", async () => {
      try {
        await window.KyrbiAPI.resendVerificationEmail(user?.email || null);
        window.alert("Correo de verificación reenviado.");
      } catch (error) {
        window.alert(`No se pudo reenviar el correo: ${error?.message || "error"}`);
      }
    });

    toggle2faBtn?.addEventListener("click", async () => {
      if (!user) return;
      if (user.twoFactorEnabled) {
        const ok = window.confirm("¿Seguro que quieres desactivar 2FA?");
        if (!ok) return;
        try {
          await window.KyrbiAPI.disable2FA();
          user.twoFactorEnabled = false;
          localStorage.setItem("kyrbi_user", JSON.stringify(user));
          updateSecurityStatus();
          window.alert("2FA desactivado.");
        } catch (error) {
          window.alert(`No se pudo desactivar 2FA: ${error?.message || "error"}`);
        }
        return;
      }

      try {
        const setup = await window.KyrbiAPI.setup2FA();
        show2FAModal(setup?.qrCode, setup?.secret, async (code) => {
          await window.KyrbiAPI.verify2FASetup(code);
          user.twoFactorEnabled = true;
          localStorage.setItem("kyrbi_user", JSON.stringify(user));
          updateSecurityStatus();
        });
      } catch (error) {
        window.alert(`No se pudo iniciar 2FA: ${error?.message || "error"}`);
      }
    });
  };

  try {
    user = await window.KyrbiAPI.getMe();
    localStorage.setItem("kyrbi_user", JSON.stringify(user));
  } catch (error) {
    console.error("No se pudo cargar el perfil:", error);
    window.location.href = "login.html";
    return;
  }

  if (welcomeEl) {
    welcomeEl.textContent = `Hola, ${user?.username || "equipo"}`;
  }

  updateSecurityStatus();
  renderLinkedAccounts();
  bindLinkedAccounts();
  bindSecurityActions();

  try {
    const history = await window.KyrbiAPI.getHistory();
    if (conversationsCountEl) conversationsCountEl.textContent = String(history.length);
    renderActivity(history);
  } catch (error) {
    console.error("No se pudo cargar historial:", error);
    if (activityListEl) {
      activityListEl.innerHTML =
        '<div class="activity-item activity-item--empty">No se pudo cargar la actividad. Intenta de nuevo.</div>';
    }
  }

  await renderMetaKpis();
});

function show2FAModal(qrUrl, secret, onConfirm) {
  let modal = document.getElementById("modal-2fa");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-2fa";
    modal.className = "modal-inline";
    modal.innerHTML = `
      <div class="modal-inline__content">
        <button type="button" class="modal-inline__close" aria-label="Cerrar">×</button>
        <h2>Configurar autenticación de dos factores</h2>
        <p>Escanea este código QR en tu app de autenticación.</p>
        <div class="modal-inline__qr-wrap">
          <img id="qr-img" class="modal-inline__qr" src="" alt="Código QR para 2FA">
          <p>O usa esta clave manual: <strong id="secret-text" class="modal-inline__secret"></strong></p>
        </div>
        <div class="form-group">
          <label for="verify-2fa-code">Código de 6 dígitos</label>
          <input type="text" id="verify-2fa-code" class="form-input modal-inline__input" placeholder="000000" maxlength="6">
        </div>
        <button id="confirm-2fa-btn" class="button button--primary modal-inline__button">Verificar y activar</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const close = () => {
    modal.classList.remove("is-open");
  };

  modal.querySelector(".modal-inline__close")?.addEventListener("click", close, { once: true });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  const qrImage = document.getElementById("qr-img");
  const secretText = document.getElementById("secret-text");
  const codeInput = document.getElementById("verify-2fa-code");
  const confirmButton = document.getElementById("confirm-2fa-btn");

  if (qrImage) qrImage.src = qrUrl || "";
  if (secretText) secretText.textContent = secret || "";
  if (codeInput) codeInput.value = "";
  if (confirmButton) {
    confirmButton.disabled = false;
    confirmButton.textContent = "Verificar y activar";
  }

  confirmButton?.addEventListener(
    "click",
    async () => {
      const code = String(codeInput?.value || "").trim();
      if (!code) return;
      confirmButton.disabled = true;
      confirmButton.textContent = "Verificando...";
      try {
        await onConfirm(code);
        window.alert("2FA activado correctamente.");
        close();
      } catch (error) {
        window.alert(`Código inválido o error: ${error?.message || "error"}`);
        confirmButton.disabled = false;
        confirmButton.textContent = "Verificar y activar";
      }
    },
    { once: true }
  );

  modal.classList.add("is-open");
}
