/**
 * Parser BER minimalista focado em extrair votos de Presidente do RDV.
 * Não depende de schema ASN.1 completo (evita bugs do asn1.js com tags implícitas).
 *
 * Retorna: ["13", "22", "branco", "nulo", ...]
 */

function readLength(buf, offset) {
  if (offset >= buf.length) throw new Error('EOF ao ler length');
  const first = buf[offset++];
  if (first < 0x80) {
    return { length: first, offset };
  }
  const numBytes = first & 0x7f;
  if (numBytes === 0 || numBytes > 4) {
    throw new Error('Length indefinido ou inválido');
  }
  if (offset + numBytes > buf.length) throw new Error('EOF no length longo');
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | buf[offset++];
  }
  return { length, offset };
}

function readTag(buf, offset) {
  if (offset >= buf.length) throw new Error('EOF ao ler tag');
  let tagByte = buf[offset++];
  const cls = tagByte >> 6;
  const constructed = (tagByte & 0x20) !== 0;
  let number = tagByte & 0x1f;

  if (number === 0x1f) {
    number = 0;
    while (offset < buf.length) {
      const b = buf[offset++];
      number = (number << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
  }

  return { cls, constructed, number, offset };
}

function parseElement(buf, offset) {
  const start = offset;
  const tag = readTag(buf, offset);
  offset = tag.offset;
  const lenInfo = readLength(buf, offset);
  offset = lenInfo.offset;
  const length = lenInfo.length;
  if (offset + length > buf.length) {
    throw new Error('Elemento ultrapassa o buffer');
  }
  const content = buf.subarray(offset, offset + length);
  const end = offset + length;

  return {
    cls: tag.cls,
    constructed: tag.constructed,
    number: tag.number,
    content,
    start,
    end
  };
}

function parseSequence(buf) {
  const elements = [];
  let offset = 0;
  while (offset < buf.length) {
    const el = parseElement(buf, offset);
    elements.push(el);
    offset = el.end;
  }
  return elements;
}

function decodeInteger(content) {
  if (content.length === 0) return 0;
  let value = 0;
  for (let i = 0; i < content.length; i++) {
    value = (value << 8) | content[i];
  }
  return value;
}

function decodeNumericString(content) {
  return content.toString('ascii').replace(/\0/g, '').trim();
}

function mapTipoVoto(n) {
  if (n === 3 || n === 5) return 'branco';
  if (n === 4 || n === 6 || n === 7 || n === 8 || n === 9) return 'nulo';
  return null;
}

function parseVoto(seqContent) {
  const children = parseSequence(seqContent);
  if (children.length === 0) return null;

  let tipoNum = null;
  let digitacao = null;

  for (const ch of children) {
    if (ch.cls === 0 && (ch.number === 10 || ch.number === 2) && !ch.constructed) {
      if (tipoNum === null) {
        tipoNum = decodeInteger(ch.content);
      }
    } else if (
      ch.cls === 0 &&
      (ch.number === 18 || ch.number === 19 || ch.number === 22 || ch.number === 12 || ch.number === 4) &&
      !ch.constructed
    ) {
      digitacao = decodeNumericString(ch.content);
    }
  }

  if (tipoNum === null) return null;

  const mapped = mapTipoVoto(tipoNum);
  if (mapped) return mapped;
  return digitacao || '';
}

function isPresidente(idCargoEl) {
  if (idCargoEl.cls === 2 && idCargoEl.number === 1) {
    if (!idCargoEl.constructed) {
      return decodeInteger(idCargoEl.content) === 1;
    }
    const kids = parseSequence(idCargoEl.content);
    for (const k of kids) {
      if (k.cls === 0 && (k.number === 10 || k.number === 2)) {
        return decodeInteger(k.content) === 1;
      }
    }
  }
  return false;
}

function collectPresidentVotes(buf, out) {
  let offset = 0;

  while (offset < buf.length) {
    let el;
    try {
      el = parseElement(buf, offset);
    } catch {
      break;
    }

    if (el.constructed) {
      try {
        const kids = parseSequence(el.content);
        if (kids.length >= 3) {
          const idCargo = kids[0];
          const qtd = kids[1];
          const votosSeq = kids[2];

          const qtdOk = qtd.cls === 0 && qtd.number === 2 && !qtd.constructed;
          const votosOk = votosSeq.cls === 0 && votosSeq.number === 16 && votosSeq.constructed;

          if (qtdOk && votosOk && isPresidente(idCargo)) {
            const votoElements = parseSequence(votosSeq.content);
            for (const ve of votoElements) {
              if (ve.cls === 0 && ve.number === 16 && ve.constructed) {
                const v = parseVoto(ve.content);
                if (v !== null) out.push(v);
              }
            }
            offset = el.end;
            continue;
          }
        }
      } catch {
        // cai na recursao
      }

      collectPresidentVotes(el.content, out);
    }

    offset = el.end;
  }
}

function extrairVotosPresidente(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (buf.length < 10) {
    throw new Error('Arquivo RDV muito pequeno ou vazio');
  }

  const votos = [];
  collectPresidentVotes(buf, votos);

  if (votos.length === 0) {
    throw new Error(
      'Nenhum voto de Presidente encontrado. Verifique se o arquivo e um RDV valido do pleito 2026.'
    );
  }

  return votos;
}

module.exports = { extrairVotosPresidente };
