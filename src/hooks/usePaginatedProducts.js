import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Paginação e carregamento sob demanda (infinite scroll) para o catálogo de produtos.
 * Busca e filtros rodam no servidor (skip/limit + $regex) — suporta centenas de milhares
 * de produtos sem carregar tudo no cliente.
 *
 * @param {object} opts
 * @param {boolean} opts.activeOnly   - Filtrar apenas produtos ativos (PDV).
 * @param {string}  opts.category     - Categoria ("all" = todas).
 * @param {string}  opts.sortBy        - Ordenação (padrão: -created_date).
 * @param {number}  opts.pageSize     - Itens por página (padrão 50, máx 5000).
 * @param {number}  opts.debounce     - ms de debounce para a busca textual.
 * @param {object}  opts.scrollRootRef - Ref do contêiner scrollável para o IntersectionObserver.
 */
export function usePaginatedProducts({
  activeOnly = false,
  category = 'all',
  sortBy = '-created_date',
  pageSize = 50,
  debounce = 350,
  scrollRootRef = null,
} = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const sentinelRef = useRef(null);
  const searchTimer = useRef();
  const mounted = useRef(false);
  const currentSearch = useRef('');

  const buildQuery = (term) => {
    const q = {};
    if (activeOnly) q.is_active = true;
    if (category && category !== 'all') q.category = category;
    if (term && term.trim()) q.name = { $regex: term.trim(), $options: 'i' };
    return q;
  };

  const loadInitial = useCallback((term) => {
    setLoading(true);
    currentSearch.current = term;
    const q = buildQuery(term);
    base44.entities.Product.filter(q, sortBy, pageSize, 0)
      .then(first => {
        setItems(first);
        setHasMore(first.length === pageSize);
        setPage(1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeOnly, category, sortBy, pageSize]);

  // Recarrega imediatamente quando filtros estruturais mudam (categoria/ativo/sort) e no mount.
  useEffect(() => {
    loadInitial(currentSearch.current);
  }, [loadInitial]);

  // Busca textual com debounce (não dispara no mount para evitar fetch duplo).
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadInitial(search), debounce);
    return () => clearTimeout(searchTimer.current);
  }, [search, loadInitial, debounce]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const q = buildQuery(currentSearch.current);
    base44.entities.Product.filter(q, sortBy, pageSize, page * pageSize)
      .then(next => {
        setItems(prev => [...prev, ...next]);
        setHasMore(next.length === pageSize);
        setPage(p => p + 1);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }, [hasMore, loadingMore, loading, page, sortBy, pageSize]);

  const reload = useCallback(() => loadInitial(currentSearch.current), [loadInitial]);

  // IntersectionObserver — dispara loadMore quando o sentinel aparece.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { root: scrollRootRef?.current ?? null, rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, scrollRootRef]);

  return { items, setItems, loading, loadingMore, hasMore, loadMore, reload, search, setSearch, sentinelRef };
}