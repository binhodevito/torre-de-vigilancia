// ============================================================
// scraper.js — Busca RESPEITOSA no Guia dos Quadrinhos
//
// FILOSOFIA:
//  - Cada gibi é consultado apenas UMA VEZ
//  - Resultado fica em cache permanente no Supabase (tabela cache_guia)
//  - Delay obrigatório de 1500ms entre requisições consecutivas
//  - Limite de 10 resultados por busca
//  - Se falhar: cadastro manual sempre disponível
// ============================================================

'use strict'; // ✅ FIX: movido para depois dos comentários

const PROXY_URL   = 'https://api.allorigins.win/get?url=';
const BASE_GUIA   = 'http://www.guiadosquadrinhos.com';
const BUSCA_GUIA  = `${BASE_GUIA}/busca?p=`;
const DELAY_MS    = 1500;
const MAX_RESULTS = 10;

let _ultimaRequisicao = 0;

// ── Rate limiting respeitoso ───────────────────────────────
async function aguardarDelay() {
const agora     = Date.now();
const decorrido = agora - _ultimaRequisicao;
if (decorrido < DELAY_MS) {
  await new Promise(r => setTimeout(r, DELAY_MS - decorrido));
}
_ultimaRequisicao = Date.now();
}

// ── Busca com proxy CORS ───────────────────────────────────
// ✅ FIX 12: AbortController manual no lugar de AbortSignal.timeout()
//    para compatibilidade com browsers mais antigos
async function buscarViProxy(url) {
await aguardarDelay();

const controller = new AbortController();
const timer      = setTimeout(() => controller.abort(), 15000);

try {
  const proxyUrl = PROXY_URL + encodeURIComponent(url);
  const resposta = await fetch(proxyUrl, { signal: controller.signal });
  if (!resposta.ok) throw new Error(`Proxy retornou ${resposta.status}`);
  const json = await resposta.json();
  if (!json.contents) throw new Error('Proxy sem conteúdo');
  return json.contents;
} finally {
  clearTimeout(timer); // sempre limpa o timer, com ou sem erro
}
}

// ── Normaliza URL de imagem ────────────────────────────────
function normalizarUrlImagem(src) {
if (!src) return '';
if (src.startsWith('http')) return src;
if (src.startsWith('//'))   return 'http:' + src;
return BASE_GUIA + (src.startsWith('/') ? '' : '/') + src;
}

// ── Gera ID único a partir da URL da edição ────────────────
function gerarIdGuia(urlEdicao) {
const match = urlEdicao.match(/\/edicao\/(\d+)/i)
  || urlEdicao.match(/edicao=(\d+)/i)
  || urlEdicao.match(/id=(\d+)/i);
if (match) return match[1];

let hash = 0;
for (let i = 0; i < urlEdicao.length; i++) {
  hash = (hash * 31 + urlEdicao.charCodeAt(i)) & 0xffffffff;
}
return 'g' + Math.abs(hash).toString(36);
}

// ── Parser de resultados de busca ──────────────────────────
function parsearResultadosBusca(html) {
const parser = new DOMParser();
const doc    = parser.parseFromString(html, 'text/html');
const itens  = [];

const selectors = [
  '.resultados-busca .item-resultado',
  '.lista-edicoes .edicao',
  '.grid-edicoes .card',
  'table.tabela-busca tr[data-id]',
  '.resultado-item',
];

let elementos = [];
for (const sel of selectors) {
  elementos = [...doc.querySelectorAll(sel)];
  if (elementos.length > 0) break;
}

if (elementos.length === 0) {
  const links = [...doc.querySelectorAll('a[href*="/edicao/"], a[href*="edicao="]')];
  const pais  = new Set(links.map(l => l.closest('td, li, div.item, div.card, article') || l.parentElement));
  elementos   = [...pais].filter(Boolean);
}

for (const el of elementos.slice(0, MAX_RESULTS)) {
  try {
    const gibi = parsearElementoGibi(el);
    if (gibi && gibi.titulo) itens.push(gibi);
  } catch (_) {}
}

return itens;
}

// ── Parser de um elemento de gibi ─────────────────────────
function parsearElementoGibi(el) {
const linkEl   = el.querySelector('a[href*="/edicao/"], a[href*="edicao="]') || el.closest('a');
const urlRel   = linkEl?.getAttribute('href') || '';
const urlOrig  = urlRel ? (urlRel.startsWith('http') ? urlRel : BASE_GUIA + urlRel) : '';
const idGuia   = urlOrig ? gerarIdGuia(urlOrig) : '';

const imgEl   = el.querySelector('img');
const capaUrl = normalizarUrlImagem(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

const textoCompleto = el.textContent || '';

const tituloEl = el.querySelector('.titulo, .nome, h2, h3, h4, .edicao-titulo, [class*="titulo"], [class*="nome"]');
let titulo      = (tituloEl?.textContent || '').trim();
if (!titulo) {
  titulo = imgEl?.getAttribute('alt') || linkEl?.getAttribute('title') || '';
}
titulo = titulo.replace(/\s+/g, ' ').trim();

const numMatch = textoCompleto.match(/[Nn][ºo°]\.?\s*(\d+)/) || textoCompleto.match(/#\s*(\d+)/);
const numero   = numMatch ? numMatch[1] : '';

const editoraEl = el.querySelector('.editora, [class*="editora"]');
const editora   = (editoraEl?.textContent || '').trim() || extrairEditora(textoCompleto);

const anoMatch = textoCompleto.match(/\b(19|20)\d{2}\b/);
const ano      = anoMatch ? anoMatch[0] : '';

const artistasEl  = el.querySelector('.artistas, [class*="artistas"], [class*="autores"]');
const artistas    = (artistasEl?.textContent || '').trim();

const persEl      = el.querySelector('.personagens, [class*="personagens"], [class*="characters"]');
const personagens = (persEl?.textContent || '').trim();

return { id_guia: idGuia, titulo, numero, editora, ano, capa_url: capaUrl, artistas, personagens, url_original: urlOrig };
}

function extrairEditora(texto) {
const editoras = ['Abril','Globo','Panini','DC','Marvel','Mythos','Devir','Pixel','Conrad','Zarabatana','Brainstore'];
for (const ed of editoras) {
  if (new RegExp(`\\b${ed}\\b`, 'i').test(texto)) return ed;
}
return '';
}

// ── Busca de detalhes de uma edição ───────────────────────
async function buscarDetalhesEdicao(urlOrig) {
const html    = await buscarViProxy(urlOrig);
const parser  = new DOMParser();
const doc     = parser.parseFromString(html, 'text/html');

const capaImg  = doc.querySelector('.capa-edicao img, .capa img, img.capa, img[src*="/capas/"]');
const capaUrl  = normalizarUrlImagem(capaImg?.getAttribute('src') || '');

const artistasEls = [...doc.querySelectorAll('[class*="artista"], .roteirista, .desenhista, .autor, [class*="autor"]')];
const artistas     = artistasEls.map(e => e.textContent.trim()).filter(Boolean).join(', ');

const persEls     = [...doc.querySelectorAll('[class*="personagem"], [class*="character"], .personagens li, .personagens a')];
const personagens  = persEls.map(e => e.textContent.trim()).filter(Boolean).join(', ');

return { capa_url: capaUrl, artistas, personagens };
}

// ── Função principal de busca ──────────────────────────────
// ✅ FIX 10: Promise.allSettled garante que uma falha de cache
//    não derruba os resultados inteiros do scraping
async function buscarGibis(termo) {
if (!termo || termo.trim().length < 2) return [];

const url = BUSCA_GUIA + encodeURIComponent(termo.trim());
let html;

try {
  html = await buscarViProxy(url);
} catch (err) {
  console.warn('Falha no proxy ao buscar:', err.message);
  throw new Error('Não foi possível conectar ao Guia dos Quadrinhos. Verifique sua conexão ou tente novamente.');
}

const resultados = parsearResultadosBusca(html);

const resultadosCache = await Promise.allSettled(
  resultados.map(async gibi => {
    if (!gibi.id_guia) return gibi;
    try {
      const cached = await apiGetCacheGuia(gibi.id_guia);
      if (cached) return { ...gibi, ...cached, _do_cache: true };
    } catch (_) {
      // falha silenciosa — retorna gibi sem cache
    }
    return gibi;
  })
);

return resultadosCache
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
}

// ── Busca por URL direta de uma edição ────────────────────
// ✅ FIX 11: tenta encontrar container específico antes de usar body
async function buscarGibiPorUrl(url) {
const cached = await apiGetCacheGuia(gerarIdGuia(url));
if (cached) return cached;

const html   = await buscarViProxy(url);
const parser = new DOMParser();
const doc    = parser.parseFromString(html, 'text/html');

// Tenta container específico antes de cair no body
const el   = doc.querySelector('.edicao-detalhe, .detalhe-edicao, article.edicao, main')
           || doc.querySelector('body');
const gibi = parsearElementoGibi(el);

gibi.url_original = url;
gibi.id_guia      = gerarIdGuia(url);

// Enriquece com detalhes de resolução maior
const detalhes = await buscarDetalhesEdicao(url).catch(() => ({}));
if (detalhes.capa_url)  gibi.capa_url  = detalhes.capa_url;
if (detalhes.artistas)  gibi.artistas  = detalhes.artistas;
if (detalhes.personagens) gibi.personagens = detalhes.personagens;

if (gibi.titulo) await apiSalvarCacheGuia(gibi);

return gibi;
}

// ── Salva no cache após scraping ───────────────────────────
async function cachearGibi(gibi) {
if (!gibi || gibi._do_cache) return;
await apiSalvarCacheGuia(gibi);
}

// ── Cadastro manual (sem scraping) ────────────────────────
function criarGibiManual(dados) {
return {
  id_guia:      'manual_' + Date.now().toString(36),
  titulo:       dados.titulo   || '',
  numero:       dados.numero   || '',
  editora:      dados.editora  || '',
  ano:          dados.ano      || '',
  capa_url:     dados.capa_url || '',
  artistas:     dados.artistas || '',
  personagens:  dados.personagens  || '',
  url_original: dados.url_original || '',
};
}