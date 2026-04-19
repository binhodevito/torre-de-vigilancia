// ============================================================
// ui.js — Torre de Vigilância — Renderização de componentes visuais
// ============================================================

// ── Toast notifications ────────────────────────────────────

const _toastsContainer = () => document.getElementById('toasts');

function mostrarToast(mensagem, tipo = 'info', duracao = 3000) {
  const container = _toastsContainer();
  const toast     = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('saindo');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duracao);
}

// ── Skeletons de loading ───────────────────────────────────

function renderSkeletons(container, quantidade = 10) {
  container.innerHTML = Array.from({ length: quantidade }, () => `
    <div class="skeleton-card">
      <div class="skeleton-capa"></div>
      <div class="skeleton-linha"></div>
      <div class="skeleton-linha curta"></div>
    </div>
  `).join('');
}

// ── Card de gibi ───────────────────────────────────────────

function renderCardGibi(gibi, opcoes = {}) {
  const { naColecao = false, statusColecao = '', mostrarBtnAdd = true } = opcoes;

  const badge = naColecao
    ? `<span class="badge-status badge-${statusColecao}">${labelStatus(statusColecao)}</span>`
    : '';

  const btnAdd = mostrarBtnAdd ? `
    <button
      class="card-btn-add ${naColecao ? 'ja-na-colecao' : ''}"
      data-id="${gibi.id_guia}"
      title="${naColecao ? 'Editar gibi' : 'Adicionar à coleção'}"
      aria-label="${naColecao ? 'Editar' : 'Adicionar'}"
    >${naColecao ? '✓' : '+'}</button>
  ` : '';

  const capaHtml = gibi.capa_url
    ? `<img
        class="card-capa"
        src="${escHtml(gibi.capa_url)}"
        alt="Capa de ${escHtml(gibi.titulo)}"
        loading="lazy"
        onerror="this.parentElement.innerHTML=placeholderCapa()"
      />`
    : `<div class="card-capa-placeholder">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        <span>Sem capa</span>
      </div>`;

  return `
    <div
      class="card-gibi"
      data-id="${escHtml(gibi.id_guia)}"
      data-titulo="${escHtml(gibi.titulo)}"
      role="button"
      tabindex="0"
      aria-label="${escHtml(gibi.titulo)} ${gibi.numero ? '#' + gibi.numero : ''}"
    >
      ${badge}
      ${capaHtml}
      <div class="card-info">
        <div class="card-titulo">${escHtml(gibi.titulo)}</div>
        <div class="card-meta">
          ${gibi.numero ? `<span class="card-numero">#${escHtml(String(gibi.numero))}</span> · ` : ''}
          ${escHtml(gibi.editora || '')}
          ${gibi.ano ? ` · ${escHtml(String(gibi.ano))}` : ''}
        </div>
      </div>
      ${btnAdd}
    </div>
  `;
}

// Placeholder inline para imagens que falharam
function placeholderCapa() {
  return `<div class="card-capa-placeholder">
    <svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#6b6e8a;fill:none;stroke-width:2;stroke-linecap:round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
    </svg>
    <span style="font-size:11px;color:#6b6e8a">Sem capa</span>
  </div>`;
}

// ── Tela de detalhe ────────────────────────────────────────

function renderDetalhe(gibi, colecaoEntry = null) {
  const status      = colecaoEntry?.status || '';
  const fisico      = colecaoEntry?.fisico === 'TRUE' || colecaoEntry?.fisico === true;
  const nota        = Number(colecaoEntry?.nota || 0);
  const notasPess   = colecaoEntry?.notas_pessoais || '';
  const naColecao   = !!colecaoEntry;

  const statusOpcoes = [
    { valor: 'quero_ler', label: '📖 Quero Ler' },
    { valor: 'lendo',     label: '📌 Lendo' },
    { valor: 'lido',      label: '✅ Lido' },
  ];

  const artistas    = gibi.artistas    ? gibi.artistas.split(',').map(s => s.trim()).filter(Boolean) : [];
  const personagens = gibi.personagens ? gibi.personagens.split(',').map(s => s.trim()).filter(Boolean) : [];

  return `
    <div class="detalhe-container">
      <div class="detalhe-capa-col">
        ${gibi.capa_url
          ? `<img class="detalhe-capa" src="${escHtml(gibi.capa_url)}" alt="Capa de ${escHtml(gibi.titulo)}" />`
          : `<div class="card-capa-placeholder" style="aspect-ratio:2/3;border-radius:12px;background:#1a1a2e">
              <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:#6b6e8a;fill:none;stroke-width:2;stroke-linecap:round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
            </div>`
        }
      </div>

      <div class="detalhe-info">
        <h1>${escHtml(gibi.titulo)}</h1>

        <div class="detalhe-meta">
          ${gibi.numero   ? `<span class="detalhe-meta-item"><strong>#${escHtml(String(gibi.numero))}</strong></span>` : ''}
          ${gibi.editora  ? `<span class="detalhe-meta-item">${escHtml(gibi.editora)}</span>` : ''}
          ${gibi.ano      ? `<span class="detalhe-meta-item">${escHtml(String(gibi.ano))}</span>` : ''}
        </div>

        ${artistas.length ? `
          <div class="detalhe-secao">
            <h3>Artistas</h3>
            <div class="tags">${artistas.map(a => `<span class="tag">${escHtml(a)}</span>`).join('')}</div>
          </div>` : ''}

        ${personagens.length ? `
          <div class="detalhe-secao">
            <h3>Personagens</h3>
            <div class="tags">${personagens.map(p => `<span class="tag">${escHtml(p)}</span>`).join('')}</div>
          </div>` : ''}

        <div class="detalhe-secao">
          <h3>Status de leitura</h3>
          <div class="status-botoes">
            ${statusOpcoes.map(op => `
              <button
                class="status-btn ${status === op.valor ? 'ativo' : ''}"
                data-status="${op.valor}"
              >${op.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="detalhe-secao">
          <label class="toggle-label">
            <input type="checkbox" id="detalhe-fisico" ${fisico ? 'checked' : ''} />
            <span class="toggle-slider"></span>
            Tenho o físico
          </label>
        </div>

        <div class="detalhe-secao">
          <h3>Avaliação</h3>
          <div class="estrelas" id="detalhe-estrelas" data-nota="${nota}">
            ${renderEstrelas(nota)}
          </div>
        </div>

        <div class="detalhe-secao">
          <h3>Notas pessoais</h3>
          <textarea id="detalhe-notas" placeholder="Suas impressões sobre o gibi...">${escHtml(notasPess)}</textarea>
        </div>

        <div class="detalhe-acoes">
          ${naColecao
            ? `<button class="btn btn-primario" id="btn-salvar-detalhe">Salvar alterações</button>
               <button class="btn btn-secundario" id="btn-adicionar-lista-detalhe">+ Adicionar a lista</button>
               <button class="btn btn-perigo" id="btn-remover-colecao">Remover da coleção</button>`
            : `<button class="btn btn-primario" id="btn-add-detalhe">+ Adicionar à coleção</button>`
          }
          ${gibi.url_original
            ? `<a class="btn btn-secundario" href="${escHtml(gibi.url_original)}" target="_blank" rel="noopener">
                Ver no Guia dos Quadrinhos
              </a>`
            : ''}
        </div>
      </div>
    </div>
  `;
}

// ── Estrelas ───────────────────────────────────────────────

function renderEstrelas(notaAtual = 0) {
  // 5 estrelas = internamente 1–10 (cada estrela = 2 pontos)
  const estrelasCheias = Math.round(notaAtual / 2);
  return Array.from({ length: 5 }, (_, i) => `
    <span
      class="estrela ${i < estrelasCheias ? 'cheia' : 'vazia'}"
      data-valor="${(i + 1) * 2}"
      title="${(i + 1) * 2}/10"
      role="button"
      tabindex="0"
      aria-label="${i + 1} estrela${i > 0 ? 's' : ''}"
    >${i < estrelasCheias ? '★' : '☆'}</span>
  `).join('');
}

// ── Cards de lista ─────────────────────────────────────────

function renderCardLista(lista) {
  return `
    <div class="card-lista" data-id="${escHtml(lista.id_lista)}" role="button" tabindex="0">
      <div class="card-lista-acoes">
        <button class="btn-acao-mini" data-acao="editar" data-id="${escHtml(lista.id_lista)}" title="Editar lista">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-acao-mini perigo" data-acao="excluir" data-id="${escHtml(lista.id_lista)}" title="Excluir lista">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
      <div class="card-lista-topo">
        <div class="card-lista-icone" style="background:${escHtml(lista.cor || '#ff6b35')}22">
          ${lista.icone || '📚'}
        </div>
        <div>
          <div class="card-lista-nome">${escHtml(lista.nome)}</div>
          <div class="card-lista-meta">${lista.total || 0} gibi${lista.total !== 1 ? 's' : ''}</div>
        </div>
      </div>
      ${lista.descricao ? `<div class="card-lista-descricao">${escHtml(lista.descricao)}</div>` : ''}
    </div>
  `;
}

// ── Estatísticas ───────────────────────────────────────────

function renderStats(stats) {
  const {
    total, lidos, lendo, quereLer, fisicos,
    mediaNota, melhor, editorasOrdenadas, lidosPorAno
  } = stats;

  return `
    <div class="stats-numeros">
      <div class="stat-card">
        <div class="stat-numero texto-acento">${total}</div>
        <div class="stat-rotulo">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-numero" style="color:var(--lido)">${lidos}</div>
        <div class="stat-rotulo">Lidos</div>
      </div>
      <div class="stat-card">
        <div class="stat-numero" style="color:var(--lendo)">${lendo}</div>
        <div class="stat-rotulo">Lendo</div>
      </div>
      <div class="stat-card">
        <div class="stat-numero" style="color:var(--quero-ler)">${quereLer}</div>
        <div class="stat-rotulo">Quero Ler</div>
      </div>
      <div class="stat-card">
        <div class="stat-numero" style="color:var(--fisico)">${fisicos}</div>
        <div class="stat-rotulo">Físicos</div>
      </div>
      <div class="stat-card">
        <div class="stat-numero texto-acento">${mediaNota || '–'}</div>
        <div class="stat-rotulo">Nota média</div>
      </div>
    </div>

    ${melhor ? `
      <div class="melhor-gibi">
        ${melhor.capa_url ? `<img src="${escHtml(melhor.capa_url)}" alt="Capa" />` : ''}
        <div class="melhor-gibi-info">
          <div class="texto-sec" style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Melhor avaliado</div>
          <h3>${escHtml(melhor.titulo)}</h3>
          <div class="texto-sec">${escHtml(melhor.editora || '')} ${melhor.ano || ''}</div>
          <div class="melhor-gibi-nota">${renderEstrelas(Number(melhor.nota))}</div>
        </div>
      </div>
    ` : ''}

    <div class="stats-graficos">
      <div class="grafico-card">
        <div class="grafico-titulo">Gibis por editora (top 10)</div>
        ${renderGraficoBarras(editorasOrdenadas, 'nome', 'count', 'var(--acento)')}
      </div>
      <div class="grafico-card">
        <div class="grafico-titulo">Lidos por ano</div>
        ${renderGraficoBarras(lidosPorAno, 'ano', 'count', 'var(--lendo)')}
      </div>
    </div>
  `;
}

// Gráfico de barras horizontais em SVG puro
function renderGraficoBarras(dados, campoLabel, campoValor, cor = 'var(--acento)') {
  if (!dados || dados.length === 0) {
    return '<p class="texto-dim" style="font-size:14px">Sem dados ainda</p>';
  }

  const alturaLinha = 32;
  const margEsq     = 110;
  const largTotal   = 320;
  const largBarra   = largTotal - margEsq - 40;
  const maximo      = Math.max(...dados.map(d => Number(d[campoValor])));
  const altura      = dados.length * alturaLinha + 20;

  const barras = dados.map((d, i) => {
    const val   = Number(d[campoValor]);
    const w     = maximo > 0 ? (val / maximo) * largBarra : 0;
    const y     = i * alturaLinha + 10;
    const label = String(d[campoLabel]).slice(0, 14);

    return `
      <text class="barra-label" x="${margEsq - 8}" y="${y + 16}" text-anchor="end">${escHtml(label)}</text>
      <rect x="${margEsq}" y="${y + 4}" width="${w}" height="20" rx="4" fill="${cor}" opacity=".85"/>
      <text class="barra-valor" x="${margEsq + w + 6}" y="${y + 17}">${val}</text>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${largTotal} ${altura}" style="width:100%;overflow:visible">
      ${barras}
    </svg>
  `;
}

// ── Helpers gerais ─────────────────────────────────────────

function labelStatus(status) {
  const mapa = {
    quero_ler:       'Quero ler',
    lendo:           'Lendo',
    lido:            'Lido',
    colecao_fisica:  'Físico',
  };
  return mapa[status] || status;
}

// Escapa HTML para prevenir XSS
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Modal genérico de confirmação ─────────────────────────

function abrirConfirmacao(titulo, texto, callbackConfirmar) {
  document.getElementById('confirmacao-titulo').textContent = titulo;
  document.getElementById('confirmacao-texto').textContent  = texto;
  document.getElementById('btn-confirmar-acao').onclick     = () => {
    fecharModal('modal-confirmacao');
    callbackConfirmar();
  };
  abrirModal('modal-confirmacao');
}

// ── Controle de modais ─────────────────────────────────────

function abrirModal(id) {
  document.getElementById(id)?.classList.remove('oculto');
  document.body.style.overflow = 'hidden';
}

function fecharModal(id) {
  document.getElementById(id)?.classList.add('oculto');
  document.body.style.overflow = '';
}

// Fecha modal ao clicar no overlay (fora do conteúdo)
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    fecharModal(e.target.id);
  }
  // Botões de fechar/cancelar com data-modal
  const alvo = e.target.closest('[data-modal]');
  if (alvo) fecharModal(alvo.dataset.modal);
});

// Fecha modal com Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.oculto)').forEach(m => fecharModal(m.id));
  }
});
