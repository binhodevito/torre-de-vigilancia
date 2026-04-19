// ============================================================
// scraper.js — Busca RESPEITOSA no Guia dos Quadrinhos
//
// FILOSOFIA:
//  - Cada gibi é consultado apenas UMA VEZ
//  - Resultado fica em cache permanente no Google Sheets
//  - Delay obrigatório de 1500ms entre requisições consecutivas
//  - Limite de 10 resultados por busca
//  - Se falhar: cadastro manual sempre disponível
// ============================================================

const PROXY_URL   = 'https://api.allorigins.win/get?url=';
const BASE_GUIA   = 'http://www.guiadosquadrinhos.com';
const BUSCA_GUIA  = `${BASE_GUIA}/busca?p=`;
const DELAY_MS    = 1500;
const MAX_RESULTS = 10;

// Controle de rate limiting
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
async function buscarViProxy(url) {
  await aguardarDelay();
  const proxyUrl  = PROXY_URL + encodeURIComponent(url);
  const resposta  = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!resposta.ok) throw new Error(`Proxy retornou ${resposta.status}`);
  const json = await resposta.json();
  if (!json.contents) throw new Error('Proxy sem conteúdo');
  return json.contents;
}

// ── Normaliza URL de imagem ────────────────────────────────
function normalizarUrlImagem(src) {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  // Algumas URLs começam com // ou /
  if (src.startsWith('//')) return 'http:' + src;
  return BASE_GUIA + (src.startsWith('/') ? '' : '/') + src;
}

// ── Gera ID único a partir da URL da edição ────────────────
function gerarIdGuia(urlEdicao) {
  // Extrai ID numérico da URL (ex: /edicao/123456) ou usa hash da URL
  const match = urlEdicao.match(/\/edicao\/(\d+)/i)
    || urlEdicao.match(/edicao=(\d+)/i)
    || urlEdicao.match(/id=(\d+)/i);
  if (match) return match[1];
  // Fallback: hash simples da URL
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

  // O Guia usa diferentes layouts; tentamos selectors comuns
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

  // Fallback: tenta links que parecem ser de edições
  if (elementos.length === 0) {
    const links = [...doc.querySelectorAll('a[href*="/edicao/"], a[href*="edicao="]')];
    // Pega o container pai de cada link
    const pais = new Set(links.map(l => l.closest('td, li, div.item, div.card, article') || l.parentElement));
    elementos = [...pais].filter(Boolean);
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
  // URL da edição
  const linkEl   = el.querySelector('a[href*="/edicao/"], a[href*="edicao="]') || el.closest('a');
  const urlRel   = linkEl?.getAttribute('href') || '';
  const urlOrig  = urlRel ? (urlRel.startsWith('http') ? urlRel : BASE_GUIA + urlRel) : '';
  const idGuia   = urlOrig ? gerarIdGuia(urlOrig) : '';

  // Capa
  const imgEl   = el.querySelector('img');
  const capaUrl = normalizarUrlImagem(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

  // Texto geral
  const textoCompleto = el.textContent || '';

  // Título — tenta vários selectors
  const tituloEl  = el.querySelector('.titulo, .nome, h2, h3, h4, .edicao-titulo, [class*="titulo"], [class*="nome"]');
  let titulo       = (tituloEl?.textContent || '').trim();
  if (!titulo) {
    // Usa o alt da imagem ou o texto do link
    titulo = imgEl?.getAttribute('alt') || linkEl?.getAttribute('title') || '';
  }
  titulo = titulo.replace(/\s+/g, ' ').trim();

  // Número
  const numMatch = textoCompleto.match(/[Nn][ºo°]\.?\s*(\d+)/) || textoCompleto.match(/#\s*(\d+)/);
  const numero   = numMatch ? numMatch[1] : '';

  // Editora
  const editoraEl = el.querySelector('.editora, [class*="editora"]');
  const editora   = (editoraEl?.textContent || '').trim() || extrairEditora(textoCompleto);

  // Ano
  const anoMatch  = textoCompleto.match(/\b(19|20)\d{2}\b/);
  const ano       = anoMatch ? anoMatch[0] : '';

  // Artistas
  const artistasEl = el.querySelector('.artistas, [class*="artistas"], [class*="autores"]');
  const artistas   = (artistasEl?.textContent || '').trim();

  // Personagens
  const persEl    = el.querySelector('.personagens, [class*="personagens"], [class*="characters"]');
  const personagens = (persEl?.textContent || '').trim();

  return { id_guia: idGuia, titulo, numero, editora, ano, capa_url: capaUrl, artistas, personagens, url_original: urlOrig };
}

// Tenta extrair editora do texto livre
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

  // Capa em tamanho maior
  const capaImg  = doc.querySelector('.capa-edicao img, .capa img, img.capa, img[src*="/capas/"]');
  const capaUrl  = normalizarUrlImagem(capaImg?.getAttribute('src') || '');

  // Artistas
  const artistasEls = [...doc.querySelectorAll('[class*="artista"], .roteirista, .desenhista, .autor, [class*="autor"]')];
  const artistas     = artistasEls.map(e => e.textContent.trim()).filter(Boolean).join(', ');

  // Personagens
  const persEls    = [...doc.querySelectorAll('[class*="personagem"], [class*="character"], .personagens li, .personagens a')];
  const personagens = persEls.map(e => e.textContent.trim()).filter(Boolean).join(', ');

  return { capa_url: capaUrl, artistas, personagens };
}

// ── Função principal de busca ──────────────────────────────
async function buscarGibis(termo) {
  if (!termo || termo.trim().length < 2) return [];

  const url  = BUSCA_GUIA + encodeURIComponent(termo.trim());
  let html;

  try {
    html = await buscarViProxy(url);
  } catch (err) {
    console.warn('Falha no proxy ao buscar:', err.message);
    throw new Error('Não foi possível conectar ao Guia dos Quadrinhos. Verifique sua conexão ou tente novamente.');
  }

  const resultados = parsearResultadosBusca(html);

  // Para cada resultado, verifica cache antes de retornar
  const enriquecidos = await Promise.all(
    resultados.map(async gibi => {
      if (!gibi.id_guia) return gibi;
      // Checa cache no Sheets
      const cached = await apiGetCacheGuia(gibi.id_guia);
      if (cached) return { ...gibi, ...cached, _do_cache: true };
      return gibi;
    })
  );

  return enriquecidos;
}

// ── Busca por URL direta de uma edição ────────────────────
async function buscarGibiPorUrl(url) {
  const cached = await apiGetCacheGuia(gerarIdGuia(url));
  if (cached) return cached;

  const html   = await buscarViProxy(url);
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  // Tenta obter dados da página de detalhe
  const el  = doc.querySelector('body');
  const gibi = parsearElementoGibi(el);
  gibi.url_original = url;
  gibi.id_guia      = gerarIdGuia(url);

  if (gibi.titulo) {
    await apiSalvarCacheGuia(gibi);
  }

  return gibi;
}

// ── Salva resultado no cache após scraping ─────────────────
async function cachearGibi(gibi) {
  if (!gibi || gibi._do_cache) return; // já veio do cache
  await apiSalvarCacheGuia(gibi);
}

// ── Cadastro manual (sem scraping) ────────────────────────
function criarGibiManual(dados) {
  return {
    id_guia:      'manual_' + Date.now().toString(36),
    titulo:       dados.titulo || '',
    numero:       dados.numero || '',
    editora:      dados.editora || '',
    ano:          dados.ano || '',
    capa_url:     dados.capa_url || '',
    artistas:     dados.artistas || '',
    personagens:  dados.personagens || '',
    url_original: dados.url_original || '',
  };
}
