/* ==========================================================================
   Cliente API para comunicarse con el backend de Kyrbi
   ========================================================================== */

if (!window.API_CONFIG) {
  window.API_CONFIG = {
    // URL del backend - cambiar según el entorno
    baseURL: (typeof window.BACKEND_URL === 'string' && window.BACKEND_URL.trim().length > 0)
      ? window.BACKEND_URL.trim()
      : window.location.origin,
    endpoints: {
      chat: '/api/chat',
      chatPublic: '/api/chat/public',
      history: '/api/chat/history',
      historyPublic: '/api/chat/public/history',
      login: '/api/auth/login',
      register: '/api/auth/register',
      csrfToken: '/api/auth/csrf-token',
      verifyEmail: '/api/auth/verify-email',
      resendVerify: '/api/auth/verify-email/resend',
      setup2FA: '/api/auth/2fa/setup',
      verify2FASetup: '/api/auth/2fa/verify-setup',
      disable2FA: '/api/auth/2fa/disable',
      requestReset: '/api/auth/password/reset/request',
      confirmReset: '/api/auth/password/reset/confirm',
      verify2FA: '/api/auth/login/verify-2fa'
    },
    timeout: 30000, // 30 segundos
  };
}

/**
 * Clase para manejar la comunicación con la API
 */
if (!window.KyrbiAPI) {
  class KyrbiClient {
    constructor() {
      this.token = localStorage.getItem('kyrbi_token') || sessionStorage.getItem('kyrbi_token');
      this.sessionId = localStorage.getItem('kyrbi_session');
      if (!this.sessionId) {
        this.sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem('kyrbi_session', this.sessionId);
      }
    }

    getHeaders() {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (window.CSRF_TOKEN) {
        headers['x-csrf-token'] = window.CSRF_TOKEN;
      }
      return headers;
    }

    setToken(token) {
      this.token = token;
      localStorage.setItem('kyrbi_token', token);
    }

    logout() {
      this.token = null;
      localStorage.removeItem('kyrbi_token');
      localStorage.removeItem('kyrbi_user');
      sessionStorage.removeItem('kyrbi_token');
      window.location.href = 'login.html';
    }

    async request(endpoint, method, body = null) {
      try {
        const url = `${window.API_CONFIG.baseURL}${endpoint}`;
        const options = {
          method,
          headers: this.getHeaders(),
        };

        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 401) {
              // Token expirado o inválido
              if (!window.location.pathname.includes('login.html') && 
                  !window.location.pathname.includes('register.html')) {
                  // this.logout(); // Opcional: forzar logout
              }
          }
          throw new Error(errorData.error || `Error del servidor: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error('API Request Error:', error);
        throw error;
      }
    }

    async login(email, password, captchaToken = null) {
      const data = await this.request(window.API_CONFIG.endpoints.login, 'POST', { email, password, captchaToken });
      if (data.token) {
        this.setToken(data.token);
        localStorage.setItem('kyrbi_user', JSON.stringify(data.user));
      }
      return data;
    }

    async register(username, email, password, captchaToken = null) {
      const data = await this.request(window.API_CONFIG.endpoints.register, 'POST', { username, email, password, captchaToken });
      if (data.token) {
        this.setToken(data.token);
        localStorage.setItem('kyrbi_user', JSON.stringify(data.user));
      }
      return data;
    }
    
    async verifyEmail(token) {
      return await this.request(window.API_CONFIG.endpoints.verifyEmail, 'POST', { token });
    }
    
    async resendVerificationEmail(email = null) {
      const body = email ? { email } : {};
      return await this.request(window.API_CONFIG.endpoints.resendVerify, 'POST', body);
    }
    
    async setup2FA() {
      return await this.request(window.API_CONFIG.endpoints.setup2FA, 'POST');
    }

    async verify2FASetup(token) {
      return await this.request(window.API_CONFIG.endpoints.verify2FASetup, 'POST', { token });
    }

    async disable2FA() {
      return await this.request(window.API_CONFIG.endpoints.disable2FA, 'POST');
    }
    
    async getCsrfToken() {
      try {
        const data = await this.request(window.API_CONFIG.endpoints.csrfToken, 'GET');
        window.CSRF_TOKEN = data?.token || null;
        return window.CSRF_TOKEN;
      } catch {
        window.CSRF_TOKEN = null;
        return null;
      }
    }
    
    async requestPasswordReset(email) {
      return await this.request(window.API_CONFIG.endpoints.requestReset, 'POST', { email });
    }
    
    async confirmPasswordReset(token, password) {
      return await this.request(window.API_CONFIG.endpoints.confirmReset, 'POST', { token, password });
    }
    
    async verify2FA(email, code) {
      return await this.request(window.API_CONFIG.endpoints.verify2FA, 'POST', { email, code });
    }

    async getHistory() {
      if (!this.token) {
        const url = `${window.API_CONFIG.endpoints.historyPublic}?sessionId=${encodeURIComponent(this.sessionId)}`;
        return await this.request(url, 'GET');
      }
      return await this.request(window.API_CONFIG.endpoints.history, 'GET');
    }

    async getConversation(id) {
      if (!this.token) {
        const url = `${window.API_CONFIG.endpoints.historyPublic}/${id}?sessionId=${encodeURIComponent(this.sessionId)}`;
        return await this.request(url, 'GET');
      }
      return await this.request(`${window.API_CONFIG.endpoints.history}/${id}`, 'GET');
    }

    async sendMessage(message, mode = 'general', conversationId = null) {
      const body = {
        message: message.trim(),
        mode: mode,
        conversationId: conversationId
      };

      let response;
      if (this.token) {
        response = await this.request(window.API_CONFIG.endpoints.chat, 'POST', body);
      } else {
        response = await this.request(window.API_CONFIG.endpoints.chatPublic, 'POST', { ...body, sessionId: this.sessionId });
      }
      
      return {
        text: response.content || response.text || 'Lo siento, no pude generar una respuesta.',
        mode: response.mode || mode,
        timestamp: response.timestamp,
        conversationId: response.conversationId
      };
    }
  }

  // Exportar instancia única
  window.KyrbiAPI = new KyrbiClient();
}
