import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44, refreshStoreId } from '@/api/base44Client';

function useStoreImpl() {
  const [store, setStore] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const storeId = user?.data?.store_id || user?.store_id;

      // Carrega todas as lojas do usuário (próprias + ativa)
      try {
        const list = await base44.entities.Store.list();
        setStores(list || []);
      } catch {
        setStores([]);
      }

      if (!storeId) {
        setStore(null);
        setNeedsOnboarding(true);
        return;
      }
      try {
        const s = await base44.entities.Store.get(storeId);
        setStore(s);
        setNeedsOnboarding(false);
      } catch {
        setStore(null);
        setNeedsOnboarding(true);
      }
    } catch {
      setStore(null);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const completeOnboarding = useCallback((newStore) => {
    setStore(newStore);
    setNeedsOnboarding(false);
  }, []);

  const switchStore = useCallback(async (storeId) => {
    await base44.auth.updateMe({ store_id: storeId, store_role: 'owner' });
    refreshStoreId();
    await load();
  }, [load]);

  return { store, stores, loading, needsOnboarding, completeOnboarding, switchStore, reload: load };
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const value = useStoreImpl();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore precisa ser usado dentro de StoreProvider');
  return ctx;
}