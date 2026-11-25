/* ============================================================
   Metro de Lisboa · mapa interativo
   Desenha as 4 linhas em SVG, permite zoom/pan, seleção de
   estações e cálculo de itinerário a partir do mapa.
   Usa js/rede.js e js/conta.js.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const { LINHAS, linhasPorEstacao, todasEstacoes, melhorRota, formatarHora } = window.MetroLisboa;

  const X_MIN = 60;
  const X_MAX = 1140;
  const Y_POR_LINHA = { azul: 90, vermelha: 210, amarela: 330, verde: 450 };
  const MIN_GAP = 16;

  const el = {
    svg: $('mapa'), envolucao: $('mapaEnvolucao'),
    camadaLinhas: $('camadaLinhas'), camadaLigacoes: $('camadaLigacoes'),
    camadaRota: $('camadaRota'), camadaEstacoes: $('camadaEstacoes'),
    nomeEstacao: $('nomeEstacao'), linhasEstacao: $('linhasEstacao'),
    definirOrigem: $('definirOrigem'), definirDestino: $('definirDestino'),
    selecao: $('selecao'), hora: $('hora'), data: $('data'), calcular: $('calcular'),
    erro: $('erroMapa'), resultadoInfo: $('resultadoInfo'),
    abrirSimulador: $('abrirSimulador'), avisoLinhas: $('avisoLinhas')
  };

  function linhasAtivas() {
    const estado = window.Conta.estadoLinhas();
    return Object.keys(LINHAS).filter((id) => estado[id] !== 'interrompida');
  }

  function svgEl(tag, atributos = {}, texto = null) {
    const no = document.createElementNS(NS, tag);
    Object.entries(atributos).forEach(([k, v]) => no.setAttribute(k, String(v)));
    if (texto !== null) no.textContent = texto;
    return no;
  }

  /* ---------- Layout esquemático ---------- */
  // Cada estação tem uma posição por linha. As correspondências são
  // aproximadas para o mesmo x e a ordem dentro de cada linha é preservada.
  const pontos = [];
  const porChave = new Map();

  Object.entries(LINHAS).forEach(([id, linha]) => {
    linha.estacoes.forEach((nome, i) => {
      const pos = {
        nome,
        linha: id,
        indice: i,
        x: X_MIN + i * (X_MAX - X_MIN) / Math.max(1, linha.estacoes.length - 1),
        y: Y_POR_LINHA[id]
      };
      pontos.push(pos);
      porChave.set(`${nome}|${id}`, pos);
    });
  });

  const correspondencias = todasEstacoes
    .map((nome) => linhasPorEstacao.get(nome).map((id) => porChave.get(`${nome}|${id}`)))
    .filter((grupo) => grupo.length > 1);

  const sequencias = Object.keys(LINHAS).map((id) =>
    pontos.filter((p) => p.linha === id).sort((a, b) => a.indice - b.indice)
  );

  function aplanar() {
    correspondencias.forEach((grupo) => {
      const media = grupo.reduce((soma, p) => soma + p.x, 0) / grupo.length;
      grupo.forEach((p) => { p.x = media; });
    });
    sequencias.forEach((seq) => {
      for (let i = 1; i < seq.length; i++) {
        seq[i].x = Math.max(seq[i].x, seq[i - 1].x + MIN_GAP);
      }
      for (let i = seq.length - 2; i >= 0; i--) {
        seq[i].x = Math.min(seq[i].x, seq[i + 1].x - MIN_GAP);
      }
      seq.forEach((p) => { p.x = Math.max(X_MIN, Math.min(X_MAX, p.x)); });
    });
  }
  for (let i = 0; i < 80; i++) aplanar();

  function posicao(nome, linha) { return porChave.get(`${nome}|${linha}`); }

  /* ---------- Desenho ---------- */

  const conteudo = svgEl('g', { id: 'conteudoMapa' });
  [el.camadaLinhas, el.camadaLigacoes, el.camadaRota, el.camadaEstacoes].forEach((camada) => {
    conteudo.appendChild(camada);
  });
  el.svg.appendChild(conteudo);

  const estadoLinhas = window.Conta.estadoLinhas();
  const avisos = Object.keys(LINHAS).filter((id) => estadoLinhas[id] === 'interrompida');

  Object.entries(LINHAS).forEach(([id, linha]) => {
    const seq = sequencias.find((s) => s[0].linha === id);
    const pontosStr = seq.map((p) => `${p.x.toFixed(1)},${p.y}`).join(' ');
    el.camadaLinhas.appendChild(svgEl('polyline', {
      points: pontosStr, class: 'linha-fundo', stroke: linha.cor
    }));
    if (avisos.includes(id)) {
      el.camadaLinhas.appendChild(svgEl('polyline', {
        points: pontosStr, class: 'linha-interrompida'
      }));
    } else {
      el.camadaLinhas.appendChild(svgEl('polyline', {
        points: pontosStr, class: 'linha-tracado', stroke: linha.cor
      }));
    }
  });

  correspondencias.forEach((grupo) => {
    const primeiro = grupo[0];
    grupo.slice(1).forEach((outro) => {
      el.camadaLigacoes.appendChild(svgEl('line', {
        x1: primeiro.x.toFixed(1), y1: primeiro.y,
        x2: outro.x.toFixed(1), y2: outro.y,
        class: 'ligacao-correspondencia'
      }));
    });
  });

  const gruposEstacao = new Map();
  todasEstacoes.forEach((nome) => {
    const grupo = svgEl('g', {
      class: `estacao${linhasPorEstacao.get(nome).length > 1 ? ' interchange' : ''}`,
      'data-estacao': nome
    });
    const pontosDaEstacao = linhasPorEstacao.get(nome).map((id) => posicao(nome, id));
    pontosDaEstacao.forEach((p) => {
      grupo.appendChild(svgEl('circle', {
        cx: p.x.toFixed(1), cy: p.y, r: pontosDaEstacao.length > 1 ? 6 : 5,
        class: 'ponto', stroke: LINHAS[p.linha].cor
      }));
    });
    const mediaX = pontosDaEstacao.reduce((s, p) => s + p.x, 0) / pontosDaEstacao.length;
    const yTopo = Math.min(...pontosDaEstacao.map((p) => p.y)) - 12;
    const rotulo = svgEl('text', {
      x: mediaX.toFixed(1), y: yTopo, class: 'rotulo', 'text-anchor': 'middle'
    }, nome);
    grupo.appendChild(rotulo);

    grupo.addEventListener('click', () => selecionar(nome));
    el.camadaEstacoes.appendChild(grupo);
    gruposEstacao.set(nome, grupo);
  });

  if (avisos.length) {
    el.avisoLinhas.textContent = `Interrompida${avisos.length > 1 ? 's' : ''}: ${avisos.map((id) => LINHAS[id].nome).join(', ')}`;
    el.avisoLinhas.style.color = '#b00020';
  }

  /* ---------- Zoom e pan ---------- */

  let zoom = 1;
  let panX = 0;
  let panY = 0;

  function aplicarTransform() {
    conteudo.setAttribute('transform', `translate(${panX.toFixed(2)} ${panY.toFixed(2)}) scale(${zoom.toFixed(3)})`);
  }

  function mudarZoom(fator, centroX = 600, centroY = 280) {
    const novo = Math.max(0.5, Math.min(2.5, zoom * fator));
    if (novo === zoom) return;
    panX = centroX - (centroX - panX) * (novo / zoom);
    panY = centroY - (centroY - panY) * (novo / zoom);
    zoom = novo;
    aplicarTransform();
  }

  document.querySelectorAll('[data-zoom]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const acao = botao.dataset.zoom;
      if (acao === 'in') mudarZoom(1.25);
      else if (acao === 'out') mudarZoom(0.8);
      else { zoom = 1; panX = 0; panY = 0; aplicarTransform(); }
    });
  });

  let arrasto = null;
  el.envolucao.addEventListener('pointerdown', (evento) => {
    arrasto = { x: evento.clientX, y: evento.clientY, panX, panY, moveu: false };
    el.envolucao.classList.add('arrastando');
    if (el.envolucao.setPointerCapture) el.envolucao.setPointerCapture(evento.pointerId);
  });
  el.envolucao.addEventListener('pointermove', (evento) => {
    if (!arrasto) return;
    const dx = evento.clientX - arrasto.x;
    const dy = evento.clientY - arrasto.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) arrasto.moveu = true;
    if (!arrasto.moveu) return;
    panX = arrasto.panX + dx;
    panY = arrasto.panY + dy;
    aplicarTransform();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
    el.envolucao.addEventListener(ev, () => {
      arrasto = null;
      el.envolucao.classList.remove('arrastando');
    });
  });
  el.envolucao.addEventListener('wheel', (evento) => {
    evento.preventDefault();
    const rect = el.envolucao.getBoundingClientRect();
    const cx = (evento.clientX - rect.left) / rect.width * 1200;
    const cy = (evento.clientY - rect.top) / rect.height * 560;
    mudarZoom(evento.deltaY < 0 ? 1.1 : 0.9, cx, cy);
  }, { passive: false });

  /* ---------- Seleção e itinerário ---------- */

  let selecionada = null;
  let origem = null;
  let destino = null;

  function mostrarSelecao() {
    el.selecao.replaceChildren();
    const linhas = [
      ['Origem', origem],
      ['Destino', destino]
    ];
    linhas.forEach(([rotulo, valor]) => {
      const linha = document.createElement('div');
      if (valor) {
        const negrito = document.createElement('b');
        negrito.textContent = `${rotulo}: `;
        linha.append(negrito, document.createTextNode(valor));
      } else {
        linha.textContent = `${rotulo}: —`;
      }
      el.selecao.appendChild(linha);
    });
    const tempo = document.createElement('div');
    tempo.textContent = 'Clica numa estação e define origem/destino.';
    el.selecao.appendChild(tempo);
  }

  function limparRota() {
    el.camadaRota.replaceChildren();
    gruposEstacao.forEach((grupo) => grupo.classList.remove('na-rota'));
  }

  function selecionar(nome) {
    if (selecionada && gruposEstacao.has(selecionada)) {
      gruposEstacao.get(selecionada).classList.remove('selecionada');
    }
    selecionada = nome;
    const grupo = gruposEstacao.get(nome);
    if (grupo) grupo.classList.add('selecionada');
    el.nomeEstacao.textContent = nome;

    el.linhasEstacao.replaceChildren();
    linhasPorEstacao.get(nome).forEach((id) => {
      const etiqueta = document.createElement('span');
      etiqueta.className = 'etiqueta-linha';
      etiqueta.style.background = LINHAS[id].cor;
      etiqueta.textContent = LINHAS[id].nome;
      el.linhasEstacao.appendChild(etiqueta);
    });
    limparErro();
  }

  function limparErro() {
    if (el.erro) el.erro.hidden = true;
  }

  function mostrarErro(mensagem) {
    el.erro.textContent = mensagem;
    el.erro.hidden = false;
    el.resultadoInfo.replaceChildren();
    limparRota();
  }

  function desenharRota(rota) {
    el.camadaRota.replaceChildren();
    const segmentos = rota.passos.filter((p) => p.tipo === 'segmento');
    if (!segmentos.length) return;
    const coords = [];
    const primeiro = posicao(rota.origem, segmentos[0].linha);
    if (primeiro) coords.push(`${primeiro.x.toFixed(1)},${primeiro.y}`);
    segmentos.forEach((p) => {
      const dest = posicao(p.para, p.linha);
      if (dest) coords.push(`${dest.x.toFixed(1)},${dest.y}`);
    });
    if (coords.length > 1) {
      el.camadaRota.appendChild(svgEl('polyline', { points: coords.join(' '), class: 'rota-ativa' }));
    }
    rota.cadeia.forEach((nome) => {
      const g = gruposEstacao.get(nome);
      if (g) g.classList.add('na-rota');
    });
  }

  function mostrarResultado(rota) {
    el.resultadoInfo.replaceChildren();
    const titulo = document.createElement('div');
    const negrito = document.createElement('b');
    negrito.textContent = `${rota.origem} → ${rota.destino}`;
    titulo.append(negrito, document.createElement('br'), document.createTextNode(
      `Duração: ${Math.round(rota.total)} min · Transbordos: ${rota.transbordos}`
    ));
    el.resultadoInfo.appendChild(titulo);
    rota.pernadas.forEach((pernada) => {
      const bloco = document.createElement('div');
      bloco.className = 'linha-resultado';
      bloco.style.setProperty('--cor-linha', LINHAS[pernada.linha].cor);
      bloco.textContent = `Linha ${LINHAS[pernada.linha].nome}: ${pernada.de} → ${pernada.ate}`;
      el.resultadoInfo.appendChild(bloco);
    });
    el.abrirSimulador.href = `index.html?origem=${encodeURIComponent(rota.origem)}` +
      `&destino=${encodeURIComponent(rota.destino)}` +
      `&hora=${encodeURIComponent(String(rota.minutoSaida))}`;
    el.abrirSimulador.hidden = false;
  }

  function calcular() {
    if (!origem || !destino) return mostrarErro('Define a origem e o destino no mapa.');
    if (origem === destino) return mostrarErro('A origem e o destino têm de ser estações diferentes.');
    const minuto = Number(el.hora.value);
    const data = el.data.value;
    if (!el.hora.value || !data) return mostrarErro('Preenche a hora e a data.');
    const rota = melhorRota(origem, destino, minuto, data, linhasAtivas());
    if (!rota) return mostrarErro('Não foi possível calcular este itinerário com as linhas disponíveis.');
    limparErro();
    desenharRota(rota);
    mostrarResultado(rota);
  }

  el.definirOrigem.addEventListener('click', () => {
    if (!selecionada) return mostrarErro('Seleciona primeiro uma estação no mapa.');
    origem = selecionada;
    limparErro();
    mostrarSelecao();
  });
  el.definirDestino.addEventListener('click', () => {
    if (!selecionada) return mostrarErro('Seleciona primeiro uma estação no mapa.');
    destino = selecionada;
    limparErro();
    mostrarSelecao();
  });
  el.calcular.addEventListener('click', calcular);

  /* ---------- Inicialização ---------- */

  function popularHoraEData() {
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

  const parametros = new URLSearchParams(location.search);
  if (parametros.has('origem') && todasEstacoes.includes(parametros.get('origem'))) origem = parametros.get('origem');
  if (parametros.has('destino') && todasEstacoes.includes(parametros.get('destino'))) destino = parametros.get('destino');

  popularHoraEData();
  if (parametros.has('hora') && el.hora.querySelector(`option[value="${parametros.get('hora')}"]`)) {
    el.hora.value = parametros.get('hora');
  }
  mostrarSelecao();
  aplicarTransform();

  if (origem && destino) {
    selecionar(origem);
    calcular();
  }
})();
