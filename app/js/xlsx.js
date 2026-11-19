// Escreve um ficheiro Excel (.xlsx) simples: várias folhas, texto, números e negrito. Zip sem compressão.

const escX = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const col = i => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const nomeFolha = (n, i) => (String(n || '').replace(/[\\/:*?\[\]]/g, ' ').trim().slice(0, 31).trim() || 'Folha' + (i + 1));

let TAB;
function crc32(b) {
  if (!TAB) TAB = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = TAB[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zip(ficheiros) {
  const cod = new TextEncoder(), partes = [], central = [];
  let pos = 0;
  for (const [nome, texto] of ficheiros) {
    const n = cod.encode(nome), d = cod.encode(texto), crc = crc32(d);
    const cab = new DataView(new ArrayBuffer(30));
    cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); cab.setUint16(8, 0, true);
    cab.setUint32(10, 0x00210000, true); cab.setUint32(14, crc, true); cab.setUint32(18, d.length, true); cab.setUint32(22, d.length, true); cab.setUint16(26, n.length, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(12, 0x00210000, true); cen.setUint32(16, crc, true); cen.setUint32(20, d.length, true); cen.setUint32(24, d.length, true); cen.setUint16(28, n.length, true); cen.setUint32(42, pos, true);
    partes.push(new Uint8Array(cab.buffer), n, d); central.push(new Uint8Array(cen.buffer), n);
    pos += 30 + n.length + d.length;
  }
  const tamC = central.reduce((s, x) => s + x.length, 0), fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, ficheiros.length, true); fim.setUint16(10, ficheiros.length, true); fim.setUint32(12, tamC, true); fim.setUint32(16, pos, true);
  const tudo = [...partes, ...central, new Uint8Array(fim.buffer)], out = new Uint8Array(tudo.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const x of tudo) { out.set(x, o); o += x.length; }
  return out;
}

/**
 * folhas: [{ nome, larguras?: [n…], linhas: [[célula…]] }]. Célula: texto, número, null ou { v, b } (b = negrito).
 * Números não inteiros saem com duas casas. Devolve Uint8Array.
 */
export function criarXLSX(folhas) {
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const fs = (folhas || []).map((f, i) => ({ ...f, nome: nomeFolha(f.nome, i) }));
  const folhaXML = f => {
    const linhas = (f.linhas || []).map((l, r) => `<row r="${r + 1}">${(l || []).map((c, k) => {
      const v = c && typeof c === 'object' ? c.v : c, b = !!(c && typeof c === 'object' && c.b);
      if (v === null || v === undefined || v === '') return '';
      const ref = col(k) + (r + 1);
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${(Number.isInteger(v) ? 0 : 2) + (b ? 1 : 0)}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr" s="${b ? 1 : 0}"><is><t xml:space="preserve">${escX(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const cols = (f.larguras || []).map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join('');
    return `${X}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${linhas}</sheetData></worksheet>`;
  };
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', P = 'http://schemas.openxmlformats.org/package/2006', M = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
  const fich = [
    ['[Content_Types].xml', `${X}<Types xmlns="${P}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/>${fs.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT}.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${X}<Relationships xmlns="${P}/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${X}<workbook xmlns="${M}" xmlns:r="${R}"><sheets>${fs.map((f, i) => `<sheet name="${escX(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${X}<Relationships xmlns="${P}/relationships">${fs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${fs.length + 1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `${X}<styleSheet xmlns="${M}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>`],
    ...fs.map((f, i) => [`xl/worksheets/sheet${i + 1}.xml`, folhaXML(f)]),
  ];
  return zip(fich);
}
