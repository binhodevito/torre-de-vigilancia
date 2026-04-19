// ============================================================
// api.js — Torre de Vigilância — Comunicação com Supabase
// ============================================================

// ⚠️ CONFIGURAR: cole aqui as credenciais do seu projeto Supabase
// Supabase → Settings → API → Project URL e anon/public key
const SUPABASE_URL      = 'https://alxrzpclqmhdzcmsxjbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0Im3ImhTDxcOtn6ZRjgu9w_Rq8APP9d';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache local em memória para a sessão (evita roundtrips desnecessários)
const _cache = { colecao: null, listas: null };

function invalidarCacheLocal() { _cache.colecao = null; _cache.listas = null; }

async function getUserId() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

// ── COLEÇÃO ────────────────────────────────────────────────

async function apiGetColecao(forcar = false) {
  if (_cache.colecao && !forcar) return _cache.colecao;

  const userId = await getUserId();
  const { data, error } = await db
    .from('colecao')
    .select('*')
    .eq('user_id', userId)
    .order('data_adicao', { ascending: false });

  if (error) throw new Error(error.message);
  _cache.colecao = data || [];
  return _cache.colecao;
}

async function apiAdicionarGibi(gibi) {
  const userId = await getUserId();
  const payload = { ...gibi, user_id: userId };
  delete payload.id; // deixa o Supabase gerar o UUID

  const { error } = await db.from('colecao').insert(payload);
  if (error) {
    if (error.code === '23505') throw new Error('Gibi já existe na coleção');
    throw new Error(error.message);
  }
  _cache.colecao = null;
}

async function apiAtualizarGibi(dados) {
  const userId = await getUserId();
  const { id_guia, id, user_id, ...campos } = dados; // remove campos de controle
  const { error } = await db
    .from('colecao')
    .update(campos)
    .eq('user_id', userId)
    .eq('id_guia', id_guia);

  if (error) throw new Error(error.message);
  _cache.colecao = null;
}

async function apiRemoverGibi(idGuia) {
  const userId = await getUserId();
  const { error } = await db
    .from('colecao')
    .delete()
    .eq('user_id', userId)
    .eq('id_guia', idGuia);

  if (error) throw new Error(error.message);
  _cache.colecao = null;
}

async function apiGibiNaColecao(idGuia) {
  const colecao = await apiGetColecao();
  return colecao.find(g => String(g.id_guia) === String(idGuia)) || null;
}

// ── LISTAS ─────────────────────────────────────────────────
// Nota: o campo primário no Supabase é "id" (UUID).
// Mantemos "id_lista" nos objetos retornados para compatibilidade
// com o restante do código (ui.js, app.js).

async function apiGetListas(forcar = false) {
  if (_cache.listas && !forcar) return _cache.listas;

  const userId = await getUserId();
  const { data: listas, error } = await db
    .from('listas')
    .select('*')
    .eq('user_id', userId)
    .order('data_criacao', { ascending: true });

  if (error) throw new Error(error.message);

  // Conta itens por lista em uma única query
  const { data: contagens } = await db
    .from('lista_itens')
    .select('lista_id')
    .eq('user_id', userId);

  const mapa = {};
  (contagens || []).forEach(r => { mapa[r.lista_id] = (mapa[r.lista_id] || 0) + 1; });

  _cache.listas = (listas || []).map(l => ({
    ...l,
    id_lista: l.id,         // alias para compatibilidade
    total:    mapa[l.id] || 0,
  }));
  return _cache.listas;
}

async function apiCriarLista(dados) {
  const userId = await getUserId();
  const { data, error } = await db
    .from('listas')
    .insert({ ...dados, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  _cache.listas = null;
  return { id_lista: data.id, ...data };
}

async function apiAtualizarLista(dados) {
  const userId = await getUserId();
  const id     = dados.id_lista || dados.id;
  const { id_lista, user_id, ...campos } = dados;
  const { error } = await db
    .from('listas')
    .update(campos)
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw new Error(error.message);
  _cache.listas = null;
}

async function apiRemoverLista(idLista) {
  const userId = await getUserId();
  const { error } = await db
    .from('listas')
    .delete()
    .eq('user_id', userId)
    .eq('id', idLista);

  if (error) throw new Error(error.message);
  _cache.listas = null;
}

async function apiGetItensLista(idLista) {
  const userId = await getUserId();
  const { data: itens, error } = await db
    .from('lista_itens')
    .select('*')
    .eq('user_id', userId)
    .eq('lista_id', idLista)
    .order('ordem', { ascending: true });

  if (error) throw new Error(error.message);
  if (!itens?.length) return [];

  // Busca dados completos dos gibis da coleção do usuário
  const idGuias = itens.map(i => i.id_guia);
  const { data: gibis } = await db
    .from('colecao')
    .select('*')
    .eq('user_id', userId)
    .in('id_guia', idGuias);

  const mapa = {};
  (gibis || []).forEach(g => { mapa[g.id_guia] = g; });

  return itens.map(item => ({ ...item, gibi: mapa[item.id_guia] || null }));
}

async function apiAdicionarItemLista(idLista, idGuia) {
  const userId = await getUserId();

  // Pega a ordem máxima atual
  const { count } = await db
    .from('lista_itens')
    .select('*', { count: 'exact', head: true })
    .eq('lista_id', idLista);

  const { error } = await db.from('lista_itens').insert({
    lista_id:    idLista,
    id_guia:     idGuia,
    user_id:     userId,
    ordem:       (count || 0) + 1,
  });

  if (error) {
    if (error.code === '23505') throw new Error('Gibi já está nesta lista');
    throw new Error(error.message);
  }
  _cache.listas = null;
}

async function apiRemoverItemLista(idLista, idGuia) {
  const userId = await getUserId();
  const { error } = await db
    .from('lista_itens')
    .delete()
    .eq('user_id', userId)
    .eq('lista_id', idLista)
    .eq('id_guia', idGuia);

  if (error) throw new Error(error.message);
}

// ── CACHE DO GUIA (compartilhado entre todos os usuários) ──
// Qualquer usuário pode ler e inserir — ninguém pode apagar

async function apiGetCacheGuia(idGuia) {
  if (!idGuia) return null;
  const { data, error } = await db
    .from('cache_guia')
    .select('*')
    .eq('id_guia', String(idGuia))
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function apiSalvarCacheGuia(gibi) {
  if (!gibi?.id_guia) return;
  const { error } = await db.from('cache_guia').upsert(
    { ...gibi, data_cache: new Date().toISOString() },
    { onConflict: 'id_guia' }
  );
  if (error) console.warn('Falha ao salvar cache do Guia:', error.message);
}

// ── ESTATÍSTICAS ───────────────────────────────────────────

async function apiGetStats() {
  const gibis = await apiGetColecao();

  const total    = gibis.length;
  const lidos    = gibis.filter(g => g.status === 'lido').length;
  const lendo    = gibis.filter(g => g.status === 'lendo').length;
  const quereLer = gibis.filter(g => g.status === 'quero_ler').length;
  const fisicos  = gibis.filter(g => g.fisico).length;

  const comNota   = gibis.filter(g => g.nota > 0);
  const mediaNota = comNota.length
    ? (comNota.reduce((s, g) => s + g.nota, 0) / comNota.length).toFixed(1)
    : 0;
  const melhor = [...comNota].sort((a, b) => b.nota - a.nota)[0] || null;

  const porEditora = {};
  gibis.forEach(g => {
    const e = g.editora || 'Desconhecida';
    porEditora[e] = (porEditora[e] || 0) + 1;
  });
  const editorasOrdenadas = Object.entries(porEditora)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, count]) => ({ nome, count }));

  const porAno = {};
  gibis.filter(g => g.status === 'lido' && g.data_leitura).forEach(g => {
    const ano = new Date(g.data_leitura).getFullYear();
    if (!isNaN(ano)) porAno[ano] = (porAno[ano] || 0) + 1;
  });
  const lidosPorAno = Object.entries(porAno)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([ano, count]) => ({ ano: Number(ano), count }));

  return { total, lidos, lendo, quereLer, fisicos, mediaNota, melhor, editorasOrdenadas, lidosPorAno };
}

// ── EXPORTAR / IMPORTAR ────────────────────────────────────

function exportarColecaoJSON() {
  const colecao = _cache.colecao || [];
  const blob    = new Blob([JSON.stringify(colecao, null, 2)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `torre-vigilancia-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importarColecaoJSON(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const gibis = JSON.parse(e.target.result);
        if (!Array.isArray(gibis)) throw new Error('Formato inválido');
        const atual     = await apiGetColecao(true);
        const idsAtuais = new Set(atual.map(g => String(g.id_guia)));
        let importados  = 0;
        for (const gibi of gibis) {
          if (!idsAtuais.has(String(gibi.id_guia))) {
            await apiAdicionarGibi(gibi);
            importados++;
          }
        }
        resolve({ total: gibis.length, importados, duplicatas: gibis.length - importados });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(arquivo);
  });
}
