// ============================================================
// auth.js — Torre de Vigilância — Autenticação via Supabase
// ============================================================

'use strict';

async function fazerLogin(email, senha) {
const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
if (error) throw new Error(traduzirErroAuth(error.message));
return data;
}

async function fazerCadastro(email, senha) {
const { data, error } = await db.auth.signUp({ email, password: senha });
if (error) throw new Error(traduzirErroAuth(error.message));
return data;
}

async function enviarMagicLink(email) {
const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
if (error) throw new Error(traduzirErroAuth(error.message));
}

async function enviarRedefinicaoSenha(email) {
const { error } = await db.auth.resetPasswordForEmail(email, {
  redirectTo: (window.location && window.location.origin && window.location.pathname)
    ? window.location.origin + window.location.pathname + '#redefinir-senha'
    : '#redefinir-senha',
});
if (error) throw new Error(traduzirErroAuth(error.message));
}

async function redefinirSenha(novaSenha) {
const { error } = await db.auth.updateUser({ password: novaSenha });
if (error) throw new Error(traduzirErroAuth(error.message));
}

async function fazerLogout() {
const { error } = await db.auth.signOut();
if (error) throw new Error(error.message);
}

async function getSessaoAtual() {
const { data: { session } } = await db.auth.getSession();
return session;
}

function ouvirMudancaAuth(callback) {
db.auth.onAuthStateChange((event, session) => callback(event, session));
}

// ✅ FIX 3: função corrigida — versões duplicadas mescladas,
// sintaxe inválida removida, busca parcial com includes()
function traduzirErroAuth(msg) {
const mapa = {
  'Invalid login credentials':                'E-mail ou senha incorretos.',
  'Email not confirmed':                      'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
  'User already registered':                  'Este e-mail já está cadastrado. Faça login.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  'Unable to validate email address':         'E-mail inválido.',
  'Signup requires a valid password':         'Informe uma senha válida.',
  'Email rate limit exceeded':                'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'over_email_send_rate_limit':               'Muitas tentativas. Aguarde alguns minutos.',
  'User not found':                           'E-mail não encontrado. Verifique se digitou corretamente.',
  'Invalid email':                            'E-mail inválido.',
  'Weak password':                            'Senha muito fraca. Use pelo menos 6 caracteres.',
  'Network request failed':                   'Erro de conexão. Verifique sua internet.',
  'Server error':                             'Erro no servidor. Tente novamente mais tarde.',
};
for (const [chave, valor] of Object.entries(mapa)) {
  if (msg.includes(chave)) return valor;
}
return msg;
}

// ── UI da tela de login ────────────────────────────────────

function mostrarTelaLogin() {
document.getElementById('tela-auth').classList.remove('oculto');
document.getElementById('app-wrapper').classList.add('oculto');
document.getElementById('bottom-nav').classList.add('oculto');
}

// ✅ FIX 4: bottom-nav restaurado ao mostrar o app
function mostrarTelaApp() {
document.getElementById('tela-auth').classList.add('oculto');
document.getElementById('app-wrapper').classList.remove('oculto');
document.getElementById('bottom-nav').classList.remove('oculto');
}

// ── Modal de redefinição de senha ──────────────────────────

function mostrarModalRedefinirSenha() {
const modal = document.createElement('div');
modal.className = 'modal-overlay';
modal.innerHTML = `
  <div class="modal">
    <h3>Redefinir senha</h3>
    <p>Digite sua nova senha (mínimo 6 caracteres):</p>
    <input type="password" id="modal-nova-senha" placeholder="••••••••" autocomplete="new-password" />
    <div class="modal-botoes">
      <button id="modal-cancelar" class="btn btn-secundario">Cancelar</button>
      <button id="modal-confirmar" class="btn btn-primario">Redefinir</button>
    </div>
  </div>
`;

document.body.appendChild(modal);

const input = modal.querySelector('#modal-nova-senha');
input.focus();

modal.querySelector('#modal-cancelar').addEventListener('click', () => modal.remove());

modal.querySelector('#modal-confirmar').addEventListener('click', async () => {
  const novaSenha = input.value;
  if (novaSenha && novaSenha.length >= 6) {
    try {
      await redefinirSenha(novaSenha);
      mostrarToast('Senha redefinida com sucesso! Faça login.', 'sucesso');
      if (window.location) window.location.hash = '';
      modal.remove();
    } catch (err) {
      mostrarToast(`Erro: ${err.message}`, 'erro');
    }
  } else {
    mostrarToast('Senha deve ter pelo menos 6 caracteres.', 'erro');
  }
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') modal.querySelector('#modal-confirmar').click();
});

modal.addEventListener('keydown', e => {
  if (e.key === 'Escape') modal.remove();
});
}

// ── Perfil do usuário ──────────────────────────────────────

async function getPerfil() {
const { data: { user }, error } = await db.auth.getUser();
if (error) throw new Error(error.message);
return user;
}

async function atualizarPerfil(dados) {
const { error } = await db.auth.updateUser({ data: dados });
if (error) throw new Error(traduzirErroAuth(error.message));
}

async function atualizarEmail(novoEmail) {
const { error } = await db.auth.updateUser({ email: novoEmail });
if (error) throw new Error(traduzirErroAuth(error.message));
}

async function atualizarSenhaPerfil(novaSenha) {
const { error } = await db.auth.updateUser({ password: novaSenha });
if (error) throw new Error(traduzirErroAuth(error.message));
}

async function desativarConta() {
const { error } = await db.auth.updateUser({
  data: { desativado: true, data_desativacao: new Date().toISOString() },
});
if (error) throw new Error(traduzirErroAuth(error.message));
await fazerLogout();
}

// ── UI da tela de login ────────────────────────────────────

function configurarTelaLogin() {
console.log('[Auth] configurarTelaLogin chamada');

// ── Navegação entre formulários ──
const btnIrCadastro = document.getElementById('btn-ir-cadastro');
if (btnIrCadastro) {
  btnIrCadastro.addEventListener('click', () => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-magic').classList.add('oculto');
    document.getElementById('form-esqueci')?.classList.add('oculto');
    document.getElementById('form-cadastro').classList.remove('oculto');
    document.getElementById('cadastro-email')?.focus();
  });
}

const btnIrLogin = document.getElementById('btn-ir-login');
if (btnIrLogin) {
  btnIrLogin.addEventListener('click', () => {
    document.getElementById('form-cadastro').classList.add('oculto');
    document.getElementById('form-magic').classList.add('oculto');
    document.getElementById('form-esqueci')?.classList.add('oculto');
    document.getElementById('form-login').classList.remove('oculto');
    document.getElementById('login-email')?.focus();
  });
}

const btnIrMagic = document.getElementById('btn-ir-magic');
if (btnIrMagic) {
  btnIrMagic.addEventListener('click', () => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-cadastro').classList.add('oculto');
    document.getElementById('form-esqueci')?.classList.add('oculto');
    document.getElementById('form-magic').classList.remove('oculto');
    document.getElementById('magic-email')?.focus();
  });
}

const btnVoltarLogin = document.getElementById('btn-voltar-login');
if (btnVoltarLogin) {
  btnVoltarLogin.addEventListener('click', () => {
    document.getElementById('form-cadastro').classList.add('oculto');
    document.getElementById('form-magic').classList.add('oculto');
    document.getElementById('form-esqueci')?.classList.add('oculto');
    document.getElementById('form-login').classList.remove('oculto');
  });
}

const btnIrEsqueci = document.getElementById('btn-ir-esqueci');
if (btnIrEsqueci) {
  btnIrEsqueci.addEventListener('click', () => {
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-cadastro').classList.add('oculto');
    document.getElementById('form-magic').classList.add('oculto');
    document.getElementById('form-esqueci')?.classList.remove('oculto');
    document.getElementById('esqueci-email')?.focus();
  });
}

const btnVoltarEsqueci = document.getElementById('btn-voltar-esqueci');
if (btnVoltarEsqueci) {
  btnVoltarEsqueci.addEventListener('click', () => {
    document.getElementById('form-cadastro').classList.add('oculto');
    document.getElementById('form-magic').classList.add('oculto');
    document.getElementById('form-esqueci')?.classList.add('oculto');
    document.getElementById('form-login').classList.remove('oculto');
  });
}

// ── Submits ──
const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
  btnLogin.addEventListener('click', async () => {
    const email  = document.getElementById('login-email').value.trim();
    const senha  = document.getElementById('login-senha').value;
    const erroEl = document.getElementById('login-erro');

    if (!email || !senha) { erroEl.textContent = 'Preencha e-mail e senha.'; return; }

    btnLogin.disabled    = true;
    btnLogin.textContent = 'Entrando…';
    erroEl.textContent   = '';

    try {
      await fazerLogin(email, senha);
    } catch (err) {
      erroEl.textContent   = err.message;
      btnLogin.disabled    = false;
      btnLogin.textContent = 'Entrar';
    }
  });
}

const btnCadastro = document.getElementById('btn-cadastro');
if (btnCadastro) {
  btnCadastro.addEventListener('click', async () => {
    const email  = document.getElementById('cadastro-email').value.trim();
    const senha  = document.getElementById('cadastro-senha').value;
    const erroEl = document.getElementById('cadastro-erro');

    if (!email || !senha) { erroEl.textContent = 'Preencha e-mail e senha.'; return; }

    btnCadastro.disabled    = true;
    btnCadastro.textContent = 'Criando conta…';
    erroEl.textContent      = '';

    try {
      await fazerCadastro(email, senha);
      erroEl.style.color  = 'var(--lido)';
      erroEl.textContent  = 'Conta criada! Verifique seu e-mail para confirmar.';
      btnCadastro.disabled    = false;
      btnCadastro.textContent = 'Criar conta';
    } catch (err) {
      erroEl.style.color  = '';
      erroEl.textContent  = err.message;
      btnCadastro.disabled    = false;
      btnCadastro.textContent = 'Criar conta';
    }
  });
}

const btnMagic = document.getElementById('btn-magic');
if (btnMagic) {
  btnMagic.addEventListener('click', async () => {
    const email  = document.getElementById('magic-email').value.trim();
    const erroEl = document.getElementById('magic-erro');

    if (!email) { erroEl.textContent = 'Informe seu e-mail.'; return; }

    btnMagic.disabled    = true;
    btnMagic.textContent = 'Enviando…';
    erroEl.textContent   = '';

    try {
      await enviarMagicLink(email);
      erroEl.style.color  = 'var(--lido)';
      erroEl.textContent  = 'Link enviado! Verifique sua caixa de entrada.';
      btnMagic.disabled    = false;
      btnMagic.textContent = 'Enviar link';
    } catch (err) {
      erroEl.style.color  = '';
      erroEl.textContent  = err.message;
      btnMagic.disabled    = false;
      btnMagic.textContent = 'Enviar link';
    }
  });
}

const btnEsqueci = document.getElementById('btn-esqueci');
if (btnEsqueci) {
  btnEsqueci.addEventListener('click', async () => {
    const email  = document.getElementById('esqueci-email').value.trim();
    const erroEl = document.getElementById('esqueci-erro');

    if (!email) { erroEl.textContent = 'Informe seu e-mail.'; return; }

    btnEsqueci.disabled    = true;
    btnEsqueci.textContent = 'Enviando…';
    erroEl.textContent     = '';

    try {
      await enviarRedefinicaoSenha(email);
      erroEl.style.color  = 'var(--lido)';
      erroEl.textContent  = 'Link enviado! Verifique sua caixa de entrada.';
      btnEsqueci.disabled    = false;
      btnEsqueci.textContent = 'Enviar link';
    } catch (err) {
      erroEl.style.color  = '';
      erroEl.textContent  = err.message;
      btnEsqueci.disabled    = false;
      btnEsqueci.textContent = 'Enviar link';
    }
  });
}

if (location && location.hash === '#redefinir-senha') {
  mostrarModalRedefinirSenha();
}

const telaAuth = document.getElementById('tela-auth');
if (telaAuth) {
  telaAuth.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const formLogin    = document.getElementById('form-login');
    const formCadastro = document.getElementById('form-cadastro');
    const formMagic    = document.getElementById('form-magic');
    const formEsqueci  = document.getElementById('form-esqueci');

    if (formLogin    && !formLogin.classList.contains('oculto'))    document.getElementById('btn-login')?.click();
    if (formCadastro && !formCadastro.classList.contains('oculto')) document.getElementById('btn-cadastro')?.click();
    if (formMagic    && !formMagic.classList.contains('oculto'))    document.getElementById('btn-magic')?.click();
    if (formEsqueci  && !formEsqueci.classList.contains('oculto'))  document.getElementById('btn-esqueci')?.click();
  });
}

// Logout é configurado em app.js via configurarLogout()
}