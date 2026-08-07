import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const _base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// ── Multi-tenant: auto-inject store_id on creates ──
// Entidades que não recebem store_id (próprias da plataforma/SaaS)
const EXCLUDED_ENTITIES = new Set(['Store', 'User']);

let _cachedStoreId = null;
let _storeIdPromise = null;

async function resolveStoreId() {
  if (_cachedStoreId) return _cachedStoreId;
  if (_storeIdPromise) return _storeIdPromise;
  _storeIdPromise = (async () => {
    try {
      const user = await _base44.auth.me();
      _cachedStoreId = user?.data?.store_id || null;
    } catch {
      _cachedStoreId = null;
    } finally {
      _storeIdPromise = null;
    }
    return _cachedStoreId;
  })();
  return _storeIdPromise;
}

// Limpa o cache — chamar após onboarding (updateMe com store_id)
export function refreshStoreId() {
  _cachedStoreId = null;
  _storeIdPromise = null;
}

const entityHandler = {
  get(target, prop) {
    const orig = target[prop];
    if (prop === 'create' && typeof orig === 'function') {
      return async (data, ...rest) => {
        const storeId = await resolveStoreId();
        const payload = storeId && !data?.store_id ? { ...data, store_id: storeId } : data;
        return orig.call(target, payload, ...rest);
      };
    }
    if (prop === 'bulkCreate' && typeof orig === 'function') {
      return async (items, ...rest) => {
        const storeId = await resolveStoreId();
        const payload = storeId
          ? (items || []).map(d => (d?.store_id ? d : { ...d, store_id: storeId }))
          : items;
        return orig.call(target, payload, ...rest);
      };
    }
    return orig;
  }
};

const entitiesProxy = new Proxy(_base44.entities, {
  get(target, entityName) {
    const entity = target[entityName];
    if (!entity || typeof entity !== 'object' || EXCLUDED_ENTITIES.has(entityName)) {
      return entity;
    }
    return new Proxy(entity, entityHandler);
  }
});

export const base44 = new Proxy(_base44, {
  get(target, prop) {
    if (prop === 'entities') return entitiesProxy;
    return target[prop];
  }
});