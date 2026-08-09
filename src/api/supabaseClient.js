// Supabase Client para AndresWeb
import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente devem ser configuradas no arquivo .env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sua-chave-anonima-publica';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * Adaptador de Compatibilidade que traduz as chamadas de entidades para o Supabase
 */
export function createSupabaseEntityAdapter(tableName) {
  return {
    async list(sort = '-created_at', limit = 1000) {
      const desc = sort.startsWith('-');
      const column = desc ? sort.slice(1) : sort;
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order(column === 'created_date' ? 'created_at' : column, { ascending: !desc })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    async filter(criteria = {}, sort = '-created_at', limit = 1000) {
      const desc = sort.startsWith('-');
      const column = desc ? sort.slice(1) : sort;

      let query = supabase.from(tableName).select('*');

      for (const [key, value] of Object.entries(criteria)) {
        if (key.startsWith('$')) continue; // ignora seletores legados
        query = query.eq(key, value);
      }

      const { data, error } = await query
        .order(column === 'created_date' ? 'created_at' : column, { ascending: !desc })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) return null;
      return data;
    },

    async create(dataPayload) {
      const { data, error } = await supabase
        .from(tableName)
        .insert([dataPayload])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async bulkCreate(items) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },

    async update(id, dataPayload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(dataPayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true, id };
    }
  };
}
