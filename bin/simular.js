#!/usr/bin/env node
/**
 * Uso:
 *   node bin/simular.js <estado> <cidade> <zona> <secao>
 *
 * Exemplo:
 *   node bin/simular.js sp 71072 0001 0001
 */

const { getJson } = require('../lib/getRdv');

const probabilidades = {
  // Candidatos eliminados
  14: { 22: 43.7, 13: 33.6, '': 22.7, 0: 0 },
  55: { 22: 68.3, 13: 21.6, '': 3.8, 0: 0 },
  30: { 22: 67.7, 13: 13.4, '': 18.9, 0: 0 },
  70: { 22: 44.2, 13: 38.0, '': 16.7, 0: 0 },

  // Candidatos que foram ao segundo turno
  13: { 22: 1, 13: 98, '': 0.5, 0: 0.5 },
  22: { 22: 98, 13: 2, '': 0, 0: 0 }
};

function sorteiaVoto(opcoes) {
  const soma = opcoes.reduce((acc, [, chance]) => acc + chance, 0);
  let sorteio = (Math.random() * 10000) / 100; // 0 ~ 100
  sorteio = (sorteio / 100) * soma;

  let acumulado = 0;
  for (const [destino, chance] of opcoes) {
    acumulado += chance;
    if (sorteio <= acumulado) return destino;
  }
  return opcoes[opcoes.length - 1][0];
}

function mudaVoto(voto, probs) {
  // 1. Não votou no 1º turno, mas votou no 2º
  if (String(voto) === 'N') {
    return sorteiaVoto([
      [22, 51.04],
      [13, 42.71],
      ['BRANCO_NULO', 6.25]
    ]);
  }

  // 2. Branco no 1º turno
  if (String(voto) === '') {
    return '';
  }

  // 3. Nulo / código desconhecido
  if (!probs[voto] && !probs[String(voto)]) {
    return sorteiaVoto([
      ['BRANCO_NULO', 62.63],
      [13, 20.20],
      [22, 17.17]
    ]);
  }

  const tabela = probs[voto] || probs[String(voto)];

  // 4. Transferência dos demais candidatos
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
      while (data.length !== dataSegundo.length) {
        data.push('N');
      }
    } else {
      while (data.length !== dataSegundo.length) {
        const idx = Math.floor(Math.random() * data.length);
        data.splice(idx, 1);
      }
    }

    while (data.length > 0) {
      const idx = Math.floor(Math.random() * data.length);
      let voto = data[idx];
      data.splice(idx, 1);

      voto = mudaVoto(voto, probabilidades);

      if (forcarRoubo) {
        if (c === 9) {
          voto = 13;
          c = 0;
        } else {
          c++;
        }
      } else {
        if (c === 9) {
          c = 0;
        } else {
          c++;
        }
      }

      if (voto == 22 || voto === '22') totalF++;
      else if (voto == 13 || voto === '13') totalL++;
      else if (voto === '') totalB++;
      else totalN++;
    }

    if (totalF === alvo.flavio && totalL === alvo.lula) {
      break;
    }

    i++;
  }

  return {
    loops: i,
    totalF,
    totalL,
    totalN,
    totalB
  };
}

async function main() {
  const [estado, cidade, zona, secao] = process.argv.slice(2);

  if (!estado || !cidade || !zona || !secao) {
    console.error('Uso: node bin/simular.js <estado> <cidade> <zona> <secao>');
    console.error('Exemplo: node bin/simular.js sp 71072 0001 0001');
    process.exit(1);
  }

  console.log(`Baixando RDVs da seção ${estado}/${cidade}/${zona}/${secao}...`);

  const s = await getJson(estado, cidade, zona, secao);

  const dataSegundo = s.segundo_turno[estado][cidade][zona][secao];
  const dataPrimeiro = s.primeiro_turno[estado][cidade][zona][secao];

  const final = contarVotos(dataSegundo);
  const primeiro = contarVotos(dataPrimeiro);

  console.log('\n1o turno -------------');
  console.log(`total de voto do F -> ${primeiro.flavio}`);
  console.log(`total de voto do L -> ${primeiro.lula}`);
  console.log(`total de voto do N -> ${primeiro.nulo}`);
  console.log(`total de voto do B -> ${primeiro.branco}`);

  console.log('\n2o turno -------------');
  console.log(`total de voto do F -> ${final.flavio}`);
  console.log(`total de voto do L -> ${final.lula}`);
  console.log(`total de voto do N -> ${final.nulo}`);
  console.log(`total de voto do B -> ${final.branco}`);

  console.log('\nRodando simulação COM ROUBO...');
  const comRoubo = simular(dataPrimeiro, dataSegundo, true);

  console.log(`\ntotal de loop necessario COM ROUBO -> ${comRoubo.loops}`);
  console.log('simulacao -------------');
  console.log(`total de voto do F -> ${comRoubo.totalF}`);
  console.log(`total de voto do L -> ${comRoubo.totalL}`);
  console.log(`total de voto do N -> ${comRoubo.totalN}`);
  console.log(`total de voto do B -> ${comRoubo.totalB}`);

  console.log('\nRodando simulação SEM ROUBO...');
  const semRoubo = simular(dataPrimeiro, dataSegundo, false);

  console.log(`\ntotal de loop necessario SEM ROUBO -> ${semRoubo.loops}`);
  console.log('simulacao -------------');
  console.log(`total de voto do F -> ${semRoubo.totalF}`);
  console.log(`total de voto do L -> ${semRoubo.totalL}`);
  console.log(`total de voto do N -> ${semRoubo.totalN}`);
  console.log(`total de voto do B -> ${semRoubo.totalB}`);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
