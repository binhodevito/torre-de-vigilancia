// ============================================================
// Pilha de Leitura — Google Apps Script (backend gratuito)
// Cole este código em Extensões → Apps Script da sua planilha
// ============================================================

const PLANILHA_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// Nomes das abas
const ABA_COLECAO    = 'Colecao';
const ABA_LISTAS     = 'Listas';
const ABA_LISTA_ITENS = 'ListaItens';
const ABA_CACHE      = 'Cache';

// Cabeçalhos esperados por aba
const CABECALHO_COLECAO = [
  'id_guia','titulo','numero','editora','ano','capa_url',
  'artistas','personagens','url_original','status','nota',
  'data_adicao','data_leitura','notas_pessoais','fisico'
];
const CABECALHO_LISTAS = ['id_lista','nome','descricao','cor','icone','data_criacao'];
const CABECALHO_LISTA_ITENS = ['id_lista','id_guia','ordem','data_adicao'];
const CABECALHO_CACHE = [
  'id_guia','titulo','numero','editora','ano','capa_url',
  'artistas','personagens','url_original','data_cache'
];

// ── Ponto de entrada HTTP GET ──────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

// ── Ponto de entrada HTTP POST ─────────────────────────────
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter || {};
  const body   = parseBody(e);
  const acao   = params.acao || body.acao || '';

  let resultado;
  try {
    switch (acao) {
      // Coleção
      case 'getCollection':      resultado = getCollection();              break;
      case 'addComic':           resultado = addComic(body);               break;
      case 'updateComic':        resultado = updateComic(body);            break;
      case 'deleteComic':        resultado = deleteComic(body.id_guia);   break;
      // Listas
      case 'getLists':           resultado = getLists();                   break;
      case 'addList':            resultado = addList(body);                break;
      case 'updateList':         resultado = updateList(body);             break;
      case 'deleteList':         resultado = deleteList(body.id_lista);   break;
      case 'getListItems':       resultado = getListItems(body.id_lista); break;
      case 'addListItem':        resultado = addListItem(body);            break;
      case 'removeListItem':     resultado = removeListItem(body);         break;
      // Cache do Guia
      case 'getCachedComic':     resultado = getCachedComic(body.id_guia || params.id_guia); break;
      case 'saveCachedComic':    resultado = saveCachedComic(body);        break;
      // Stats
      case 'getStats':           resultado = getStats();                   break;
      // Setup inicial
      case 'setup':              resultado = setupPlanilha();              break;
      default:
        resultado = { success: false, error: 'Ação desconhecida: ' + acao };
    }
  } catch (err) {
    resultado = { success: false, error: err.message };
  }

  return buildResponse(resultado);
}

// ── Helpers ────────────────────────────────────────────────

function parseBody(e) {
  if (!e.postData) return {};
  try { return JSON.parse(e.postData.contents); }
  catch (_) { return {}; }
}

function buildResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getAba(nome) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(nome);
  if (!aba) throw new Error('Aba não encontrada: ' + nome);
  return aba;
}

// Converte linhas da planilha em array de objetos usando o cabeçalho
function linhasParaObjetos(aba, cabecalho) {
  const dados = aba.getDataRange().getValues();
  if (dados.length <= 1) return [];
  return dados.slice(1).map(linha => {
    const obj = {};
    cabecalho.forEach((col, i) => { obj[col] = linha[i] ?? ''; });
    return obj;
  });
}

// Encontra linha pelo valor de uma coluna
function encontrarLinha(aba, colIndex, valor) {
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][colIndex]) === String(valor)) return i + 1; // linha 1-based
  }
  return -1;
}

// Gera ID único simples
function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── COLEÇÃO ────────────────────────────────────────────────

function getCollection() {
  const aba   = getAba(ABA_COLECAO);
  const itens = linhasParaObjetos(aba, CABECALHO_COLECAO);
  return { success: true, data: itens };
}

function addComic(dados) {
  const aba = getAba(ABA_COLECAO);

  // Verifica duplicata
  const existente = encontrarLinha(aba, 0, dados.id_guia);
  if (existente !== -1) {
    return { success: false, error: 'Gibi já existe na coleção', existing: true };
  }

  const agora = new Date().toISOString();
  const linha = CABECALHO_COLECAO.map(col => {
    if (col === 'data_adicao') return agora;
    if (col === 'fisico') return dados[col] === true || dados[col] === 'true' ? 'TRUE' : 'FALSE';
    return dados[col] ?? '';
  });

  aba.appendRow(linha);
  return { success: true, data: { id_guia: dados.id_guia } };
}

function updateComic(dados) {
  const aba     = getAba(ABA_COLECAO);
  const linhaNum = encontrarLinha(aba, 0, dados.id_guia);
  if (linhaNum === -1) return { success: false, error: 'Gibi não encontrado' };

  const linhaAtual = aba.getRange(linhaNum, 1, 1, CABECALHO_COLECAO.length).getValues()[0];
  const novaLinha  = CABECALHO_COLECAO.map((col, i) => {
    if (col === 'fisico') return dados[col] === true || dados[col] === 'true' ? 'TRUE' : 'FALSE';
    return dados[col] !== undefined ? dados[col] : linhaAtual[i];
  });

  aba.getRange(linhaNum, 1, 1, novaLinha.length).setValues([novaLinha]);
  return { success: true };
}

function deleteComic(idGuia) {
  const aba     = getAba(ABA_COLECAO);
  const linhaNum = encontrarLinha(aba, 0, idGuia);
  if (linhaNum === -1) return { success: false, error: 'Gibi não encontrado' };
  aba.deleteRow(linhaNum);
  return { success: true };
}

// ── LISTAS ─────────────────────────────────────────────────

function getLists() {
  const abaListas = getAba(ABA_LISTAS);
  const abaItens  = getAba(ABA_LISTA_ITENS);
  const listas    = linhasParaObjetos(abaListas, CABECALHO_LISTAS);
  const itens     = linhasParaObjetos(abaItens, CABECALHO_LISTA_ITENS);

  // Conta itens por lista
  listas.forEach(lista => {
    lista.total = itens.filter(i => i.id_lista === lista.id_lista).length;
  });

  return { success: true, data: listas };
}

function addList(dados) {
  const aba  = getAba(ABA_LISTAS);
  const id   = gerarId();
  const agora = new Date().toISOString();
  const linha = [id, dados.nome || '', dados.descricao || '', dados.cor || '#ff6b35', dados.icone || '📚', agora];
  aba.appendRow(linha);
  return { success: true, data: { id_lista: id } };
}

function updateList(dados) {
  const aba     = getAba(ABA_LISTAS);
  const linhaNum = encontrarLinha(aba, 0, dados.id_lista);
  if (linhaNum === -1) return { success: false, error: 'Lista não encontrada' };

  const linhaAtual = aba.getRange(linhaNum, 1, 1, CABECALHO_LISTAS.length).getValues()[0];
  const novaLinha  = CABECALHO_LISTAS.map((col, i) => dados[col] !== undefined ? dados[col] : linhaAtual[i]);
  aba.getRange(linhaNum, 1, 1, novaLinha.length).setValues([novaLinha]);
  return { success: true };
}

function deleteList(idLista) {
  const aba     = getAba(ABA_LISTAS);
  const linhaNum = encontrarLinha(aba, 0, idLista);
  if (linhaNum === -1) return { success: false, error: 'Lista não encontrada' };
  aba.deleteRow(linhaNum);

  // Remove todos os itens da lista
  const abaItens = getAba(ABA_LISTA_ITENS);
  const dados    = abaItens.getDataRange().getValues();
  // Percorre de baixo pra cima para não perder índice ao deletar
  for (let i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][0]) === String(idLista)) abaItens.deleteRow(i + 1);
  }
  return { success: true };
}

function getListItems(idLista) {
  const abaItens = getAba(ABA_LISTA_ITENS);
  const itens    = linhasParaObjetos(abaItens, CABECALHO_LISTA_ITENS)
    .filter(i => i.id_lista === idLista)
    .sort((a, b) => Number(a.ordem) - Number(b.ordem));

  // Busca dados completos dos gibis
  const abaCol = getAba(ABA_COLECAO);
  const colecao = linhasParaObjetos(abaCol, CABECALHO_COLECAO);
  const mapa    = {};
  colecao.forEach(g => { mapa[g.id_guia] = g; });

  const resultado = itens.map(item => ({
    ...item,
    gibi: mapa[item.id_guia] || null
  }));

  return { success: true, data: resultado };
}

function addListItem(dados) {
  const aba   = getAba(ABA_LISTA_ITENS);
  const agora = new Date().toISOString();

  // Verifica duplicata
  const itens = linhasParaObjetos(aba, CABECALHO_LISTA_ITENS);
  const existe = itens.find(i => i.id_lista === dados.id_lista && i.id_guia === dados.id_guia);
  if (existe) return { success: false, error: 'Gibi já está nesta lista', existing: true };

  const ordem = itens.filter(i => i.id_lista === dados.id_lista).length + 1;
  aba.appendRow([dados.id_lista, dados.id_guia, ordem, agora]);
  return { success: true };
}

function removeListItem(dados) {
  const aba   = getAba(ABA_LISTA_ITENS);
  const linhas = aba.getDataRange().getValues();
  for (let i = linhas.length - 1; i >= 1; i--) {
    if (String(linhas[i][0]) === String(dados.id_lista) && String(linhas[i][1]) === String(dados.id_guia)) {
      aba.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Item não encontrado na lista' };
}

// ── CACHE DO GUIA ──────────────────────────────────────────

function getCachedComic(idGuia) {
  if (!idGuia) return { success: false, error: 'id_guia obrigatório' };
  const aba   = getAba(ABA_CACHE);
  const itens = linhasParaObjetos(aba, CABECALHO_CACHE);
  const found = itens.find(i => String(i.id_guia) === String(idGuia));
  return found ? { success: true, data: found } : { success: false, data: null };
}

function saveCachedComic(dados) {
  const aba = getAba(ABA_CACHE);

  // Não duplica
  const linhaNum = encontrarLinha(aba, 0, dados.id_guia);
  if (linhaNum !== -1) return { success: true, cached: true };

  const agora = new Date().toISOString();
  const linha = CABECALHO_CACHE.map(col => {
    if (col === 'data_cache') return agora;
    return dados[col] ?? '';
  });
  aba.appendRow(linha);
  return { success: true };
}

// ── ESTATÍSTICAS ───────────────────────────────────────────

function getStats() {
  const aba    = getAba(ABA_COLECAO);
  const gibis  = linhasParaObjetos(aba, CABECALHO_COLECAO);

  const total     = gibis.length;
  const lidos     = gibis.filter(g => g.status === 'lido').length;
  const lendo     = gibis.filter(g => g.status === 'lendo').length;
  const quereLer  = gibis.filter(g => g.status === 'quero_ler').length;
  const fisicos   = gibis.filter(g => g.fisico === 'TRUE' || g.fisico === true).length;

  // Notas
  const comNota = gibis.filter(g => g.nota && Number(g.nota) > 0);
  const mediaNota = comNota.length
    ? (comNota.reduce((s, g) => s + Number(g.nota), 0) / comNota.length).toFixed(1)
    : 0;

  // Melhor avaliado
  const melhor = comNota.sort((a, b) => Number(b.nota) - Number(a.nota))[0] || null;

  // Por editora
  const porEditora = {};
  gibis.forEach(g => {
    const ed = g.editora || 'Desconhecida';
    porEditora[ed] = (porEditora[ed] || 0) + 1;
  });
  const editorasOrdenadas = Object.entries(porEditora)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, count]) => ({ nome, count }));

  // Lidos por ano de leitura
  const porAno = {};
  gibis.filter(g => g.status === 'lido' && g.data_leitura).forEach(g => {
    const ano = new Date(g.data_leitura).getFullYear();
    if (!isNaN(ano)) porAno[ano] = (porAno[ano] || 0) + 1;
  });
  const lidosPorAno = Object.entries(porAno)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([ano, count]) => ({ ano: Number(ano), count }));

  return {
    success: true,
    data: { total, lidos, lendo, quereLer, fisicos, mediaNota, melhor, editorasOrdenadas, lidosPorAno }
  };
}

// ── SETUP INICIAL ──────────────────────────────────────────

function setupPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function criarAba(nome, cabecalho) {
    let aba = ss.getSheetByName(nome);
    if (!aba) {
      aba = ss.insertSheet(nome);
    }
    // Só escreve cabeçalho se estiver vazia
    if (aba.getLastRow() === 0) {
      aba.appendRow(cabecalho);
      aba.getRange(1, 1, 1, cabecalho.length).setFontWeight('bold');
    }
  }

  criarAba(ABA_COLECAO,    CABECALHO_COLECAO);
  criarAba(ABA_LISTAS,     CABECALHO_LISTAS);
  criarAba(ABA_LISTA_ITENS, CABECALHO_LISTA_ITENS);
  criarAba(ABA_CACHE,      CABECALHO_CACHE);

  return { success: true, message: 'Planilha configurada com sucesso!' };
}
