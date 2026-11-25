/* ============================================================
   Metro de Lisboa · modelo partilhado da rede
   Usado pelo simulador, pelo mapa e pelo painel admin.
   ============================================================ */
(() => {
  'use strict';

  const MIN_SEGMENTO = 2;
  const MIN_TRANSBORDO = 4;

  const LINHAS = {
    azul: { nome: 'Azul', sigla: 'Az', cor: '#0057a8', id: 'azul', estacoes: [
      'Reboleira', 'Amadora Este', 'Alfornelos', 'Pontinha', 'Carnide',
      'Colégio Militar / Luz', 'Alto dos Moinhos', 'Laranjeiras', 'Jardim Zoológico',
      'Praça de Espanha', 'S. Sebastião', 'Parque', 'Marquês de Pombal', 'Avenida',
      'Restauradores', 'Baixa-Chiado', 'Terreiro do Paço', 'Santa Apolónia'
    ]},
    vermelha: { nome: 'Vermelha', sigla: 'Vm', cor: '#e30613', id: 'vermelha', estacoes: [
      'S. Sebastião', 'Saldanha', 'Alameda', 'Olaias', 'Bela Vista', 'Chelas',
      'Olivais', 'Cabo Ruivo', 'Oriente', 'Moscavide', 'Encarnação', 'Aeroporto'
    ]},
    amarela: { nome: 'Amarela', sigla: 'Am', cor: '#f2c500', id: 'amarela', estacoes: [
      'Odivelas', 'Senhor Roubado', 'Ameixoeira', 'Lumiar', 'Quinta das Conchas',
      'Campo Grande', 'Cidade Universitária', 'Entre Campos', 'Campo Pequeno',
      'Saldanha', 'Picoas', 'Marquês de Pombal', 'Rato'
    ]},
    verde: { nome: 'Verde', sigla: 'Vd', cor: '#009a55', id: 'verde', estacoes: [
      'Telheiras', 'Campo Grande', 'Alvalade', 'Roma', 'Areeiro', 'Alameda',
      'Arroios', 'Anjos', 'Intendente', 'Martim Moniz', 'Rossio', 'Baixa-Chiado', 'Cais do Sodré'
    ]}
  };

  const grafo = new Map();
  const linhasPorEstacao = new Map();
  const todasEstacoes = new Set();

  Object.entries(LINHAS).forEach(([id, linha]) => {
    linha.estacoes.forEach((nome, i) => {
      todasEstacoes.add(nome);
      if (!linhasPorEstacao.has(nome)) linhasPorEstacao.set(nome, []);
      linhasPorEstacao.get(nome).push(id);
      const chave = `${nome}|${id}`;
      const vizinhos = [];
      if (i > 0) vizinhos.push(`${linha.estacoes[i - 1]}|${id}`);
      if (i < linha.estacoes.length - 1) vizinhos.push(`${linha.estacoes[i + 1]}|${id}`);
      grafo.set(chave, vizinhos);
    });
  });

  function esperaMedia(minuto, data) {
    const dia = new Date(`${data}T12:00:00`);
    const fimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
    const h = minuto / 60;
    if (h < 6 || h >= 23.5) return 12;
    if (h < 7) return 7;
    if (fimDeSemana) return 8;
    if ((h >= 7 && h < 9.5) || (h >= 17 && h < 19.5)) return 4;
    return 6;
  }

  function formatarHora(minuto) {
    const m = ((Math.round(minuto) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  // linhasAtivas: array opcional com os ids das linhas disponíveis
  function melhorRota(origem, destino, minuto, data, linhasAtivas = null) {
    if (origem === destino) return null;
    const ativa = (id) => !linhasAtivas || linhasAtivas.includes(id);
    const origens = (linhasPorEstacao.get(origem) || []).filter(ativa);
    const destinos = (linhasPorEstacao.get(destino) || []).filter(ativa);
    if (!origens.length || !destinos.length) return null;

    const espera = esperaMedia(minuto, data) / 2;
    const dist = new Map();
    const anterior = new Map();
    const fila = [];
    origens.forEach((id) => {
      const chave = `${origem}|${id}`;
      dist.set(chave, espera);
      anterior.set(chave, null);
      fila.push(chave);
    });

    const visitados = new Set();
    while (fila.length) {
      fila.sort((a, b) => dist.get(a) - dist.get(b));
      const atual = fila.shift();
      if (visitados.has(atual)) continue;
      visitados.add(atual);
      const [estacao, linhaAtual] = atual.split('|');
      if (estacao === destino) break;

      (grafo.get(atual) || []).forEach((chave) => {
        if (!ativa(chave.split('|')[1])) return;
        const novo = dist.get(atual) + MIN_SEGMENTO;
        if (novo < (dist.get(chave) ?? Infinity)) {
          dist.set(chave, novo);
          anterior.set(chave, atual);
          fila.push(chave);
        }
      });
      (linhasPorEstacao.get(estacao) || []).forEach((outra) => {
        if (outra === linhaAtual || !ativa(outra)) return;
        const chave = `${estacao}|${outra}`;
        const novo = dist.get(atual) + MIN_TRANSBORDO;
        if (novo < (dist.get(chave) ?? Infinity)) {
          dist.set(chave, novo);
          anterior.set(chave, atual);
          fila.push(chave);
        }
      });
    }

    let fim = null;
    destinos.forEach((id) => {
      const chave = `${destino}|${id}`;
      if (dist.has(chave) && (fim === null || dist.get(chave) < dist.get(fim))) fim = chave;
    });
    if (!fim) return null;

    const nos = [];
    for (let chave = fim; chave !== null && chave !== undefined; chave = anterior.get(chave)) nos.push(chave);
    nos.reverse();

    const pernadas = [];
    nos.forEach((no, i) => {
      const [estacao, linha] = no.split('|');
      const anteriorNo = i > 0 ? nos[i - 1].split('|') : null;
      if (!anteriorNo || anteriorNo[1] !== linha) {
        pernadas.push({ linha, de: estacao, ate: estacao, estacoes: [estacao] });
      } else {
        const pernada = pernadas[pernadas.length - 1];
        pernada.ate = estacao;
        pernada.estacoes.push(estacao);
      }
    });

    const passos = [{ tipo: 'embarque', estacao: origem, linha: nos[0].split('|')[1], min: Math.max(1, Math.round(espera)) }];
    for (let i = 1; i < nos.length; i++) {
      const [de, linhaDe] = nos[i - 1].split('|');
      const [para, linhaPara] = nos[i].split('|');
      if (de === para) passos.push({ tipo: 'transbordo', estacao: de, deLinha: linhaDe, linha: linhaPara, min: MIN_TRANSBORDO });
      else passos.push({ tipo: 'segmento', de, para, linha: linhaPara, min: MIN_SEGMENTO });
    }
    passos.push({ tipo: 'chegada', estacao: destino, linha: nos[nos.length - 1].split('|')[1], min: 0.5 });

    const cadeia = [origem, ...passos.filter((p) => p.tipo === 'segmento').map((p) => p.para)];
    let acumulado = 0;
    const linhaDoTempo = passos.map((passo) => {
      const item = { ...passo, inicio: acumulado, fim: acumulado + passo.min };
      acumulado += passo.min;
      return item;
    });

    return {
      origem, destino, minutoSaida: minuto, pernadas, cadeia,
      passos: linhaDoTempo, total: acumulado, transbordos: pernadas.length - 1
    };
  }

  window.MetroLisboa = {
    LINHAS, linhasPorEstacao, todasEstacoes: [...todasEstacoes].sort((a, b) => a.localeCompare(b, 'pt')),
    grafo, esperaMedia, formatarHora, melhorRota
  };
})();
