// ============================================================
// app.js — Torre de Vigilância
// ============================================================

'use strict';

const Estado = {
rotaAtual:          'busca',
resultadosBusca:    [],
colecao:            [],
listas:             [],
gibiDetalhe:        null,
listaDetalhe:       null,
filtroColecao:      'todos',
buscaColecao:       '',
ordenacaoColecao:   'data_adicao',
_gibiParaAdicionar: null,
_statusModal:       'lido',
_notaModal:         0,
};

function atualizarEstado(chaves) {
Object.assign(Estado, chaves);
}

// ── Inicialização ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
console.log('[App] DOMContentLoaded - chamando configurarTelaLogin');
configurarTelaLogin();
configurarEventosPerfil();

document.addEventListener('error', e => {
  if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-onerror')) {
    onImagemErro(e.target);
  }
}, true);

ouvirMudancaAuth(async (event, session) => {
  if (event === 'SIGNED_IN') {
    mostrarTelaApp();
    await iniciarApp();
  } else if (event === 'SIGNED_OUT') {
    invalidarCacheLocal();
    mostrarTelaLogin();
  }
  // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY: ignora — sessão continua válida
});

const sessao = await getSessaoAtual();
if (sessao) {
  mostrarTelaApp();
  await iniciarApp();
} else {
  mostrarTelaLogin();
}
});

let _appIniciado = false;

async function iniciarApp() {
if (_appIniciado) {
  // Já inicializado: apenas atualiza sidebar e navega para rota atual
  await atualizarSidebarUsuario();
  return;
}
_appIniciado = true;

configurarNavegacao();
configurarBusca();
configurarFiltrosColecao();
configurarModais();
configurarLogout();

apiGetColecao().then(c => { Estado.colecao = c || []; }).catch(() => {});

await atualizarSidebarUsuario();

const hash = location.hash.replace('#', '') || 'busca';
await navegarPara(hash.split('/')[0], hash.split('/')[1]);
}

async function atualizarSidebarUsuario() {
try {
  const user = await getPerfil();
  const meta = user?.user_metadata || {};
  const nome = meta.nome || meta.username || user?.email?.split('@')[0] || 'Usuário';

  const nomeEl   = document.getElementById('sidebar-nome-usuario');
  const avatarEl = document.getElementById('sidebar-avatar-mini');
  if (nomeEl)   nomeEl.textContent = nome;
  if (avatarEl) {
    const iniciais = obterIniciais(nome);
    if (meta.avatar_url) {
      const img = document.createElement('img');
      img.src   = meta.avatar_url;
      img.alt   = nome;
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover';
      img.onerror = () => { avatarEl.innerHTML = ''; avatarEl.textContent = iniciais; };
      avatarEl.innerHTML = '';
      avatarEl.appendChild(img);
    } else {
      avatarEl.innerHTML = '';
      avatarEl.textContent = iniciais;
    }
  }
} catch (_) {}
}

function obterIniciais(nome) {
return (nome || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

// ── Roteamento ─────────────────────────────────────────────
function configurarNavegacao() {
window.addEventListener('hashchange', async () => {
  const [rota, param] = location.hash.replace('#', '').split('/');
  await navegarPara(rota || 'busca', param);
});

document.addEventListener('click', async e => {
  // Âncoras internas do Sobre — previne hashchange que quebraria o router
  const ancLink = e.target.closest('.sobre-nav-link[data-ancora]');
  if (ancLink) {
    e.preventDefault();
    document.getElementById(ancLink.dataset.ancora)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.sobre-nav-link').forEach(l => l.classList.remove('ativo'));
    ancLink.classList.add('ativo');
    return;
  }

  const link = e.target.closest('.nav-link, .bottom-nav-item');
  if (link) atualizarNavAtivo(link.dataset.rota || '');

  if (e.target.closest('#btn-voltar'))       history.back();
  if (e.target.closest('#btn-voltar-lista')) { await navegarPara('listas'); location.hash = 'listas'; }
});
}

async function navegarPara(rota, param = null) {
document.querySelectorAll('.tela').forEach(t => t.classList.add('oculto'));
Estado.rotaAtual = rota;
atualizarNavAtivo(rota);

switch (rota) {
  case 'busca':
    document.getElementById('tela-busca').classList.remove('oculto');
    break;
  case 'colecao':
    document.getElementById('tela-colecao').classList.remove('oculto');
    await carregarColecao();
    break;
  case 'detalhe':
    document.getElementById('tela-detalhe').classList.remove('oculto');
    if (param) await carregarDetalhe(param);
    break;
  case 'listas':
    document.getElementById('tela-listas').classList.remove('oculto');
    await carregarListas();
    break;
  case 'lista-detalhe':
    document.getElementById('tela-lista-detalhe').classList.remove('oculto');
    if (param) await carregarDetalheLista(param);
    break;
  case 'estatisticas':
    document.getElementById('tela-estatisticas').classList.remove('oculto');
    await carregarEstatisticas();
    break;
  case 'sobre':
    document.getElementById('tela-sobre').classList.remove('oculto');
    break;
  case 'perfil':
    document.getElementById('tela-perfil').classList.remove('oculto');
    await carregarPerfil();
    break;
  default:
    document.getElementById('tela-busca').classList.remove('oculto');
}
}

function atualizarNavAtivo(rota) {
const rotaNav = rota === 'detalhe' ? 'colecao' : rota.startsWith('lista') ? 'listas' : rota;
document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(el => {
  el.classList.toggle('ativo', el.dataset.rota === rotaNav);
});
}

// ── Busca com sugestões ────────────────────────────────────

const MAX_RECENTES  = 6;
const CHAVE_RECENTES = 'torre_buscas_recentes';

function getRecentes() {
try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]'); }
catch (_) { return []; }
}

function salvarRecente(termo) {
if (!termo || termo.length < 2) return;
let recentes = getRecentes().filter(r => r.toLowerCase() !== termo.toLowerCase());
recentes.unshift(termo);
recentes = recentes.slice(0, MAX_RECENTES);
localStorage.setItem(CHAVE_RECENTES, JSON.stringify(recentes));
}

function removerRecente(termo) {
const recentes = getRecentes().filter(r => r.toLowerCase() !== termo.toLowerCase());
localStorage.setItem(CHAVE_RECENTES, JSON.stringify(recentes));
}

function gerarSugestoesDaColecao(query) {
if (!query || query.length < 2) return [];
const q = query.toLowerCase();
const candidatos = new Map();

Estado.colecao.forEach(g => {
  if (g.titulo?.toLowerCase().includes(q))
    candidatos.set(g.titulo, { sub: g.editora || '', tipo: 'titulo' });
  if (g.editora?.toLowerCase().includes(q))
    candidatos.set(g.editora, { sub: 'editora', tipo: 'editora' });
  (g.personagens || '').split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
    if (p.toLowerCase().includes(q))
      candidatos.set(p, { sub: 'personagem', tipo: 'personagem' });
  });
});

return [...candidatos.entries()]
  .slice(0, 6)
  .map(([texto, meta]) => ({ texto, ...meta }));
}

function destacarCoincidia(texto, query) {
const idx = texto.toLowerCase().indexOf(query.toLowerCase());
if (idx === -1) return escHtml(texto);
return escHtml(texto.slice(0, idx))
  + `<mark>${escHtml(texto.slice(idx, idx + query.length))}</mark>`
  + escHtml(texto.slice(idx + query.length));
}

let _indiceSelecionado = -1;

function renderizarDropdown(query) {
const dropdown   = document.getElementById('dropdown-sugestoes');
const elRecentes = document.getElementById('sugestoes-recentes');
const elColecao  = document.getElementById('sugestoes-colecao');
_indiceSelecionado = -1;

const recentes    = getRecentes().filter(r => !query || r.toLowerCase().includes(query.toLowerCase()));
const sugestoesCol = query ? gerarSugestoesDaColecao(query) : [];

if (recentes.length) {
  elRecentes.innerHTML = `<div class="sugestoes-titulo">Buscas recentes</div>`
    + recentes.map(r => `
      <div class="sugestao-item" data-termo="${escHtml(r)}" role="option">
        <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
        <span>${query ? destacarCoincidia(r, query) : escHtml(r)}</span>
        <button class="btn-remover-recente" data-termo="${escHtml(r)}" title="Remover" aria-label="Remover sugestão">×</button>
      </div>`).join('');
} else {
  elRecentes.innerHTML = '';
}

if (sugestoesCol.length) {
  const icones = { titulo: iconeSvg('book'), editora: iconeSvg('tag'), personagem: iconeSvg('user') };
  elColecao.innerHTML = `<div class="sugestoes-titulo">Na sua coleção</div>`
    + sugestoesCol.map(s => `
      <div class="sugestao-item" data-termo="${escHtml(s.texto)}" role="option">
        ${icones[s.tipo] || ''}
        <span>${destacarCoincidia(s.texto, query)}</span>
        <span class="sugestao-subtexto">${escHtml(s.sub)}</span>
      </div>`).join('');
} else {
  elColecao.innerHTML = '';
}

const temConteudo = recentes.length > 0 || sugestoesCol.length > 0;
dropdown.classList.toggle('oculto', !temConteudo);
}

function fecharDropdown() {
document.getElementById('dropdown-sugestoes').classList.add('oculto');
_indiceSelecionado = -1;
}

function iconeSvg(tipo) {
const paths = {
  book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  tag:  '<svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};
return paths[tipo] || '';
}

function navegarDropdown(direcao) {
const itens = [...document.querySelectorAll('#dropdown-sugestoes .sugestao-item')];
if (!itens.length) return;

itens.forEach(el => el.classList.remove('selecionado'));
_indiceSelecionado = Math.max(-1, Math.min(itens.length - 1, _indiceSelecionado + direcao));

if (_indiceSelecionado >= 0) {
  itens[_indiceSelecionado].classList.add('selecionado');
  document.getElementById('input-busca').value = itens[_indiceSelecionado].dataset.termo;
}
}

function configurarBusca() {
const input     = document.getElementById('input-busca');
const btnBuscar = document.getElementById('btn-buscar');
const btnLimpar = document.getElementById('btn-limpar-busca');
let   debounce  = null;

const executarBusca = (termo) => {
  const t = (termo || input.value).trim();
  if (t.length >= 2) {
    fecharDropdown();
    salvarRecente(t);
    realizarBusca(t);
  }
};

btnBuscar.addEventListener('click', () => executarBusca());

input.addEventListener('input', () => {
  const q = input.value.trim();
  btnLimpar.classList.toggle('oculto', q.length === 0);
  clearTimeout(debounce);
  debounce = setTimeout(() => renderizarDropdown(q), 120);
});

input.addEventListener('focus', () => renderizarDropdown(input.value.trim()));

input.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); navegarDropdown(1);  return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); navegarDropdown(-1); return; }
  if (e.key === 'Escape')    { fecharDropdown(); return; }
  if (e.key === 'Enter')     { e.preventDefault(); executarBusca(); }
});

btnLimpar.addEventListener('click', () => {
  input.value = '';
  btnLimpar.classList.add('oculto');
  fecharDropdown();
  input.focus();
});

document.getElementById('dropdown-sugestoes').addEventListener('click', e => {
  const btnRemover = e.target.closest('.btn-remover-recente');
  if (btnRemover) {
    e.stopPropagation();
    removerRecente(btnRemover.dataset.termo);
    renderizarDropdown(input.value.trim());
    return;
  }
  const item = e.target.closest('.sugestao-item');
  if (item) {
    input.value = item.dataset.termo;
    btnLimpar.classList.remove('oculto');
    executarBusca(item.dataset.termo);
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.campo-busca-wrapper')) fecharDropdown();
});
}

async function realizarBusca(termo) {
const container = document.getElementById('resultados-busca');
const statusEl  = document.getElementById('busca-status');

renderSkeletons(container, 10);
statusEl.className   = 'busca-status';
statusEl.classList.remove('oculto');
statusEl.textContent = `Buscando "${termo}" no Guia dos Quadrinhos…`;

try {
  const resultados = await buscarGibis(termo);
  Estado.resultadosBusca = resultados;

  if (resultados.length === 0) {
    container.innerHTML = `
      <div class="busca-vazia">
        <div class="busca-vazia-icone">😕</div>
        <p>Nenhum resultado para "<strong>${escHtml(termo)}</strong>"</p>
        <p class="texto-sec mt-8">Tente outros termos ou
          <button class="btn btn-secundario btn-sm" id="btn-cadastro-manual">cadastre manualmente</button>
        </p>
      </div>`;
    document.getElementById('btn-cadastro-manual')?.addEventListener('click', abrirCadastroManual);
    statusEl.classList.add('oculto');
    return;
  }

  statusEl.textContent = `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''} encontrado${resultados.length !== 1 ? 's' : ''}`;

  // Use the already-loaded collection; refresh in background without blocking
  const colecao = Estado.colecao || [];
  const mapa = new Map(colecao.map(g => [String(g.id_guia), g]));
  container.innerHTML = resultados.map(gibi => {
    const entry = mapa.get(String(gibi.id_guia));
    return renderCardGibi(gibi, { naColecao: !!entry, statusColecao: entry?.status || '', mostrarBtnAdd: true });
  }).join('');

  configurarEventosGrid(container, 'busca');

  // Refresh collection in background and re-render badges if needed
  apiGetColecao().then(colecaoAtual => {
    Estado.colecao = colecaoAtual;
    const mapaAtual = new Map(colecaoAtual.map(g => [String(g.id_guia), g]));
    container.innerHTML = resultados.map(gibi => {
      const entry = mapaAtual.get(String(gibi.id_guia));
      return renderCardGibi(gibi, { naColecao: !!entry, statusColecao: entry?.status || '', mostrarBtnAdd: true });
    }).join('');
    configurarEventosGrid(container, 'busca');
  }).catch(() => {});

} catch (err) {
  statusEl.className   = 'busca-status erro';
  statusEl.textContent = `Erro: ${err.message}`;
  container.innerHTML  = `
    <div class="busca-vazia">
      <div class="busca-vazia-icone">⚠️</div>
      <p>Não foi possível buscar no Guia dos Quadrinhos.</p>
      <p class="texto-sec mt-8">
        <button class="btn btn-secundario btn-sm" id="btn-cadastro-manual-err">Cadastrar manualmente</button>
      </p>
    </div>`;
  document.getElementById('btn-cadastro-manual-err')?.addEventListener('click', abrirCadastroManual);
}
}

// ── Coleção ────────────────────────────────────────────────

function configurarFiltrosColecao() {
document.querySelectorAll('.filtro-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    Estado.filtroColecao = btn.dataset.status;
    renderizarColecao();
  });
});

document.getElementById('busca-colecao')?.addEventListener('input', e => {
  Estado.buscaColecao = e.target.value.toLowerCase();
  renderizarColecao();
});

document.getElementById('ordenacao-colecao')?.addEventListener('change', e => {
  Estado.ordenacaoColecao = e.target.value;
  renderizarColecao();
});
}

async function carregarColecao() {
const container = document.getElementById('grid-colecao');
renderSkeletons(container, 12);
try {
  Estado.colecao = await apiGetColecao(true);
  renderizarColecao();
} catch (err) {
  container.innerHTML = `<div class="colecao-vazia"><p>Erro ao carregar coleção: ${escHtml(err.message)}</p></div>`;
}
}

function renderizarColecao() {
const container = document.getElementById('grid-colecao');
let gibis = [...Estado.colecao];

if (Estado.filtroColecao !== 'todos') {
  if (Estado.filtroColecao === 'fisico') {
    gibis = gibis.filter(g => g.fisico === 'TRUE' || g.fisico === true);
  } else {
    gibis = gibis.filter(g => g.status === Estado.filtroColecao);
  }
}

if (Estado.buscaColecao) {
  const q = Estado.buscaColecao;
  gibis = gibis.filter(g =>
    g.titulo?.toLowerCase().includes(q)      ||
    g.editora?.toLowerCase().includes(q)     ||
    g.artistas?.toLowerCase().includes(q)    ||
    g.personagens?.toLowerCase().includes(q)
  );
}

gibis.sort((a, b) => {
  switch (Estado.ordenacaoColecao) {
    case 'titulo':  return (a.titulo  || '').localeCompare(b.titulo  || '', 'pt-BR');
    case 'nota':    return Number(b.nota || 0)  - Number(a.nota || 0);
    case 'editora': return (a.editora || '').localeCompare(b.editora || '', 'pt-BR');
    case 'ano':     return Number(b.ano || 0)   - Number(a.ano || 0);
    default:        return new Date(b.data_adicao || 0) - new Date(a.data_adicao || 0);
  }
});

if (gibis.length === 0) {
  container.innerHTML = `
    <div class="colecao-vazia">
      <div class="colecao-vazia-icone">${Estado.filtroColecao !== 'todos' ? '🔍' : '📭'}</div>
      <p>${Estado.filtroColecao !== 'todos' ? 'Nenhum gibi neste filtro.' : 'Sua coleção está vazia.<br>Busque gibis e adicione-os!'}</p>
      ${Estado.filtroColecao === 'todos' ? '<a href="#busca" class="btn btn-primario">Buscar gibis</a>' : ''}
    </div>`;
  return;
}

container.innerHTML = gibis.map(g =>
  renderCardGibi(g, { naColecao: true, statusColecao: g.status, mostrarBtnAdd: false })
).join('');

configurarEventosGrid(container, 'colecao');
}

// ── Detalhe do gibi ────────────────────────────────────────

async function carregarDetalhe(idGuia) {
const container = document.getElementById('conteudo-detalhe');
container.innerHTML = '<div class="spinner" style="margin:40px auto;display:block"></div>';

try {
  let gibi = Estado.colecao.find(g => String(g.id_guia) === String(idGuia))
          || Estado.resultadosBusca.find(g => String(g.id_guia) === String(idGuia));

  if (!gibi) {
    const cached = await apiGetCacheGuia(idGuia);
    gibi = cached || { id_guia: idGuia, titulo: 'Gibi não encontrado' };
  }

  Estado.gibiDetalhe = gibi;
  const entry = await apiGibiNaColecao(idGuia);
  container.innerHTML = renderDetalhe(gibi, entry);
  configurarEventosDetalhe(gibi, entry);

} catch (err) {
  container.innerHTML = `<p class="texto-sec">Erro ao carregar: ${escHtml(err.message)}</p>`;
}
}

function configurarEventosDetalhe(gibi, entryInicial) {
document.querySelectorAll('#tela-detalhe .status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tela-detalhe .status-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
  });
});

configurarEstrelas('detalhe-estrelas', Number(entryInicial?.nota || 0));

document.getElementById('btn-salvar-detalhe')?.addEventListener('click', async () => {
  await salvarAlteracoesDetalhe(gibi);
});

document.getElementById('btn-add-detalhe')?.addEventListener('click', () => {
  abrirModalAdicionar(gibi);
});

document.getElementById('btn-remover-colecao')?.addEventListener('click', () => {
  abrirConfirmacao(
    'Remover da coleção',
    `Deseja remover "${gibi.titulo}" da coleção? Esta ação não pode ser desfeita.`,
    async () => {
      try {
        await apiRemoverGibi(gibi.id_guia);
        mostrarToast('Gibi removido da coleção', 'info');
        history.back();
      } catch (err) {
        mostrarToast(`Erro: ${err.message}`, 'erro');
      }
    }
  );
});

document.getElementById('btn-adicionar-lista-detalhe')?.addEventListener('click', async () => {
  await abrirModalAdicionarLista(gibi.id_guia);
});
}

async function salvarAlteracoesDetalhe(gibi) {
const statusBtn = document.querySelector('#tela-detalhe .status-btn.ativo');
const status    = statusBtn?.dataset.status || '';
const fisico    = document.getElementById('detalhe-fisico')?.checked || false;
const nota      = Number(document.getElementById('detalhe-estrelas')?.dataset.nota || 0);
const notas     = document.getElementById('detalhe-notas')?.value || '';
const agora     = new Date().toISOString();

const dados = {
  id_guia: gibi.id_guia, status, fisico, nota, notas_pessoais: notas,
  data_leitura:  status === 'lido' ? agora : '',
  titulo:        gibi.titulo,
  numero:        gibi.numero,
  editora:       gibi.editora,
  ano:           gibi.ano,
  capa_url:      gibi.capa_url,
  artistas:      gibi.artistas,
  url_original:  gibi.url_original,
};

try {
  const naColecao = await apiGibiNaColecao(gibi.id_guia);
  if (naColecao) {
    await apiAtualizarGibi(dados);
  } else {
    await apiAdicionarGibi({ ...dados, data_adicao: agora });
  }
  mostrarToast('Alterações salvas!', 'sucesso');
} catch (err) {
  mostrarToast(`Erro ao salvar: ${err.message}`, 'erro');
}
}

// ── Modal de adicionar ─────────────────────────────────────

function configurarModais() {
configurarEstrelas('modal-estrelas', 0);
}

function abrirModalAdicionar(gibi) {
Estado._gibiParaAdicionar = gibi;

document.getElementById('modal-adicionar-capa').innerHTML = `
  <div class="modal-capa-preview">
    ${gibi.capa_url ? `<img src="${escHtml(gibi.capa_url)}" alt="Capa" />` : ''}
    <div class="modal-capa-preview-info">
      <h3>${escHtml(gibi.titulo)}</h3>
      <p>${escHtml(gibi.editora || '')} ${gibi.numero ? '#' + escHtml(String(gibi.numero)) : ''}</p>
    </div>
  </div>`;

// ✅ FIX 6: remove listeners antigos clonando os botões antes de registrar novos
document.querySelectorAll('#modal-adicionar .status-btn').forEach(btn => {
  const novo = btn.cloneNode(true);
  btn.parentNode.replaceChild(novo, btn);
});

document.querySelectorAll('#modal-adicionar .status-btn').forEach(btn => {
  btn.classList.toggle('ativo', btn.dataset.status === 'lido');
  btn.addEventListener('click', () => {
    document.querySelectorAll('#modal-adicionar .status-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
  });
});

document.getElementById('modal-fisico').checked = false;
document.getElementById('modal-notas').value    = '';

const estrelasEl = document.getElementById('modal-estrelas');
estrelasEl.dataset.nota       = '0';
estrelasEl.dataset.estrelaInit = '';   // ✅ reseta flag para reiniciar listeners de estrelas
estrelasEl.innerHTML          = renderEstrelas(0);
configurarEstrelas('modal-estrelas', 0);

abrirModal('modal-adicionar');
}

document.getElementById('btn-confirmar-adicionar')?.addEventListener('click', async () => {
const gibi = Estado._gibiParaAdicionar;
if (!gibi) return;

const statusBtn = document.querySelector('#modal-adicionar .status-btn.ativo');
const status    = statusBtn?.dataset.status || 'quero_ler';
const fisico    = document.getElementById('modal-fisico')?.checked || false;
const nota      = Number(document.getElementById('modal-estrelas')?.dataset.nota || 0);
const notas     = document.getElementById('modal-notas')?.value || '';
const agora     = new Date().toISOString();

try {
  await apiAdicionarGibi({
    ...gibi, status, fisico, nota, notas_pessoais: notas,
    data_adicao:  agora,
    data_leitura: status === 'lido' ? agora : '',
  });
  await cachearGibi(gibi);

  fecharModal('modal-adicionar');
  mostrarToast(`"${gibi.titulo}" adicionado à coleção!`, 'sucesso');

  const card = document.querySelector(`.card-gibi[data-id="${CSS.escape(String(gibi.id_guia))}"]`);
  if (card) {
    const badge = card.querySelector('.badge-status') || document.createElement('span');
    badge.className   = `badge-status badge-${status}`;
    badge.textContent = labelStatus(status);
    card.prepend(badge);
    const btnAdd = card.querySelector('.card-btn-add');
    if (btnAdd) { btnAdd.textContent = '✓'; btnAdd.classList.add('ja-na-colecao'); }
  }
} catch (err) {
  if (err.message?.includes('já existe')) {
    mostrarToast('Este gibi já está na coleção!', 'info');
    fecharModal('modal-adicionar');
  } else {
    mostrarToast(`Erro: ${err.message}`, 'erro');
  }
}
});

// ── Cadastro manual ────────────────────────────────────────

function abrirCadastroManual() {
const dados = {
  titulo:   prompt('Título do gibi:') || '',
  numero:   prompt('Número da edição:') || '',
  editora:  prompt('Editora:') || '',
  ano:      prompt('Ano:') || '',
  capa_url: prompt('URL da capa (opcional):') || '',
};
if (!dados.titulo) return;
abrirModalAdicionar(criarGibiManual(dados));
}

// ── Adicionar a lista ──────────────────────────────────────

async function abrirModalAdicionarLista(idGuia) {
try {
  const listas = await apiGetListas();
  if (listas.length === 0) { mostrarToast('Crie uma lista primeiro!', 'info'); return; }

  const opcoes = listas.map((l, i) => `${i + 1}. ${l.nome}`).join('\n');
  const idx    = prompt(`Adicionar a qual lista?\n\n${opcoes}\n\nDigite o número:`);
  if (!idx) return;

  const lista = listas[Number(idx) - 1];
  if (!lista) { mostrarToast('Lista inválida', 'erro'); return; }

  await apiAdicionarItemLista(lista.id_lista, idGuia);
  mostrarToast(`Adicionado à lista "${lista.nome}"!`, 'sucesso');
} catch (err) {
  mostrarToast(`Erro: ${err.message}`, 'erro');
}
}

// ── Listas ─────────────────────────────────────────────────

async function carregarListas() {
const container = document.getElementById('grid-listas');
container.innerHTML = '<div class="spinner" style="margin:60px auto;display:block"></div>';
try {
  Estado.listas = await apiGetListas(true);

  if (Estado.listas.length === 0) {
    container.innerHTML = `
      <div class="listas-vazia">
        <div class="listas-vazia-icone">📋</div>
        <p>Nenhuma lista criada ainda.<br>Organize seus gibis em listas temáticas!</p>
      </div>`;
    return;
  }

  container.innerHTML = Estado.listas.map(renderCardLista).join('');
  configurarEventosListas();
} catch (err) {
  container.innerHTML = `<div class="listas-vazia"><p>Erro: ${escHtml(err.message)}</p></div>`;
}
}

function configurarEventosListas() {
document.querySelectorAll('.card-lista').forEach(card => {
  card.addEventListener('click', async e => {
    const acao = e.target.closest('[data-acao]');
    if (acao) {
      e.stopPropagation();
      if (acao.dataset.acao === 'editar')  { editarLista(acao.dataset.id); return; }
      if (acao.dataset.acao === 'excluir') { excluirLista(acao.dataset.id); return; }
    }
    const id = card.dataset.id;
    Estado.listaDetalhe = Estado.listas.find(l => l.id_lista === id);
    location.hash = `lista-detalhe/${id}`;
  });
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') card.click(); });
});
}

async function carregarDetalheLista(idLista) {
const container = document.getElementById('conteudo-lista-detalhe');
container.innerHTML = '<div class="spinner" style="margin:60px auto;display:block"></div>';
try {
  const lista = Estado.listaDetalhe || Estado.listas.find(l => l.id_lista === idLista);
  const itens = await apiGetItensLista(idLista);

  container.innerHTML = `
    <header class="tela-header">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">${lista?.icone || '📚'}</span>
        <h1>${escHtml(lista?.nome || 'Lista')}</h1>
      </div>
      <span class="texto-sec">${itens.length} gibi${itens.length !== 1 ? 's' : ''}</span>
    </header>
    <div class="grid-capas" id="grid-lista-itens">
      ${itens.length === 0
        ? `<div class="busca-vazia"><div class="busca-vazia-icone">📭</div><p>Esta lista está vazia.</p></div>`
        : itens.map(item => item.gibi ? renderCardGibi(item.gibi, { naColecao: true, statusColecao: item.gibi.status, mostrarBtnAdd: false }) : '').join('')
      }
    </div>`;

  if (itens.length > 0) configurarEventosGrid(document.getElementById('grid-lista-itens'), 'colecao');
} catch (err) {
  container.innerHTML = `<p class="texto-sec">Erro: ${escHtml(err.message)}</p>`;
}
}

// ── Modal nova/editar lista ────────────────────────────────

let _listaEditandoId = null;

document.getElementById('btn-nova-lista')?.addEventListener('click', () => {
_listaEditandoId = null;
document.getElementById('modal-lista-titulo').textContent = 'Nova Lista';
document.getElementById('lista-nome').value               = '';
document.getElementById('lista-descricao').value          = '';
document.querySelectorAll('.icone-btn').forEach((b, i) => b.classList.toggle('ativo', i === 0));
document.querySelectorAll('.cor-btn').forEach((b, i) => b.classList.toggle('ativo', i === 0));
abrirModal('modal-lista');
});

function editarLista(id) {
const lista = Estado.listas.find(l => l.id_lista === id);
if (!lista) return;
_listaEditandoId = id;
document.getElementById('modal-lista-titulo').textContent = 'Editar Lista';
document.getElementById('lista-nome').value               = lista.nome;
document.getElementById('lista-descricao').value          = lista.descricao || '';
document.querySelectorAll('.icone-btn').forEach(b => b.classList.toggle('ativo', b.dataset.icone === lista.icone));
document.querySelectorAll('.cor-btn').forEach(b => b.classList.toggle('ativo', b.dataset.cor === lista.cor));
abrirModal('modal-lista');
}

function excluirLista(id) {
const lista = Estado.listas.find(l => l.id_lista === id);
abrirConfirmacao(
  'Excluir lista',
  `Deseja excluir a lista "${lista?.nome}"? Os gibis não serão removidos da coleção.`,
  async () => {
    try {
      await apiRemoverLista(id);
      mostrarToast('Lista excluída', 'info');
      await carregarListas();
    } catch (err) {
      mostrarToast(`Erro: ${err.message}`, 'erro');
    }
  }
);
}

document.querySelectorAll('.icone-btn').forEach(btn => {
btn.addEventListener('click', () => {
  document.querySelectorAll('.icone-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
});
});

document.querySelectorAll('.cor-btn').forEach(btn => {
btn.addEventListener('click', () => {
  document.querySelectorAll('.cor-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
});
});

document.getElementById('btn-salvar-lista')?.addEventListener('click', async () => {
const nome = document.getElementById('lista-nome').value.trim();
if (!nome) { mostrarToast('Digite um nome para a lista', 'erro'); return; }

const icone = document.querySelector('.icone-btn.ativo')?.dataset.icone || '📚';
const cor   = document.querySelector('.cor-btn.ativo')?.dataset.cor     || '#C0392B';
const dados = { nome, descricao: document.getElementById('lista-descricao').value.trim(), icone, cor };

try {
  if (_listaEditandoId) {
    await apiAtualizarLista({ id_lista: _listaEditandoId, ...dados });
    mostrarToast('Lista atualizada!', 'sucesso');
  } else {
    await apiCriarLista(dados);
    mostrarToast('Lista criada!', 'sucesso');
  }
  fecharModal('modal-lista');
  await carregarListas();
} catch (err) {
  mostrarToast(`Erro: ${err.message}`, 'erro');
}
});

// ── Estatísticas ───────────────────────────────────────────

async function carregarEstatisticas() {
const container = document.getElementById('conteudo-stats');
container.innerHTML = '<div class="spinner" style="margin:60px auto;display:block"></div>';
try {
  const stats = await apiGetStats();
  container.innerHTML = renderStats(stats);
} catch (err) {
  container.innerHTML = `<p class="texto-sec">Erro: ${escHtml(err.message)}</p>`;
}
}

// ── Eventos do grid ────────────────────────────────────────

function configurarEventosGrid(container, contexto) {
container.addEventListener('click', async e => {
  const card = e.target.closest('.card-gibi');
  if (!card) return;
  const id = card.dataset.id;

  if (e.target.closest('.card-btn-add')) {
    e.stopPropagation();
    const btn = e.target.closest('.card-btn-add');
    if (btn.classList.contains('ja-na-colecao')) { location.hash = `detalhe/${id}`; return; }
    const gibi = Estado.resultadosBusca.find(g => String(g.id_guia) === String(id))
              || Estado.colecao.find(g => String(g.id_guia) === String(id));
    if (gibi) abrirModalAdicionar(gibi);
    return;
  }

  location.hash = `detalhe/${id}`;
});

container.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = e.target.closest('.card-gibi');
    if (card) { e.preventDefault(); card.click(); }
  }
});
}

// ── Estrelas ───────────────────────────────────────────────

// ✅ FIX 5: listeners registrados apenas uma vez via flag data-estrela-init
function configurarEstrelas(containerId, notaInicial = 0) {
const container = document.getElementById(containerId);
if (!container) return;

// Atualiza nota e visual sem re-registrar listeners
container.dataset.nota = notaInicial;
container.innerHTML    = renderEstrelas(notaInicial);

// Sai se listeners já foram registrados
if (container.dataset.estrelaInit === 'true') return;
container.dataset.estrelaInit = 'true';

container.addEventListener('click', e => {
  const estrela = e.target.closest('.estrela');
  if (!estrela) return;
  const nota = Number(estrela.dataset.valor);
  container.dataset.nota = nota;
  container.innerHTML    = renderEstrelas(nota);
  // ✅ Sem chamar configurarEstrelas recursivamente
});

container.addEventListener('mouseover', e => {
  const estrela = e.target.closest('.estrela');
  if (!estrela) return;
  const val = Number(estrela.dataset.valor);
  container.querySelectorAll('.estrela').forEach((s, i) => {
    s.textContent = i < val / 2 ? '★' : '☆';
    s.classList.toggle('cheia', i < val / 2);
    s.classList.toggle('vazia', i >= val / 2);
  });
});

container.addEventListener('mouseleave', () => {
  container.innerHTML = renderEstrelas(Number(container.dataset.nota));
  // ✅ Sem chamar configurarEstrelas recursivamente
});
}

// ── Exportar (atalho Ctrl+E) ───────────────────────────────
document.addEventListener('keydown', e => {
if (e.ctrlKey && e.key === 'e') {
  e.preventDefault();
  exportarColecaoJSON();
  mostrarToast('Coleção exportada!', 'sucesso');
}
});

// ── Logout (sidebar + perfil) ─────────────────────────────

let _logoutListenerOk = false;

function configurarLogout() {
if (_logoutListenerOk) return;
_logoutListenerOk = true;

async function executarLogout(btn) {
  const textoOriginal = btn?.textContent || '';
  if (btn) { btn.disabled = true; btn.textContent = 'Saindo…'; }
  try {
    await fazerLogout();
    invalidarCacheLocal();
  } catch (err) {
    mostrarToast(`Erro ao sair: ${err.message}`, 'erro');
    if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
  }
}

document.getElementById('btn-logout')?.addEventListener('click', function() {
  executarLogout(this);
});

document.getElementById('btn-logout-perfil')?.addEventListener('click', function() {
  executarLogout(this);
});
}

// ── Perfil ─────────────────────────────────────────────────

async function carregarPerfil() {
try {
  const user = await getPerfil();
  const meta = user?.user_metadata || {};

  document.getElementById('perfil-nome').value              = meta.nome       || '';
  document.getElementById('perfil-username').value          = meta.username   || '';
  document.getElementById('perfil-avatar-url').value        = meta.avatar_url || '';
  document.getElementById('perfil-email-atual').textContent = user?.email     || '—';
  document.getElementById('perfil-email-erro').textContent  = '';
  document.getElementById('perfil-senha-erro').textContent  = '';

  atualizarAvatarPerfil(meta.avatar_url || '', meta.nome || user?.email || 'U');
} catch (err) {
  mostrarToast(`Erro ao carregar perfil: ${err.message}`, 'erro');
}
}

function atualizarAvatarPerfil(url, nomeRef) {
const el = document.getElementById('perfil-avatar-preview');
if (!el) return;
const iniciais = obterIniciais(nomeRef);
if (url) {
  const img = document.createElement('img');
  img.src   = url;
  img.alt   = 'Avatar';
  img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover';
  img.onerror = () => { el.innerHTML = ''; el.textContent = iniciais; };
  el.innerHTML = '';
  el.appendChild(img);
} else {
  el.innerHTML = '';
  el.textContent = iniciais;
}
}

function configurarEventosPerfil() {
// Preview do avatar ao digitar URL
document.getElementById('perfil-avatar-url')?.addEventListener('input', e => {
  const url  = e.target.value.trim();
  const nome = document.getElementById('perfil-nome').value || 'U';
  atualizarAvatarPerfil(url, nome);
});

// Salvar dados básicos
document.getElementById('btn-salvar-perfil')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-salvar-perfil');
  const dados = {
    nome:       document.getElementById('perfil-nome').value.trim(),
    username:   document.getElementById('perfil-username').value.trim().replace(/^@/, ''),
    avatar_url: document.getElementById('perfil-avatar-url').value.trim(),
  };
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Tente novamente.')), 10000));
    await Promise.race([atualizarPerfil(dados), timeout]);
    atualizarSidebarUsuario().catch(() => {});
    atualizarAvatarPerfil(dados.avatar_url, dados.nome || 'U');
    btn.textContent = 'Salvo!';
    setTimeout(() => { btn.textContent = 'Salvar informações'; }, 2000);
    mostrarToast('Perfil atualizado!', 'sucesso');
  } catch (err) {
    mostrarToast(`Erro: ${err.message}`, 'erro');
    btn.textContent = 'Salvar informações';
  } finally {
    btn.disabled = false;
  }
});

// Alterar e-mail
document.getElementById('btn-alterar-email')?.addEventListener('click', async () => {
  const btn    = document.getElementById('btn-alterar-email');
  const email  = document.getElementById('perfil-novo-email').value.trim();
  const erroEl = document.getElementById('perfil-email-erro');
  if (!email) { erroEl.textContent = 'Informe o novo e-mail.'; return; }
  btn.disabled = true; btn.textContent = 'Enviando…'; erroEl.textContent = '';
  try {
    await atualizarEmail(email);
    erroEl.style.color  = 'var(--lido)';
    erroEl.textContent  = 'Confirmação enviada para o novo e-mail. Verifique sua caixa de entrada.';
    document.getElementById('perfil-novo-email').value = '';
  } catch (err) {
    erroEl.style.color = ''; erroEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Alterar e-mail';
  }
});

// Alterar senha
document.getElementById('btn-alterar-senha')?.addEventListener('click', async () => {
  const btn     = document.getElementById('btn-alterar-senha');
  const nova    = document.getElementById('perfil-nova-senha').value;
  const confirma = document.getElementById('perfil-confirmar-senha').value;
  const erroEl  = document.getElementById('perfil-senha-erro');
  erroEl.textContent = ''; erroEl.style.color = '';
  if (!nova || nova.length < 6) { erroEl.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
  if (nova !== confirma) { erroEl.textContent = 'As senhas não coincidem.'; return; }
  btn.disabled = true; btn.textContent = 'Alterando…';
  try {
    await atualizarSenhaPerfil(nova);
    document.getElementById('perfil-nova-senha').value    = '';
    document.getElementById('perfil-confirmar-senha').value = '';
    erroEl.style.color = 'var(--lido)';
    erroEl.textContent = 'Senha alterada com sucesso!';
  } catch (err) {
    erroEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Alterar senha';
  }
});

// Exportar
document.getElementById('btn-exportar-colecao-perfil')?.addEventListener('click', () => {
  exportarColecaoJSON();
  mostrarToast('Coleção exportada!', 'sucesso');
});

// Importar
document.getElementById('btn-importar-colecao-perfil')?.addEventListener('click', () => {
  document.getElementById('input-importar-json')?.click();
});

document.getElementById('input-importar-json')?.addEventListener('change', async e => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;
  const btn = document.getElementById('btn-importar-colecao-perfil');
  btn.disabled = true; btn.textContent = 'Importando…';
  try {
    const resultado = await importarColecaoJSON(arquivo);
    mostrarToast(`${resultado.importados} gibi(s) importado(s)!`, 'sucesso');
    Estado.colecao = await apiGetColecao(true);
  } catch (err) {
    mostrarToast(`Erro na importação: ${err.message}`, 'erro');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importar JSON`;
    e.target.value = '';
  }
});

// Desativar conta
document.getElementById('btn-desativar-conta')?.addEventListener('click', () => {
  abrirConfirmacao(
    'Desativar conta',
    'Tem certeza? Você será desconectado imediatamente. Para reativar, entre em contato com o desenvolvedor.',
    async () => {
      try {
        await desativarConta();
        invalidarCacheLocal();
      } catch (err) {
        mostrarToast(`Erro: ${err.message}`, 'erro');
      }
    }
  );
});
}