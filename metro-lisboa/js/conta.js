/* ============================================================
   Metro de Lisboa · contas e sessão (demonstração local)
   AVISO: autenticação guardada em localStorage. Serve apenas
   para demonstrar perfis; não é segurança real.
   ============================================================ */
(() => {
  'use strict';

  const CHAVE_UTILIZADORES = 'ml_utilizadores';
  const CHAVE_SESSAO = 'ml_sessao';
  const CHAVE_LINHAS = 'ml_linhas_status';
  const CODIGO_ADMIN = 'ML-ADMIN-2026';

  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* sem storage */ } }
  };

  // Hash simples — apenas para não guardar a palavra-passe em texto claro.
  function hash(texto) {
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h) ^ texto.charCodeAt(i);
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function carregar() {
    try {
      const dados = JSON.parse(storage.get(CHAVE_UTILIZADORES) || '[]');
      return Array.isArray(dados) ? dados : [];
    } catch (_) { return []; }
  }

  function guardar(utilizadores) {
    storage.set(CHAVE_UTILIZADORES, JSON.stringify(utilizadores));
  }

  function garantirContasIniciais() {
    if (carregar().length) return;
    guardar([
      { id: 'u-admin', nome: 'Administrador', email: 'admin@metro.pt', senha: hash('admin123'), tipo: 'admin', criado: new Date().toISOString() },
      { id: 'u-cliente', nome: 'Cliente de teste', email: 'cliente@metro.pt', senha: hash('cliente123'), tipo: 'cliente', criado: new Date().toISOString() }
    ]);
  }

  function registar({ nome, email, senha, tipo, codigo }) {
    garantirContasIniciais();
    const utilizadores = carregar();
    const emailNormalizado = String(email || '').trim().toLowerCase();
    if (!nome || !emailNormalizado || !senha) return { ok: false, erro: 'Preenche todos os campos obrigatórios.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNormalizado)) return { ok: false, erro: 'Introduz um e-mail válido.' };
    if (senha.length < 6) return { ok: false, erro: 'A palavra-passe deve ter pelo menos 6 caracteres.' };
    if (utilizadores.some((u) => u.email === emailNormalizado)) return { ok: false, erro: 'Já existe uma conta com este e-mail.' };
    if (tipo === 'admin' && codigo !== CODIGO_ADMIN) return { ok: false, erro: 'Código de administrador inválido.' };

    const utilizador = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: String(nome).trim(),
      email: emailNormalizado,
      senha: hash(senha),
      tipo: tipo === 'admin' ? 'admin' : 'cliente',
      criado: new Date().toISOString()
    };
    guardar([...utilizadores, utilizador]);
    return { ok: true, utilizador };
  }

  function entrar(email, senha) {
    garantirContasIniciais();
    const emailNormalizado = String(email || '').trim().toLowerCase();
    const utilizador = carregar().find((u) => u.email === emailNormalizado && u.senha === hash(senha || ''));
    if (!utilizador) return { ok: false, erro: 'E-mail ou palavra-passe incorretos.' };
    const sessao = { id: utilizador.id, nome: utilizador.nome, email: utilizador.email, tipo: utilizador.tipo };
    storage.set(CHAVE_SESSAO, JSON.stringify(sessao));
    aplicarSessaoUI();
    return { ok: true, utilizador: sessao };
  }

  function sair() {
    storage.set(CHAVE_SESSAO, '');
    aplicarSessaoUI();
  }

  function atual() {
    try {
      const sessao = JSON.parse(storage.get(CHAVE_SESSAO) || 'null');
      return sessao && sessao.email ? sessao : null;
    } catch (_) { return null; }
  }

  function eAdmin() {
    const u = atual();
    return !!u && u.tipo === 'admin';
  }

  function listar() {
    garantirContasIniciais();
    return carregar();
  }

  function alterarTipo(id, tipo) {
    if (!eAdmin()) return false;
    const utilizadores = carregar().map((u) => u.id === id ? { ...u, tipo: tipo === 'admin' ? 'admin' : 'cliente' } : u);
    guardar(utilizadores);
    const sessao = atual();
    if (sessao && sessao.id === id) {
      storage.set(CHAVE_SESSAO, JSON.stringify({ ...sessao, tipo }));
      aplicarSessaoUI();
    }
    return true;
  }

  function remover(id) {
    if (!eAdmin()) return false;
    const sessao = atual();
    if (sessao && sessao.id === id) return false;
    guardar(carregar().filter((u) => u.id !== id));
    return true;
  }

  function estadoLinhas() {
    try {
      const dados = JSON.parse(storage.get(CHAVE_LINHAS) || '{}');
      return { azul: 'operacional', vermelha: 'operacional', amarela: 'operacional', verde: 'operacional', ...dados };
    } catch (_) { return { azul: 'operacional', vermelha: 'operacional', amarela: 'operacional', verde: 'operacional' }; }
  }

  function definirLinha(id, estado) {
    if (!eAdmin()) return false;
    const dados = estadoLinhas();
    dados[id] = estado === 'interrompida' ? 'interrompida' : 'operacional';
    storage.set(CHAVE_LINHAS, JSON.stringify(dados));
    return true;
  }

  function aplicarSessaoUI() {
    const u = atual();
    const mostra = (attr, visivel) => document.querySelectorAll(`[data-sessao="${attr}"]`).forEach((e) => { e.hidden = !visivel; });
    document.querySelectorAll('[data-sessao="nome"]').forEach((e) => { e.textContent = u ? u.nome : 'Convidado'; });
    document.querySelectorAll('[data-sessao="email"]').forEach((e) => { e.textContent = u ? u.email : ''; });
    mostra('autenticado', !!u);
    mostra('convidado', !u);
    mostra('admin', !!u && u.tipo === 'admin');
    mostra('cliente', !!u && u.tipo === 'cliente');
  }

  document.addEventListener('click', (evento) => {
    const botao = evento.target.closest && evento.target.closest('[data-acao="sair"]');
    if (!botao) return;
    sair();
    if (location.pathname.endsWith('admin.html')) location.href = 'index.html';
    else if (location.pathname.endsWith('conta.html')) location.reload();
  });

  garantirContasIniciais();
  aplicarSessaoUI();
  window.Conta = {
    CODIGO_ADMIN, registar, entrar, sair, atual, eAdmin, listar,
    alterarTipo, remover, estadoLinhas, definirLinha, aplicarSessaoUI
  };
})();
