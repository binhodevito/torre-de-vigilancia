// ============================================================
// auth.js — Torre de Vigilância — Autenticação via Supabase
// ============================================================

// Faz login com e-mail e senha
async function fazerLogin(email, senha) {
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzirErroAuth(error.message));
  return data;
}

// Cadastra novo usuário
async function fazerCadastro(email, senha) {
  const { data, error } = await db.auth.signUp({ email, password: senha });
  if (error) throw new Error(traduzirErroAuth(error.message));
  return data;
}

// Envia magic link (login sem senha)
async function enviarMagicLink(email) {
  const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(traduzirErroAuth(error.message));
}

// Envia e-mail de redefinição de senha
async function enviarRedefinicaoSenha(email) {
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname + '#redefinir-senha',
  });
  if (error) throw new Error(traduzirErroAuth(error.message));
}

// Redefine a senha após clicar no link do e-mail
async function redefinirSenha(novaSenha) {
  const { error } = await db.auth.updateUser({ password: novaSenha });
  if (error) throw new Error(traduzirErroAuth(error.message));
}

// Faz logout
async function fazerLogout() {
  const { error } = await db.auth.signOut();
  if (error) throw new Error(error.message);
}

// Retorna a sessão atual (ou null)
async function getSessaoAtual() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

// Escuta mudanças de estado de autenticação
function ouvirMudancaAuth(callback) {
  db.auth.onAuthStateChange((event, session) => callback(event, session));
}

// Traduz mensagens de erro do Supabase Auth para português
function traduzirErroAuth(msg) {
  const mapa = {
    'Invalid login credentials':               'E-mail ou senha incorretos.',
    'Email not confirmed':                     'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
    'User already registered':                 'Este e-mail já está cadastrado. Faça login.',
    'Password should be at least 6 characters':'A senha precisa ter pelo menos 6 caracteres.',
    'Unable to validate email address':        'E-mail inválido.',
    'Signup requires a valid password':        'Informe uma senha válida.',
    'Email rate limit exceeded':               'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'over_email_send_rate_limit':              'Muitas tentativas. Aguarde alguns minutos.',
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

function mostrarTelaApp() {
  document.getElementById('tela-auth').classList.add('oculto');
  document.getElementById('app-wrapper').classList.remove('oculto');
}

function configurarTelaLogin() {
  // Helper para adicionar event listener de forma segura
  const addClickListener = (id, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', callback);
  };

  // Obter referências aos elementos
  const formLogin = document.getElementById('form-login');
  const formCadastro = document.getElementById('form-cadastro');
  const formMagic = document.getElementById('form-magic');
  const formEsqueci = document.getElementById('form-esqueci');

  console.debug('[Auth] inicializando tela de login', {
    formLogin,
    formCadastro,
    formMagic,
    formEsqueci,
  });

  // ── Navegação entre formulários ──
  addClickListener('btn-ir-cadastro', () => {
    formLogin.classList.add('oculto');
    formCadastro.classList.remove('oculto');
    document.getElementById('cadastro-email')?.focus();
  });

  addClickListener('btn-ir-login', () => {
    formCadastro.classList.add('oculto');
    formLogin.classList.remove('oculto');
    document.getElementById('login-email')?.focus();
  });

  addClickListener('btn-ir-magic', () => {
    formLogin.classList.add('oculto');
    formMagic.classList.remove('oculto');
    document.getElementById('magic-email')?.focus();
  });

  addClickListener('btn-voltar-login', () => {
    formMagic.classList.add('oculto');
    formLogin.classList.remove('oculto');
  });

  addClickListener('btn-ir-esqueci', () => {
    formLogin.classList.add('oculto');
    formEsqueci?.classList.remove('oculto');
    document.getElementById('esqueci-email')?.focus();
  });

  addClickListener('btn-voltar-esqueci', () => {
    formEsqueci?.classList.add('oculto');
    formLogin.classList.remove('oculto');
  });

  // ── Submits de formulários ──
  addClickListener('btn-login', async () => {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const btn = document.getElementById('btn-login');
    const erroEl = document.getElementById('login-erro');

    if (!email || !senha) {
      erroEl.textContent = 'Preencha e-mail e senha.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando…';
    erroEl.textContent = '';

    try {
      await fazerLogin(email, senha);
    } catch (err) {
      erroEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });

  addClickListener('btn-cadastro', async () => {
    const email = document.getElementById('cadastro-email').value.trim();
    const senha = document.getElementById('cadastro-senha').value;
    const btn = document.getElementById('btn-cadastro');
    const erroEl = document.getElementById('cadastro-erro');

    if (!email || !senha) {
      erroEl.textContent = 'Preencha e-mail e senha.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Criando conta…';
    erroEl.textContent = '';

    try {
      await fazerCadastro(email, senha);
      erroEl.style.color = 'var(--lido)';
      erroEl.textContent = 'Conta criada! Verifique seu e-mail para confirmar.';
      btn.disabled = false;
      btn.textContent = 'Criar conta';
    } catch (err) {
      erroEl.style.color = '';
      erroEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Criar conta';
    }
  });

  addClickListener('btn-magic', async () => {
    const email = document.getElementById('magic-email').value.trim();
    const btn = document.getElementById('btn-magic');
    const erroEl = document.getElementById('magic-erro');

    if (!email) {
      erroEl.textContent = 'Informe seu e-mail.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    erroEl.textContent = '';

    try {
      await enviarMagicLink(email);
      erroEl.style.color = 'var(--lido)';
      erroEl.textContent = 'Link enviado! Verifique sua caixa de entrada.';
      btn.disabled = false;
      btn.textContent = 'Enviar link';
    } catch (err) {
      erroEl.style.color = '';
      erroEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Enviar link';
    }
  });

  addClickListener('btn-esqueci', async () => {
    const email = document.getElementById('esqueci-email').value.trim();
    const btn = document.getElementById('btn-esqueci');
    const erroEl = document.getElementById('esqueci-erro');

    if (!email) {
      erroEl.textContent = 'Informe seu e-mail.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    erroEl.textContent = '';

    try {
      await enviarRedefinicaoSenha(email);
      erroEl.style.color = 'var(--lido)';
      erroEl.textContent = 'Link enviado! Verifique sua caixa de entrada.';
      btn.disabled = false;
      btn.textContent = 'Enviar link';
    } catch (err) {
      erroEl.style.color = '';
      erroEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Enviar link';
    }
  });

  // ── Outros event listeners ──
  // Detecta se voltou do link de redefinição de senha (hash #redefinir-senha)
  if (location.hash === '#redefinir-senha') {
    const novaSenha = prompt('Digite sua nova senha (mínimo 6 caracteres):');
    if (novaSenha && novaSenha.length >= 6) {
      try {
        await redefinirSenha(novaSenha);
        alert('Senha redefinida com sucesso! Faça login.');
        location.hash = '';
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    }
  }

  // Enter submete o formulário visível
  document.getElementById('tela-auth').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!formLogin.classList.contains('oculto')) document.getElementById('btn-login')?.click();
    if (!formCadastro.classList.contains('oculto')) document.getElementById('btn-cadastro')?.click();
    if (!formMagic.classList.contains('oculto')) document.getElementById('btn-magic')?.click();
    if (formEsqueci && !formEsqueci.classList.contains('oculto')) document.getElementById('btn-esqueci')?.click();
  });

  // Logout na sidebar
  addClickListener('btn-logout', async () => {
    try {
      await fazerLogout();
      invalidarCacheLocal();
    } catch (err) {
      mostrarToast(`Erro ao sair: ${err.message}`, 'erro');
    }
  });
}
