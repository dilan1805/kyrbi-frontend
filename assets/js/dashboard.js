document.addEventListener("DOMContentLoaded", async () => {
  const userStr = localStorage.getItem("kyrbi_user");
  if (!userStr) {
    window.location.href = "login.html";
    return;
  }

  const user = JSON.parse(userStr);
  const welcomeMsg = document.getElementById("welcomeMsg");
  if (welcomeMsg) welcomeMsg.textContent = `Hola, ${user.username || "Estudiante"}`;

  const statusEl = document.getElementById("securityStatus");
  const toggle2faBtn = document.getElementById("toggle2faBtn");
  const resendVerifyBtn = document.getElementById("resendVerifyBtn");
  const linkedAccountsEl = document.getElementById("linkedAccounts");

  try {
    const freshUser = await window.KyrbiAPI.request("/api/auth/me", "GET");
    Object.assign(user, freshUser);
    localStorage.setItem("kyrbi_user", JSON.stringify(user));
  } catch (e) {
    console.error("Could not refresh user data", e);
  }

  const renderLinkedAccounts = () => {
    if (!linkedAccountsEl) return;

    const providers = [
      { id: "google", name: "Google", icon: "fab fa-google", color: "#DB4437" },
      { id: "facebook", name: "Facebook", icon: "fab fa-facebook-f", color: "#4267B2" },
      { id: "github", name: "GitHub", icon: "fab fa-github", color: "#333" },
      { id: "microsoft", name: "Microsoft", icon: "fab fa-microsoft", color: "#00A4EF" },
    ];

    linkedAccountsEl.innerHTML = providers
      .map((provider) => {
        const isLinked = !!user[`${provider.id}Id`];
        return `
          <div class="account-card ${isLinked ? "linked" : ""}">
            <div class="account-info">
              <i class="${provider.icon}" style="color: ${provider.color}"></i>
              ${provider.name}
            </div>
            ${
              isLinked
                ? '<span class="account-status"><i class="fas fa-check"></i> Conectado</span>'
                : `<button class="btn-link" onclick="linkAccount('${provider.id}')">Conectar</button>`
            }
          </div>
        `;
      })
      .join("");
  };

  window.linkAccount = (provider) => {
    const token = localStorage.getItem("kyrbi_token") || sessionStorage.getItem("kyrbi_token");
    if (!token) return alert("Error de sesion");
    window.location.href = `/api/auth/${provider}?token=${token}`;
  };

  renderLinkedAccounts();

  const updateSecurityStatus = () => {
    const verified = user.emailVerified ? "verificado" : "no verificado";
    const twofa = user.twoFactorEnabled ? "activado" : "desactivado";
    if (statusEl) statusEl.textContent = `Correo: ${verified} • 2FA: ${twofa}`;
    if (toggle2faBtn) toggle2faBtn.textContent = user.twoFactorEnabled ? "Desactivar 2FA" : "Activar 2FA";
    if (user.emailVerified && resendVerifyBtn) resendVerifyBtn.style.display = "none";
  };

  updateSecurityStatus();

  resendVerifyBtn?.addEventListener("click", async () => {
    try {
      await window.KyrbiAPI.resendVerificationEmail();
      alert("Correo de verificacion reenviado");
    } catch (e) {
      alert(`No se pudo reenviar el correo: ${e.message}`);
    }
  });

  toggle2faBtn?.addEventListener("click", async () => {
    if (user.twoFactorEnabled) {
      if (confirm("Seguro que quieres desactivar 2FA?")) {
        try {
          await window.KyrbiAPI.disable2FA();
          user.twoFactorEnabled = false;
          localStorage.setItem("kyrbi_user", JSON.stringify(user));
          updateSecurityStatus();
          alert("2FA desactivado");
        } catch (e) {
          alert(`Error: ${e.message}`);
        }
      }
      return;
    }

    try {
      const data = await window.KyrbiAPI.setup2FA();
      show2FAModal(data.qrCode, data.secret);
    } catch (e) {
      alert(`Error iniciando 2FA: ${e.message}`);
    }
  });

  try {
    const history = await window.KyrbiAPI.getHistory();
    const countEl = document.getElementById("conversationsCount");
    if (countEl) countEl.textContent = history.length;

    const listContainer = document.getElementById("activityList");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (history.length === 0) {
      listContainer.innerHTML =
        '<div class="activity-item activity-item--empty">No hay actividad reciente. Habla con Kyrbi.</div>';
      return;
    }

    history.slice(0, 5).forEach((conv) => {
      const date = new Date(conv.updatedAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <div class="activity-icon">💬</div>
        <div class="activity-details activity-details--fill">
          <h4>${conv.title || "Conversacion sin titulo"}</h4>
          <span>${date} • Modo ${conv.mode}</span>
        </div>
        <a href="assistant.html?id=${conv.id}" class="button button--ghost button--sm">Ver</a>
      `;
      listContainer.appendChild(item);
    });
  } catch (error) {
    console.error("Error cargando historial:", error);
  }
});

function show2FAModal(qrUrl, secret) {
  let modal = document.getElementById("modal-2fa");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-2fa";
    modal.className = "modal-inline";
    modal.innerHTML = `
      <div class="modal-inline__content">
        <button type="button" class="modal-inline__close close-modal" aria-label="Cerrar">&times;</button>
        <h2>Configurar Autenticacion de Dos Factores</h2>
        <p>Escanea este codigo QR con tu aplicacion de autenticacion (Google Authenticator, Authy, etc.):</p>
        <div class="modal-inline__qr-wrap">
          <img id="qr-img" class="modal-inline__qr" src="" alt="QR Code">
          <p>O ingresa este secreto manualmente: <br><strong id="secret-text" class="modal-inline__secret"></strong></p>
        </div>
        <div class="form-group">
          <label>Ingresa el codigo de 6 digitos:</label>
          <input type="text" id="verify-2fa-code" class="form-input modal-inline__input" placeholder="000000" maxlength="6">
        </div>
        <button id="confirm-2fa-btn" class="button button--primary modal-inline__button">Verificar y Activar</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector(".close-modal").onclick = () => {
      modal.style.display = "none";
    };

    modal.querySelector("#confirm-2fa-btn").onclick = async () => {
      const codeInput = document.getElementById("verify-2fa-code");
      const code = codeInput.value.trim();
      if (!code) return;

      const btn = document.getElementById("confirm-2fa-btn");
      btn.disabled = true;
      btn.textContent = "Verificando...";

      try {
        await window.KyrbiAPI.verify2FASetup(code);
        const user = JSON.parse(localStorage.getItem("kyrbi_user"));
        user.twoFactorEnabled = true;
        localStorage.setItem("kyrbi_user", JSON.stringify(user));

        document.getElementById("securityStatus").textContent = `Correo: ${
          user.emailVerified ? "verificado" : "no verificado"
        } • 2FA: activado`;
        document.getElementById("toggle2faBtn").textContent = "Desactivar 2FA";

        modal.style.display = "none";
        alert("2FA activado correctamente");
      } catch (e) {
        alert(`Codigo incorrecto o error: ${e.message}`);
        btn.disabled = false;
        btn.textContent = "Verificar y Activar";
      }
    };
  }

  document.getElementById("qr-img").src = qrUrl;
  document.getElementById("secret-text").textContent = secret;
  document.getElementById("verify-2fa-code").value = "";
  const btn = document.getElementById("confirm-2fa-btn");
  btn.disabled = false;
  btn.textContent = "Verificar y Activar";

  modal.style.display = "block";
}
