/* ============================================================
   Página de conta — ligação dos formulários ao módulo Conta.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    sessaoAtual: $('sessaoAtual'), formularios: $('formularios'),
    formEntrar: $('formEntrar'), entrarEmail: $('entrarEmail'), entrarSenha: $('entrarSenha'),
    msgEntrar: $('mensagemEntrar'),
    formRegistar: $('formRegistar'), regNome: $('regNome'), regEmail: $('regEmail'),
    regSenha: $('regSenha'), regCodigo: $('regCodigo'), campoCodigo: $('campoCodigo'),
    msgRegistar: $('mensagemRegistar')
  };

  function mensagem(no, texto, sucesso) {
    no.textContent = texto;
    no.hidden = false;
    no.classList.toggle('sucesso', !!sucesso);
    no.classList.toggle('erro', !sucesso);
  }

  function destino(utilizador) {
    return utilizador.tipo === 'admin' ? 'admin.html' : 'index.html';
  }

  function estadoInicial() {
    const atual = window.Conta.atual();
    el.sessaoAtual.hidden = !atual;
    el.formularios.hidden = !!atual;
  }

  el.formEntrar.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const resultado = window.Conta.entrar(el.entrarEmail.value, el.entrarSenha.value);
    if (!resultado.ok) return mensagem(el.msgEntrar, resultado.erro, false);
    mensagem(el.msgEntrar, 'Sessão iniciada. A redirecionar...', true);
    location.href = destino(resultado.utilizador);
  });

  document.querySelectorAll('input[name="tipo"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      el.campoCodigo.hidden = radio.value !== 'admin' || !radio.checked;
      if (el.campoCodigo.hidden) el.regCodigo.value = '';
    });
  });

  el.formRegistar.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const tipo = document.querySelector('input[name="tipo"]:checked');
    const resultado = window.Conta.registar({
      nome: el.regNome.value,
      email: el.regEmail.value,
      senha: el.regSenha.value,
      tipo: tipo ? tipo.value : 'cliente',
      codigo: el.regCodigo.value
    });
    if (!resultado.ok) return mensagem(el.msgRegistar, resultado.erro, false);
    window.Conta.entrar(el.regEmail.value, el.regSenha.value);
    mensagem(el.msgRegistar, 'Conta criada. A redirecionar...', true);
    location.href = destino(resultado.utilizador);
  });

  estadoInicial();
})();
