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

'use strict';

// Proxy próprio via Supabase Edge Function (verify_jwt = false)
const PROXY_URL  = 'https://alxrzpclqmhdzcmsxjbq.supabase.co/functions/v1/proxy-guia?path=';
const BASE_GUIA  = 'http://www.guiadosquadrinhos.com';
// URL de busca correta descoberta em abr/2026 (o /busca?p= retorna 404)
const BUSCA_GUIA = `${BASE_GUIA}/busca-avancada-resultado.aspx?tit=`;
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

// ── Busca com proxy CORS próprio ───────────────────────────
async function buscarViProxy(url) {
await aguardarDelay();

const controller = new AbortController();
const timer      = setTimeout(() => controller.abort(), 15000);

try {
  const path     = url.replace(BASE_GUIA, '');
  const proxyUrl = PROXY_URL + encodeURIComponent(path);

  const resposta = await fetch(proxyUrl, { signal: controller.signal });

  if (!resposta.ok) throw new Error(`Proxy retornou ${resposta.status}`);
  const json = await resposta.json();
  if (!json.contents) throw new Error('Proxy sem conteúdo');
  return json.contents;

} finally {
  clearTimeout(timer);
}
}

// ── Normaliza URL de imagem ────────────────────────────────
function normalizarUrlImagem(src) {
if (!src) return '';
const s = src.trim();
// Descarta placeholders do Guia
if (!s || s.includes('nocovert') || s.includes('coversoont')) return '';
if (s.startsWith('http')) return s;
if (s.startsWith('//'))   return 'http:' + s;
return BASE_GUIA + (s.startsWith('/') ? '' : '/') + s;
}

// ── Gera ID único a partir da URL da edição ────────────────
function gerarIdGuia(urlEdicao) {
// Formato novo: edicao/slug/codigo/ID  (ex: edicao/batman-n-1/ab01/187196)
const matchNovo = urlEdicao.match(/edicao\/[^\/]+\/[^\/]+\/(\d+)/i);
if (matchNovo) return matchNovo[1];

// Formatos antigos de fallback
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

// Estrutura atual do Guia (2026): div.Lista_album_imagem_colecao > li
let elementos = [...doc.querySelectorAll('.Lista_album_imagem_colecao li')];

// Fallback para selectors antigos
if (elementos.length === 0) {
  const selectors = [
    '.resultados-busca .item-resultado',
    '.lista-edicoes .edicao',
    '.grid-edicoes .card',
    'table.tabela-busca tr[data-id]',
    '.resultado-item',
  ];
  for (const sel of selectors) {
    elementos = [...doc.querySelectorAll(sel)];
    if (elementos.length > 0) break;
  }
}

if (elementos.length === 0) {
  const links = [...doc.querySelectorAll('a[href*="edicao/"]')];
  const pais  = new Set(links.map(l => l.closest('li, td, div.item, div.card, article') || l.parentElement));
  elementos   = [...pais].filter(Boolean);
}

// O Guia repete cada edição 2x na página — deduplica por URL
const urlsVistas = new Set();
for (const el of elementos) {
  try {
    const gibi = parsearElementoGibi(el);
    if (gibi && gibi.titulo && !urlsVistas.has(gibi.url_original)) {
      urlsVistas.add(gibi.url_original);
      itens.push(gibi);
      if (itens.length >= MAX_RESULTS) break;
    }
  } catch (_) {}
}

return itens;
}

// ── Parser de um elemento de gibi ─────────────────────────
function parsearElementoGibi(el) {
const linkEl  = el.querySelector('a[href*="edicao/"]') || el.closest('a');
const urlRel  = linkEl?.getAttribute('href') || '';
const urlOrig = urlRel
  ? (urlRel.startsWith('http') ? urlRel : BASE_GUIA + '/' + urlRel.replace(/^\//, ''))
  : '';
const idGuia  = urlOrig ? gerarIdGuia(urlOrig) : '';

const imgEl   = el.querySelector('img');
const capaUrl = normalizarUrlImagem(
  (imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '').trim()
);

let titulo = '', editora = '', numero = '', ano = '';

const capinhaEl = el.querySelector('.numero_capinha');
if (capinhaEl) {
  // Formato atual: "Título n° N - Editora" dentro de .numero_capinha
  const textoCapinha = capinhaEl.textContent.replace(/\s+/g, ' ').trim();
  const partes = textoCapinha.split(' - ');
  const tituloComNum = (partes[0] || '').trim();
  editora = (partes[1] || '').trim();

  const numMatch = tituloComNum.match(/n[°o°\.]\s*(\d+)/i) || tituloComNum.match(/#\s*(\d+)/);
  numero = numMatch ? numMatch[1] : '';
  titulo = tituloComNum.replace(/\s*n[°o°\.]\s*\d+/i, '').replace(/\s*#\s*\d+/, '').trim();
  if (!titulo) titulo = tituloComNum;

  // Data vem após o </span>: ex: " dezembro  2025"
  const linkParent = capinhaEl.closest('a') || capinhaEl.parentElement;
  const textoData  = linkParent?.textContent || '';
  const anoMatch   = textoData.match(/\b(19|20)\d{2}\b/);
  ano = anoMatch ? anoMatch[0] : '';
} else {
  // Fallback para estruturas mais antigas
  const textoCompleto = el.textContent || '';
  const tituloEl = el.querySelector('.titulo, .nome, h2, h3, h4, .edicao-titulo, [class*="titulo"]');
  titulo = (tituloEl?.textContent
    || imgEl?.getAttribute('alt')
    || linkEl?.getAttribute('title')
    || '').replace(/\s+/g, ' ').trim();

  const numMatch = textoCompleto.match(/[Nn][ºo°]\.?\s*(\d+)/) || textoCompleto.match(/#\s*(\d+)/);
  numero = numMatch ? numMatch[1] : '';

  const editoraEl = el.querySelector('.editora, [class*="editora"]');
  editora = (editoraEl?.textContent || '').trim() || extrairEditora(textoCompleto);

  const anoMatch = textoCompleto.match(/\b(19|20)\d{2}\b/);
  ano = anoMatch ? anoMatch[0] : '';
}

return { id_guia: idGuia, titulo, numero, editora, ano, capa_url: capaUrl, artistas: '', personagens: '', url_original: urlOrig };
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
    } catch (_) {}
    return gibi;
  })
);

return resultadosCache
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
}

// ── Busca por URL direta de uma edição ────────────────────
async function buscarGibiPorUrl(url) {
const cached = await apiGetCacheGuia(gerarIdGuia(url));
if (cached) return cached;

const html   = await buscarViProxy(url);
const parser = new DOMParser();
const doc    = parser.parseFromString(html, 'text/html');

const el   = doc.querySelector('.Lista_album_imagem_colecao li, .edicao-detalhe, .detalhe-edicao, article.edicao, main')
           || doc.querySelector('body');
const gibi = parsearElementoGibi(el);

gibi.url_original = url;
gibi.id_guia      = gerarIdGuia(url);

const detalhes = await buscarDetalhesEdicao(url).catch(() => ({}));
if (detalhes.capa_url)    gibi.capa_url    = detalhes.capa_url;
if (detalhes.artistas)    gibi.artistas    = detalhes.artistas;
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
  titulo:       dados.titulo       || '',
  numero:       dados.numero       || '',
  editora:      dados.editora      || '',
  ano:          dados.ano          || '',
  capa_url:     dados.capa_url     || '',
  artistas:     dados.artistas     || '',
  personagens:  dados.personagens  || '',
  url_original: dados.url_original || '',
};
}
