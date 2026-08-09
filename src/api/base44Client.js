// Adaptador nativo REST para o backend próprio AndresWeb
// Substitui 100% o @base44/sdk com suporte total às rotas /api

const API_BASE = '/api';

function getAuthToken() {
  return localStorage.getItem('andresweb_token') || '';
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem('andresweb_token', token);
  } else {
    localStorage.removeItem('andresweb_token');
  }
}

async function request(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.error || `Erro HTTP ${response.status}`);
    err.status = response.status;
    err.data = errorData;
    throw err;
  }

  return response.json();
}

function createEntityClient(entityName) {
  return {
    async list(sort = '-created_date', limit = 1000) {
      const query = new URLSearchParams({ _sort: sort, _limit: limit }).toString();
      return request(`${API_BASE}/entities/${entityName}?${query}`);
    },

    async filter(criteria = {}, sort = '-created_date', limit = 1000) {
      return request(`${API_BASE}/entities/${entityName}/filter`, {
        method: 'POST',
        body: JSON.stringify({ criteria, sort, limit })
      });
    },

    async get(id) {
      return request(`${API_BASE}/entities/${entityName}/${id}`);
    },

    async create(data) {
      return request(`${API_BASE}/entities/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async bulkCreate(items) {
      return request(`${API_BASE}/entities/${entityName}/bulk`, {
        method: 'POST',
        body: JSON.stringify(items)
      });
    },

    async update(id, data) {
      return request(`${API_BASE}/entities/${entityName}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async delete(id) {
      return request(`${API_BASE}/entities/${entityName}/${id}`, {
        method: 'DELETE'
      });
    }
  };
}

const entitiesProxy = new Proxy({}, {
  get(target, entityName) {
    if (!target[entityName]) {
      target[entityName] = createEntityClient(entityName);
    }
    return target[entityName];
  }
});

export const base44 = {
  entities: entitiesProxy,
  get asServiceRole() {
    return this;
  },

  auth: {
    async me() {
      const res = await request(`${API_BASE}/auth/me`);
      return res.data || res;
    },

    async login(email, password) {
      const res = await request(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (res.token) {
        setAuthToken(res.token);
      }
      return res;
    },

    async register(payload) {
      const res = await request(`${API_BASE}/auth/register`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.token) {
        setAuthToken(res.token);
      }
      return res;
    },

    async updateMe(payload) {
      return request(`${API_BASE}/auth/update-me`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    },

    logout(redirectUrl) {
      setAuthToken(null);
      if (redirectUrl) {
        window.location.href = '/login';
      } else {
        window.location.reload();
      }
    },

    redirectToLogin() {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  },

  functions: {
    async invoke(functionName, payload) {
      return request(`${API_BASE}/functions/${functionName}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  integrations: {
    Core: {
      async UploadFile({ file }) {
        const formData = new FormData();
        formData.append('file', file);

        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/integrations/Core/UploadFile`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData
        });

        if (!res.ok) throw new Error('Erro ao fazer upload do arquivo');
        return res.json();
      },

      async InvokeLLM(payload) {
        return request(`${API_BASE}/integrations/Core/InvokeLLM`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      },

      async ExtractDataFromUploadedFile(payload) {
        return request(`${API_BASE}/integrations/Core/ExtractDataFromUploadedFile`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
    }
  }
};

export function refreshStoreId() {
  // No-op para compatibilidade
}