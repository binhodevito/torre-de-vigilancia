// ============================================================
// config.js — Torre de Vigilância — Configurações
// ============================================================

'use strict';

// Configurações do Supabase (mover para variáveis de ambiente em produção)
const SUPABASE_URL      = 'https://alxrzpclqmhdzcmsxjbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0Im3ImhTDxcOtn6ZRjgu9w_Rq8APP9d';

// Cliente Supabase
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache local
const _cache = {
  colecao: null,
  listas: null,
};

// Função para invalidar cache
function invalidarCacheLocal() {
  _cache.colecao = null;
  _cache.listas = null;
}