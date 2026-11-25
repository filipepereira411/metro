/* ============================================================
   Metro de Lisboa · Simulador de viagem (interface e animação)
   Usa js/rede.js para o grafo e o cálculo de itinerários.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const { LINHAS, todasEstacoes, melhorRota, formatarHora } = window.MetroLisboa;
  const ESPACO = 118;
  const SEG_POR_MIN = 2.5;

  const el = {
    formulario: $('formulario'), origem: $('origem'), destino: $('destino'),
    hora: $('hora'), data: $('data'), erro: $('erro'), resultado: $('resultado'),
    resumoRota: $('resumoRota'), duracao: $('duracao'), transbordos: $('transbordos'),
    estacoesContagem: $('estacoesContagem'), chegada: $('chegada'), pernadas: $('pernadas'),
    botaoPlay: $('botaoPlay'), botaoReiniciar: $('botaoReiniciar'),
    badgeLinha: $('badgeLinha'), estadoTexto: $('estadoTexto'), relogio: $('relogio'),
    barraProgresso: $('barraProgresso'), via: $('trilho').parentElement,
    trilho: $('trilho'), comboio: $('comboio'), eventos: $('eventos')
  };

  function linhasAtivas() {
    try {
      const estado = JSON.parse(localStorage.getItem('ml_linhas_status') || '{}');
      return Object.keys(LINHAS).filter((id) => estado[id] !== 'interrompida');
    } catch (_) { return Object.keys(LINHAS); }
  }

  function popularFormulario() {
    todasEstacoes.forEach((nome) => {
      [el.origem, el.destino].forEach((select) => {
        const opcao = document.createElement('option');
        opcao.value = nome;
        opcao.textContent = nome;
        select.appendChild(opcao);
      });
    });
    el.origem.value = 'Aeroporto';
    el.destino.value = 'Rato';

    const horarios = [];
    for (let m = 0; m <= 60; m += 15) horarios.push(m);
    for (let m = 6 * 60; m < 24 * 60; m += 15) horarios.push(m);
    horarios.forEach((m) => {
      const opcao = document.createElement('option');
      opcao.value = String(m);
      opcao.textContent = formatarHora(m);
      el.hora.appendChild(opcao);
    });
    el.hora.value = String(8 * 60 + 30);

    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    el.data.value = local.toISOString().slice(0, 10);
  }

  function mostrarResumo(rota) {
    el.resumoRota.textContent = `${rota.origem} → ${rota.destino}`;
    el.duracao.textContent = `${Math.round(rota.total)} min`;
    el.transbordos.textContent = String(rota.transbordos);
    el.estacoesContagem.textContent = String(rota.cadeia.length - 1);
    el.chegada.textContent = formatarHora(rota.minutoSaida + rota.total);

    el.pernadas.replaceChildren();
    rota.pernadas.forEach((pernada) => {
      const linha = LINHAS[pernada.linha];
      const bloco = document.createElement('li');
      bloco.className = 'pernada';
      bloco.style.setProperty('--cor-linha', linha.cor);
      const rotulo = document.createElement('div');
      rotulo.className = 'rotulo';
      const bola = document.createElement('span');
      bola.className = 'bola';
      bola.textContent = linha.sigla[0];
      rotulo.append(bola, document.createTextNode(`Linha ${linha.nome} · ${pernada.estacoes.length - 1} paragens`));
      const lista = document.createElement('div');
      lista.className = 'lista';
      const inicio = document.createElement('b');
      inicio.textContent = pernada.de;
      lista.append(inicio, document.createTextNode(` → ${pernada.estacoes.slice(1).join(' → ')}`));
      bloco.append(rotulo, lista);
      el.pernadas.appendChild(bloco);
    });
  }

  function construirTrilho(rota) {
    el.trilho.replaceChildren();
    el.trilho.style.width = `${rota.cadeia.length * ESPACO + 40}px`;
    const segmentos = rota.passos.filter((p) => p.tipo === 'segmento');
    rota.cadeia.forEach((estacao, i) => {
      if (i < segmentos.length) {
        const traco = document.createElement('div');
        traco.className = 'traco';
        traco.style.left = `${60 + i * ESPACO}px`;
        traco.style.width = `${ESPACO}px`;
        traco.style.background = LINHAS[segmentos[i].linha].cor;
        traco.style.color = LINHAS[segmentos[i].linha].cor;
        el.trilho.appendChild(traco);
      }
      const no = document.createElement('div');
      no.className = `no${i % 2 ? ' par' : ''}`;
      no.style.left = `${60 + i * ESPACO}px`;
      const nome = document.createElement('span');
      nome.className = 'nome';
      nome.textContent = estacao;
      no.appendChild(nome);
      no.dataset.indice = String(i);
      el.trilho.appendChild(no);
    });
  }

  const anim = { rota: null, tempo: 0, tocando: false, fator: 1, ultimoPasso: -1, indiceEstacao: -1 };

  function registarEvento(passo) {
    const item = document.createElement('li');
    const hora = document.createElement('time');
    hora.textContent = formatarHora(anim.rota.minutoSaida + passo.inicio);
    const texto = document.createElement('span');
    const tipo = document.createElement('span');
    tipo.className = 'tipo';
    if (passo.tipo === 'embarque') {
      texto.textContent = `Embarque em ${passo.estacao} · Linha ${LINHAS[passo.linha].nome}`;
      tipo.textContent = 'PARTIDA';
    } else if (passo.tipo === 'segmento') {
      texto.textContent = `${passo.de} → ${passo.para} · Linha ${LINHAS[passo.linha].nome}`;
      tipo.textContent = 'VIAGEM';
    } else if (passo.tipo === 'transbordo') {
      texto.textContent = `Transbordo em ${passo.estacao}: ${LINHAS[passo.deLinha].nome} → ${LINHAS[passo.linha].nome}`;
      tipo.textContent = 'TRANSBORDO';
    } else {
      texto.textContent = `Chegada a ${passo.estacao}`;
      tipo.textContent = 'CHEGADA';
    }
    item.append(hora, texto, tipo);
    el.eventos.prepend(item);
    while (el.eventos.children.length > 20) el.eventos.lastElementChild.remove();
  }

  function desenharAnimacao() {
    const rota = anim.rota;
    if (!rota) return;
    let indice = rota.passos.findIndex((p) => anim.tempo < p.fim);
    if (indice === -1) indice = rota.passos.length - 1;
    const passo = rota.passos[indice];
    const linha = LINHAS[passo.linha];
    if (indice !== anim.ultimoPasso) {
      anim.ultimoPasso = indice;
      registarEvento(passo);
    }
    const indiceEstacao = rota.cadeia.indexOf(passo.tipo === 'segmento' ? passo.de : passo.estacao);
    const fracao = passo.tipo === 'segmento' ? Math.min(1, (anim.tempo - passo.inicio) / passo.min) : 0;
    const posicao = 60 + (indiceEstacao + fracao) * ESPACO;
    el.comboio.style.left = `${posicao - 30}px`;
    el.comboio.style.setProperty('--cor-comboio', linha.cor);
    el.comboio.classList.toggle('em-movimento', passo.tipo === 'segmento' && anim.tocando);

    el.badgeLinha.style.background = linha.cor;
    el.badgeLinha.textContent = linha.sigla;
    el.relogio.textContent = formatarHora(rota.minutoSaida + anim.tempo);
    el.barraProgresso.style.width = `${Math.min(100, anim.tempo / rota.total * 100)}%`;

    if (passo.tipo === 'embarque') el.estadoTexto.textContent = `A aguardar comboio em ${passo.estacao}`;
    else if (passo.tipo === 'segmento') el.estadoTexto.textContent = `A caminho de ${passo.para} · Linha ${linha.nome}`;
    else if (passo.tipo === 'transbordo') el.estadoTexto.textContent = `Transbordo em ${passo.estacao} para a Linha ${linha.nome}`;
    else el.estadoTexto.textContent = `Chegada a ${passo.estacao}`;

    if (indiceEstacao !== anim.indiceEstacao) {
      anim.indiceEstacao = indiceEstacao;
      el.trilho.querySelectorAll('.no').forEach((no) => {
        const i = Number(no.dataset.indice);
        no.classList.toggle('atual', i === indiceEstacao);
        no.classList.toggle('passada', i < indiceEstacao);
      });
      el.via.scrollTo({ left: Math.max(0, posicao - el.via.clientWidth / 2), behavior: 'smooth' });
    }
  }

  function prepararAnimacao(rota) {
    Object.assign(anim, { rota, tempo: 0, tocando: false, ultimoPasso: -1, indiceEstacao: -1 });
    el.eventos.replaceChildren();
    el.botaoPlay.textContent = '▶ Iniciar';
    el.resultado.hidden = false;
    mostrarResumo(rota);
    construirTrilho(rota);
    desenharAnimacao();
  }

  function mostrarErro(mensagem) {
    el.erro.textContent = mensagem;
    el.erro.hidden = false;
  }

  function calcularEMostrar({ rolar = false } = {}) {
    const origem = el.origem.value;
    const destino = el.destino.value;
    const minuto = Number(el.hora.value);
    const data = el.data.value;
    if (!origem || !destino || !data) return mostrarErro('Preenche a origem, o destino e a data.');
    if (origem === destino) return mostrarErro('A origem e o destino têm de ser estações diferentes.');
    const rota = melhorRota(origem, destino, minuto, data, linhasAtivas());
    if (!rota) return mostrarErro('Não foi possível calcular este itinerário com as linhas disponíveis.');
    el.erro.hidden = true;
    prepararAnimacao(rota);
    if (rolar) el.resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function alternarPlay() {
    if (!anim.rota) return;
    if (anim.tempo >= anim.rota.total - 0.01) {
      Object.assign(anim, { tempo: 0, ultimoPasso: -1, indiceEstacao: -1 });
      el.eventos.replaceChildren();
    }
    anim.tocando = !anim.tocando;
    el.botaoPlay.textContent = anim.tocando ? '⏸ Pausar' : '▶ Continuar';
  }

  function reiniciar() {
    if (!anim.rota) return;
    Object.assign(anim, { tempo: 0, tocando: false, ultimoPasso: -1, indiceEstacao: -1 });
    el.eventos.replaceChildren();
    el.botaoPlay.textContent = '▶ Iniciar';
    desenharAnimacao();
  }

  function ligarControlos() {
    el.formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      calcularEMostrar({ rolar: true });
    });
    el.botaoPlay.addEventListener('click', alternarPlay);
    el.botaoReiniciar.addEventListener('click', reiniciar);
    document.querySelectorAll('[data-fator]').forEach((botao) => {
      botao.addEventListener('click', () => {
        anim.fator = Number(botao.dataset.fator);
        document.querySelectorAll('[data-fator]').forEach((b) => b.classList.toggle('ativo', b === botao));
      });
    });
  }

  let ultimoQuadro = performance.now();
  function quadro(agora) {
    const dt = Math.min((agora - ultimoQuadro) / 1000, 0.1);
    ultimoQuadro = agora;
    if (anim.tocando && anim.rota) {
      anim.tempo = Math.min(anim.rota.total, anim.tempo + dt * anim.fator / SEG_POR_MIN);
      if (anim.tempo >= anim.rota.total) {
        anim.tocando = false;
        el.botaoPlay.textContent = '↻ Reiniciar';
      }
      desenharAnimacao();
    }
    requestAnimationFrame(quadro);
  }

  popularFormulario();
  ligarControlos();

  const parametros = new URLSearchParams(location.search);
  if (parametros.has('origem') && todasEstacoes.includes(parametros.get('origem'))) el.origem.value = parametros.get('origem');
  if (parametros.has('destino') && todasEstacoes.includes(parametros.get('destino'))) el.destino.value = parametros.get('destino');
  if (parametros.has('hora') && el.hora.querySelector(`option[value="${parametros.get('hora')}"]`)) el.hora.value = parametros.get('hora');
  if (parametros.has('origem') && parametros.has('destino')) calcularEMostrar();

  requestAnimationFrame(quadro);
})();
