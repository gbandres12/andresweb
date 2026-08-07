// Compat shim — mantém imports `@/hooks/useStore` funcionando.
// A implementação real (com provider compartilhado) está em @/lib/StoreContext.
export { useStore, StoreProvider } from '@/lib/StoreContext';