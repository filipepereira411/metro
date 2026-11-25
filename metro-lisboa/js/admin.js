/* ============================================================
   Painel de administração — utilizadores e estado das linhas.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const { LINHAS } = window.MetroLisboa;
  const el = {
    painel: $('painel'), negado: $('acessoNegado'), lista: $('listaUtilizadores'),
    contagem: $('contagemUtilizadores'), linhas: $('listaLinhas'), mensagem: $('mensagemAdmin')
  };

  function mensagem(texto, sucesso = true) {
    el.mensagem.textContent = texto;
    el.mensagem.hidden = false;
    el.mensagem.classList.toggle('sucesso', sucesso);
    el.mensagem.classList.toggle('erro', !sucesso);
  }

  function criarCelula(texto) {
    const td = document.createElement('td');
    td.textContent = texto;
    return td;
  }

  function desenharUtilizadores() {
    const utilizadores = window.Conta.listar();
    const sessao = window.Conta.atual();
    el.lista.replaceChildren();
    el.contagem.textContent = `${utilizadores.length} conta${utilizadores.length === 1 ? '' : 's'}`;

    utilizadores.forEach((utilizador) => {
      const tr = document.createElement('tr');
      tr.appendChild(criarCelula(utilizador.nome));
      tr.appendChild(criarCelula(utilizador.email));

      const tdTipo = document.createElement('td');
      const etiqueta = document.createElement('span');
      etiqueta.className = `etiqueta-tipo${utilizador.tipo === 'admin' ? ' admin' : ''}`;
      etiqueta.textContent = utilizador.tipo === 'admin' ? 'Admin' : 'Cliente';
      tdTipo.appendChild(etiqueta);
      tr.appendChild(tdTipo);

      const tdAcoes = document.createElement('td');
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Tipo de ${utilizador.nome}`);
      ['cliente', 'admin'].forEach((tipo) => {
        const opcao = document.createElement('option');
        opcao.value = tipo;
        opcao.textContent = tipo === 'admin' ? 'Admin' : 'Cliente';
        select.appendChild(opcao);
      });
      select.value = utilizador.tipo;
      select.addEventListener('change', () => {
        if (!window.Conta.alterarTipo(utilizador.id, select.value)) {
          mensagem('Não foi possível alterar o tipo.', false);
          return;
        }
        mensagem(`Tipo de ${utilizador.nome} alterado para ${select.value}.`);
        if (sessao && sessao.id === utilizador.id) location.reload();
        else desenharUtilizadores();
      });

      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'botao';
      botao.textContent = 'Remover';
      botao.addEventListener('click', () => {
        if (!window.Conta.remover(utilizador.id)) {
          mensagem('Não podes remover a tua própria conta.', false);
          return;
        }
        mensagem(`Conta de ${utilizador.nome} removida.`);
        desenharUtilizadores();
      });

      tdAcoes.append(select, document.createTextNode(' '), botao);
      tr.appendChild(tdAcoes);
      el.lista.appendChild(tr);
    });
  }

  function desenharLinhas() {
    const estado = window.Conta.estadoLinhas();
    el.linhas.replaceChildren();
    Object.entries(LINHAS).forEach(([id, linha]) => {
      const bloco = document.createElement('div');
      bloco.className = 'linha-estado';
      const bola = document.createElement('i');
      bola.style.background = linha.cor;
      bloco.appendChild(bola);

      const nome = document.createElement('span');
      nome.textContent = linha.nome;
      bloco.appendChild(nome);

      const select = document.createElement('select');
      select.setAttribute('aria-label', `Estado da linha ${linha.nome}`);
      [['operacional', 'Operacional'], ['interrompida', 'Interrompida']].forEach(([valor, rotulo]) => {
        const opcao = document.createElement('option');
        opcao.value = valor;
        opcao.textContent = rotulo;
        select.appendChild(opcao);
      });
      select.value = estado[id] || 'operacional';
      select.addEventListener('change', () => {
        if (!window.Conta.definirLinha(id, select.value)) {
          mensagem('Não foi possível alterar o estado da linha.', false);
          return;
        }
        mensagem(`Linha ${linha.nome}: ${select.value}.`);
      });
      bloco.appendChild(select);
      el.linhas.appendChild(bloco);
    });
  }

  if (!window.Conta.eAdmin()) {
    el.negado.hidden = false;
    return;
  }

  el.negado.hidden = true;
  desenharUtilizadores();
  desenharLinhas();
})();
