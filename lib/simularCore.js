const { getJson } = require('./getRdv');

const probabilidades = {
  14: { 22: 43.7, 13: 33.6, '': 22.7, 0: 0 },
  55: { 22: 68.3, 13: 21.6, '': 3.8, 0: 0 },
  30: { 22: 67.7, 13: 13.4, '': 18.9, 0: 0 },
  70: { 22: 44.2, 13: 38.0, '': 16.7, 0: 0 },
  13: { 22: 1, 13: 98, '': 0.5, 0: 0.5 },
  22: { 22: 98, 13: 2, '': 0, 0: 0 }
};

function sorteiaVoto(opcoes) {
  const soma = opcoes.reduce((acc, [, chance]) => acc + chance, 0);
  let sorteio = (Math.random() * 10000) / 100;
  sorteio = (sorteio / 100) * soma;
  let acumulado = 0;
  for (const [destino, chance] of opcoes) {
    acumulado += chance;
    if (sorteio <= acumulado) return destino;
  }
  return opcoes[opcoes.length - 1][0];
}

function mudaVoto(voto, probs) {
  if (String(voto) === 'N') {
    return sorteiaVoto([
      [22, 51.04],
      [13, 42.71],
      ['BRANCO_NULO', 6.25]
    ]);
  }
  if (String(voto) === '') return '';
  if (!probs[voto] && !probs[String(voto)]) {
    return sorteiaVoto([
      ['BRANCO_NULO', 62.63],
      [13, 20.20],
      [22, 17.17]
    ]);
  }
  const tabela = probs[voto] || probs[String(voto)];
  const opcoes = Object.entries(tabela).map(([destino, chance]) => {
    const dest = destino === '' ? '' : (isNaN(Number(destino)) ? destino : Number(destino));
    return [dest, chance];
  });
  return sorteiaVoto(opcoes);
}

function contarVotos(lista) {
  let lula = 0, flavio = 0, branco = 0, nulo = 0;
  for (const voto of lista) {
    if (voto == 13 || voto === '13') lula++;
    else if (voto == 22 || voto === '22') flavio++;
    else if (voto === '') branco++;
    else nulo++;
  }
  return { lula, flavio, branco, nulo };
}

function simular(dataPrimeiro, dataSegundo, forcarRoubo = false) {
  let i = 0;
  let totalF, totalL, totalN, totalB;
  const alvo = contarVotos(dataSegundo);

  while (i < 10000) {
    totalF = totalL = totalN = totalB = 0;
    let c = 0;
    let data = [...dataPrimeiro];

    if (data.length <= dataSegundo.length) {
      while (data.length !== dataSegundo.length) data.push('N');
    } else {
      while (data.length !== dataSegundo.length) {
        data.splice(Math.floor(Math.random() * data.length), 1);
      }
    }

    while (data.length > 0) {
      const idx = Math.floor(Math.random() * data.length);
      let voto = data[idx];
      data.splice(idx, 1);
      voto = mudaVoto(voto, probabilidades);

      if (forcarRoubo) {
        if (c === 7) { voto = 13; c = 0; }
        else c++;
      } else {
        if (c === 7) c = 0;
        else c++;
      }

      if (voto == 22 || voto === '22') totalF++;
      else if (voto == 13 || voto === '13') totalL++;
      else if (voto === '') totalB++;
      else totalN++;
    }

    if (totalF === alvo.flavio && totalL === alvo.lula) break;
    i++;
  }

  return { loops: i, totalF, totalL, totalN, totalB };
}

async function rodarSimulacao(estado, cidade, zona, secao) {
  const s = await getJson(estado, cidade, zona, secao);
  const dataSegundo = s.segundo_turno[estado][cidade][zona][secao];
  const dataPrimeiro = s.primeiro_turno[estado][cidade][zona][secao];

  const final = contarVotos(dataSegundo);
  const primeiro = contarVotos(dataPrimeiro);
  const comRoubo = simular(dataPrimeiro, dataSegundo, true);
  const semRoubo = simular(dataPrimeiro, dataSegundo, false);

  return {
    parametros: { estado, cidade, zona, secao },
    primeiro_turno: {
      flavio: primeiro.flavio,
      lula: primeiro.lula,
      nulo: primeiro.nulo,
      branco: primeiro.branco,
      total: dataPrimeiro.length
    },
    segundo_turno: {
      flavio: final.flavio,
      lula: final.lula,
      nulo: final.nulo,
      branco: final.branco,
      total: dataSegundo.length
    },
    simulacao_com_roubo: {
      loops_necessarios: comRoubo.loops,
      flavio: comRoubo.totalF,
      lula: comRoubo.totalL,
      nulo: comRoubo.totalN,
      branco: comRoubo.totalB
    },
    simulacao_sem_roubo: {
      loops_necessarios: semRoubo.loops,
      flavio: semRoubo.totalF,
      lula: semRoubo.totalL,
      nulo: semRoubo.totalN,
      branco: semRoubo.totalB
    }
  };
}

module.exports = { rodarSimulacao, contarVotos };
