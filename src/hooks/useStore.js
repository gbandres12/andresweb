import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useStore() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const storeId = user?.data?.store_id;
      if (!storeId) {
        setStore(null);
        setNeedsOnboarding(true);
        return;
      }
      try {
        const s = await base44.entities.Store.get(storeId);
        setStore(s);
        setNeedsOnboarding(false);
      } catch (e) {
        setStore(null);
        setNeedsOnboarding(true);
      }
    } catch (e) {
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

  return { store, loading, needsOnboarding, completeOnboarding, reload: load };
}