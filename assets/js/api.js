/* ==========================================================================
   Cliente API para comunicarse con el backend de Kyrbi
   ========================================================================== */

if (!window.API_CONFIG) {
  const host = (window.location.hostname || "").toLowerCase();
  const isStaticHost = host.endsWith("github.io") || host.endsWith("netlify.app");
  const fallbackBaseURL =
    typeof window.BACKEND_FALLBACK_URL === "string" && window.BACKEND_FALLBACK_URL.trim().length > 0
      ? window.BACKEND_FALLBACK_URL.trim()
      : "https://kyrbi-backend.onrender.com";

  window.API_CONFIG = {
    baseURL:
      typeof window.BACKEND_URL === "string" && window.BACKEND_URL.trim().length > 0
        ? window.BACKEND_URL.trim()
        : (isStaticHost ? fallbackBaseURL : window.location.origin),
    fallbackBaseURL,
    endpoints: {
      chat: "/api/chat",
      history: "/api/chat/history",
      memory: "/api/chat/memory",
      login: "/api/auth/login",
      register: "/api/auth/register",
      me: "/api/auth/me",
      preferences: "/api/auth/preferences",
      csrfToken: "/api/auth/csrf-token",
      verifyEmail: "/api/auth/verify-email",
      resendVerify: "/api/auth/verify-email/resend",
      setup2FA: "/api/auth/2fa/setup",
      verify2FASetup: "/api/auth/2fa/verify-setup",
      disable2FA: "/api/auth/2fa/disable",
      requestReset: "/api/auth/password/reset/request",
      confirmReset: "/api/auth/password/reset/confirm",
      verify2FA: "/api/auth/login/verify-2fa",
      meta: "/api/meta",
      health: "/health",
    },
    timeout: 30000,
  };
}

if (!window.KyrbiAPI) {
  class KyrbiClient {
    constructor() {
      this.token = localStorage.getItem("kyrbi_token") || sessionStorage.getItem("kyrbi_token");
      this.sessionId = localStorage.getItem("kyrbi_session");
      if (!this.sessionId) {
        this.sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem("kyrbi_session", this.sessionId);
      }
    }

    isAuthenticated() {
      return Boolean(this.token);
    }

    requireAuth() {
      if (!this.token) {
        throw new Error("Debes iniciar sesión o crear una cuenta para usar Kyrbi.");
      }
    }

    getHeaders() {
      const headers = { "Content-Type": "application/json" };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      if (window.CSRF_TOKEN) headers["x-csrf-token"] = window.CSRF_TOKEN;
      return headers;
    }

    setToken(token) {
      this.token = token;
      localStorage.setItem("kyrbi_token", token);
    }

    logout() {
      this.token = null;
      localStorage.removeItem("kyrbi_token");
      localStorage.removeItem("kyrbi_user");
      sessionStorage.removeItem("kyrbi_token");
      window.location.href = "login.html";
    }

    normalizePath(endpoint) {
      return String(endpoint || "").startsWith("/") ? String(endpoint) : `/${String(endpoint || "")}`;
    }

    getBaseCandidates() {
      const primaryBase = String(window.API_CONFIG.baseURL || "").replace(/\/+$/, "");
      const fallbackBase = String(window.API_CONFIG.fallbackBaseURL || "").replace(/\/+$/, "");
      const bases = [primaryBase];
      if (fallbackBase && fallbackBase !== primaryBase) bases.push(fallbackBase);
      return bases;
    }

    shouldRetryStatus(statusCode) {
      return statusCode === 404 || statusCode === 405 || statusCode >= 500;
    }

    getCredentialsMode(base) {
      try {
        const targetOrigin = new URL(String(base || window.location.origin), window.location.origin).origin;
        return targetOrigin === window.location.origin ? "same-origin" : "omit";
      } catch {
        return "same-origin";
      }
    }

    async request(endpoint, method, body = null) {
      const path = this.normalizePath(endpoint);
      const bases = this.getBaseCandidates();
      let lastError = null;

      for (let i = 0; i < bases.length; i += 1) {
        const base = bases[i];
        const url = `${base}${path}`;
        const options = {
          method,
          headers: this.getHeaders(),
          credentials: this.getCredentialsMode(base),
        };
        if (body) options.body = JSON.stringify(body);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), window.API_CONFIG.timeout || 30000);
          options.signal = controller.signal;

          const response = await fetch(url, options);
          clearTimeout(timeoutId);

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            if (i < bases.length - 1 && this.shouldRetryStatus(response.status)) {
              continue;
            }
            throw new Error(payload?.error || `Error del servidor: ${response.status}`);
          }

          if (base !== String(window.API_CONFIG.baseURL || "").replace(/\/+$/, "")) {
            window.API_CONFIG.baseURL = base;
          }
          return payload;
        } catch (error) {
          lastError = error;
          if (i === bases.length - 1) {
            console.error("API Request Error:", error);
            throw error;
          }
        }
      }

      throw lastError || new Error("Error de red");
    }

    async login(email, password, captchaToken = null) {
      const data = await this.request(window.API_CONFIG.endpoints.login, "POST", { email, password, captchaToken });
      if (data.token) {
        this.setToken(data.token);
        localStorage.setItem("kyrbi_user", JSON.stringify(data.user));
      }
      return data;
    }

    async register(username, email, password, captchaToken = null) {
      const data = await this.request(window.API_CONFIG.endpoints.register, "POST", {
        username,
        email,
        password,
        captchaToken,
      });
      if (data.token) {
        this.setToken(data.token);
        localStorage.setItem("kyrbi_user", JSON.stringify(data.user));
      }
      return data;
    }

    async verifyEmail(token) {
      return this.request(window.API_CONFIG.endpoints.verifyEmail, "POST", { token });
    }

    async resendVerificationEmail(email = null) {
      const body = email ? { email } : {};
      return this.request(window.API_CONFIG.endpoints.resendVerify, "POST", body);
    }

    async setup2FA() {
      return this.request(window.API_CONFIG.endpoints.setup2FA, "POST");
    }

    async verify2FASetup(token) {
      return this.request(window.API_CONFIG.endpoints.verify2FASetup, "POST", { token });
    }

    async disable2FA() {
      return this.request(window.API_CONFIG.endpoints.disable2FA, "POST");
    }

    async getCsrfToken() {
      try {
        const data = await this.request(window.API_CONFIG.endpoints.csrfToken, "GET");
        window.CSRF_TOKEN = data?.token || null;
        return window.CSRF_TOKEN;
      } catch {
        window.CSRF_TOKEN = null;
        return null;
      }
    }

    async requestPasswordReset(email) {
      return this.request(window.API_CONFIG.endpoints.requestReset, "POST", { email });
    }

    async confirmPasswordReset(token, password) {
      return this.request(window.API_CONFIG.endpoints.confirmReset, "POST", { token, password });
    }

    async verify2FA(email, code) {
      return this.request(window.API_CONFIG.endpoints.verify2FA, "POST", { email, token: code, code });
    }

    async getHistory() {
      this.requireAuth();
      return this.request(window.API_CONFIG.endpoints.history, "GET");
    }

    async getConversation(id) {
      this.requireAuth();
      return this.request(`${window.API_CONFIG.endpoints.history}/${id}`, "GET");
    }

    async updateConversation(id, payload = {}) {
      this.requireAuth();
      return this.request(`${window.API_CONFIG.endpoints.history}/${id}`, "PATCH", payload);
    }

    async deleteConversation(id) {
      this.requireAuth();
      return this.request(`${window.API_CONFIG.endpoints.history}/${id}`, "DELETE");
    }

    async getConversationMemory(id) {
      this.requireAuth();
      if (!id) return { summary: "" };
      return this.request(`${window.API_CONFIG.endpoints.memory}/${id}`, "GET");
    }

    async getMe() {
      this.requireAuth();
      return this.request(window.API_CONFIG.endpoints.me, "GET");
    }

    async updatePreferences(preferences = {}) {
      this.requireAuth();
      return this.request(window.API_CONFIG.endpoints.preferences, "PUT", { preferences });
    }

    async getMeta() {
      return this.request(window.API_CONFIG.endpoints.meta, "GET");
    }

    async getHealth() {
      return this.request(window.API_CONFIG.endpoints.health, "GET");
    }

    async sendMessage(message, mode = "general", conversationId = null) {
      this.requireAuth();

      const body = {
        message: String(message || "").trim(),
        mode,
        conversationId,
      };

      const response = await this.request(window.API_CONFIG.endpoints.chat, "POST", body);

      return {
        text: response.content || response.text || "Lo siento, no pude generar una respuesta.",
        mode: response.mode || mode,
        timestamp: response.timestamp,
        conversationId: response.conversationId,
      };
    }
  }

  window.KyrbiAPI = new KyrbiClient();
}
