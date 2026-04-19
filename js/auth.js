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
  console.log('[Auth] configurarTelaLogin chamada');

  // ── Navegação entre formulários ──
  const btnIrCadastro = document.getElementById('btn-ir-cadastro');
  if (btnIrCadastro) {
    btnIrCadastro.addEventListener('click', () => {
      console.log('[Auth] btn-ir-cadastro clicado');
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
      console.log('[Auth] btn-ir-login clicado');
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
      console.log('[Auth] btn-ir-magic clicado');
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
      console.log('[Auth] btn-voltar-login clicado');
      document.getElementById('form-cadastro').classList.add('oculto');
      document.getElementById('form-magic').classList.add('oculto');
      document.getElementById('form-esqueci')?.classList.add('oculto');
      document.getElementById('form-login').classList.remove('oculto');
    });
  }

  const btnIrEsqueci = document.getElementById('btn-ir-esqueci');
  if (btnIrEsqueci) {
    btnIrEsqueci.addEventListener('click', () => {
      console.log('[Auth] btn-ir-esqueci clicado');
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
      console.log('[Auth] btn-voltar-esqueci clicado');
      document.getElementById('form-cadastro').classList.add('oculto');
      document.getElementById('form-magic').classList.add('oculto');
      document.getElementById('form-esqueci')?.classList.add('oculto');
      document.getElementById('form-login').classList.remove('oculto');
    });
  }

  // ── Submits de formulários ──
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value;
      const erroEl = document.getElementById('login-erro');

      if (!email || !senha) {
        erroEl.textContent = 'Preencha e-mail e senha.';
        return;
      }

      btnLogin.disabled = true;
      btnLogin.textContent = 'Entrando…';
      erroEl.textContent = '';

      try {
        await fazerLogin(email, senha);
      } catch (err) {
        erroEl.textContent = err.message;
        btnLogin.disabled = false;
        btnLogin.textContent = 'Entrar';
      }
    });
  }

  const btnCadastro = document.getElementById('btn-cadastro');
  if (btnCadastro) {
    btnCadastro.addEventListener('click', async () => {
      const email = document.getElementById('cadastro-email').value.trim();
      const senha = document.getElementById('cadastro-senha').value;
      const erroEl = document.getElementById('cadastro-erro');

      if (!email || !senha) {
        erroEl.textContent = 'Preencha e-mail e senha.';
        return;
      }

      btnCadastro.disabled = true;
      btnCadastro.textContent = 'Criando conta…';
      erroEl.textContent = '';

      try {
        await fazerCadastro(email, senha);
        erroEl.style.color = 'var(--lido)';
        erroEl.textContent = 'Conta criada! Verifique seu e-mail para confirmar.';
        btnCadastro.disabled = false;
        btnCadastro.textContent = 'Criar conta';
      } catch (err) {
        erroEl.style.color = '';
        erroEl.textContent = err.message;
        btnCadastro.disabled = false;
        btnCadastro.textContent = 'Criar conta';
      }
    });
  }

  const btnMagic = document.getElementById('btn-magic');
  if (btnMagic) {
    btnMagic.addEventListener('click', async () => {
      const email = document.getElementById('magic-email').value.trim();
      const erroEl = document.getElementById('magic-erro');

      if (!email) {
        erroEl.textContent = 'Informe seu e-mail.';
        return;
      }

      btnMagic.disabled = true;
      btnMagic.textContent = 'Enviando…';
      erroEl.textContent = '';

      try {
        await enviarMagicLink(email);
        erroEl.style.color = 'var(--lido)';
        erroEl.textContent = 'Link enviado! Verifique sua caixa de entrada.';
        btnMagic.disabled = false;
        btnMagic.textContent = 'Enviar link';
      } catch (err) {
        erroEl.style.color = '';
        erroEl.textContent = err.message;
        btnMagic.disabled = false;
        btnMagic.textContent = 'Enviar link';
      }
    });
  }

  const btnEsqueci = document.getElementById('btn-esqueci');
  if (btnEsqueci) {
    btnEsqueci.addEventListener('click', async () => {
      const email = document.getElementById('esqueci-email').value.trim();
      const erroEl = document.getElementById('esqueci-erro');

      if (!email) {
        erroEl.textContent = 'Informe seu e-mail.';
        return;
      }

      btnEsqueci.disabled = true;
      btnEsqueci.textContent = 'Enviando…';
      erroEl.textContent = '';

      try {
        await enviarRedefinicaoSenha(email);
        erroEl.style.color = 'var(--lido)';
        erroEl.textContent = 'Link enviado! Verifique sua caixa de entrada.';
        btnEsqueci.disabled = false;
        btnEsqueci.textContent = 'Enviar link';
      } catch (err) {
        erroEl.style.color = '';
        erroEl.textContent = err.message;
        btnEsqueci.disabled = false;
        btnEsqueci.textContent = 'Enviar link';
      }
    });
  }

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
  const telaAuth = document.getElementById('tela-auth');
  if (telaAuth) {
    telaAuth.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const formLogin = document.getElementById('form-login');
      const formCadastro = document.getElementById('form-cadastro');
      const formMagic = document.getElementById('form-magic');
      const formEsqueci = document.getElementById('form-esqueci');

      if (formLogin && !formLogin.classList.contains('oculto')) document.getElementById('btn-login')?.click();
      if (formCadastro && !formCadastro.classList.contains('oculto')) document.getElementById('btn-cadastro')?.click();
      if (formMagic && !formMagic.classList.contains('oculto')) document.getElementById('btn-magic')?.click();
      if (formEsqueci && !formEsqueci.classList.contains('oculto')) document.getElementById('btn-esqueci')?.click();
    });
  }

  // Logout na sidebar
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fazerLogout();
        invalidarCacheLocal();
      } catch (err) {
        mostrarToast(`Erro ao sair: ${err.message}`, 'erro');
      }
    });
  }
}
