const { extrairVotosPresidente } = require('./extrair-presidente');

/**
 * Decodifica o payload de um JWS (URL-safe Base64)
 */
function decodeJwsPayload(jws) {
  const parts = String(jws).trim().split('.');
  if (parts.length !== 3) {
    throw new Error('JWS inválido');
  }

  let payloadB64 = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const pad = payloadB64.length % 4;
  if (pad) {
    payloadB64 += '='.repeat(4 - pad);
  }

  const json = Buffer.from(payloadB64, 'base64').toString('utf8');
  return JSON.parse(json);
}

/**
 * Baixa o aux.jws → pega o hash → baixa o .rdv.dat → decodifica
 * Retorna o array de votos de Presidente (normalizado)
 */
async function baixarEDecodificarRDV(pleito, estado, municipio, zona, secao) {
  const auxUrl =
    `https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/${pleito}/dados/` +
    `${estado}/${municipio}/${zona}/${secao}/` +
    `p00${pleito}-${estado}-m${municipio}-z${zona}-s${secao}-aux.jws`;

  const auxRes = await fetch(auxUrl);
  if (!auxRes.ok) {
    throw new Error(`Falha ao baixar aux.jws (pleito ${pleito}): HTTP ${auxRes.status}`);
  }

  const jws = await auxRes.text();
  const payload = decodeJwsPayload(jws);

  const hash = payload.hashes?.[0]?.hash;
  if (!hash) {
    throw new Error('Hash não encontrado no aux.jws');
  }

  const rdvUrl =
    `https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/${pleito}/dados/` +
    `${estado}/${municipio}/${zona}/${secao}/${hash}/` +
    `o0${pleito}${estado}${municipio}${zona}${secao}-rdv.dat`;

  const rdvRes = await fetch(rdvUrl);
  if (!rdvRes.ok) {
    throw new Error(`Falha ao baixar RDV (pleito ${pleito}): HTTP ${rdvRes.status}`);
  }

  const arrayBuffer = await rdvRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const votos = extrairVotosPresidente(buffer);

  // Normaliza: "branco" → "", "nulo" → "NULO", números como string
  return votos.map(v => {
    if (v === 'branco') return '';
    if (v === 'nulo') return 'NULO';
    return String(v);
  });
}

/**
 * Retorna os votos do 1º e 2º turno de uma seção
 */
async function getJson(estado, municipio, zona, secao) {
  const [primeiro, segundo] = await Promise.all([
    baixarEDecodificarRDV(3220, estado, municipio, zona, secao), // 1º turno
    baixarEDecodificarRDV(3221, estado, municipio, zona, secao)  // 2º turno
  ]);

  return {
    primeiro_turno: {
      [estado]: {
        [municipio]: {
          [zona]: {
            [secao]: primeiro
          }
        }
      }
    },
    segundo_turno: {
      [estado]: {
        [municipio]: {
          [zona]: {
            [secao]: segundo
          }
        }
      }
    }
  };
}

module.exports = { getJson, baixarEDecodificarRDV, decodeJwsPayload };
