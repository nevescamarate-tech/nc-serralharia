// Leitura de articulados (mapas de quantidades) em Excel (.xlsx) e CSV, e escolha das linhas de serralharia.

const MAX_LINHAS = 20000;
const semAcentos = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- CSV ----------
export function lerCSV(texto) {
  const t = String(texto ?? '').replace(/^﻿/, '');
  const l1 = t.split(/\r?\n/, 1)[0] || '';
  const sep = [';', '\t', ','].map(s => [s, l1.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const linhas = []; let linha = [], cel = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else aspas = false; } else cel += c; }
    else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(cel); linhas.push(linha); linha = []; cel = ''; if (linhas.length >= MAX_LINHAS) return linhas; }
    else cel += c;
  }
  if (cel !== '' || linha.length) { linha.push(cel); linhas.push(linha); }
  return linhas;
}

// ---------- Excel (.xlsx é um zip de XML) ----------
async function lerZip(buf) {
  const b = new Uint8Array(buf), v = new DataView(buf);
  let fim = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 70000; i--) if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) return null;
  const total = v.getUint16(fim + 10, true); let p = v.getUint32(fim + 16, true);
  const ficheiros = new Map(), dec = new TextDecoder();
  for (let k = 0; k < total && p + 46 <= b.length; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const nome = dec.decode(b.subarray(p + 46, p + 46 + nl));
    ficheiros.set(nome, async () => {
      const ini = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), dados = b.subarray(ini, ini + comp);
      if (metodo === 0) return dec.decode(dados);
      if (metodo !== 8) throw new Error('compressão não suportada');
      return new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    });
    p += 46 + nl + el + cl;
  }
  return ficheiros;
}
const xml = t => new DOMParser().parseFromString(t, 'application/xml');
const tags = (no, nome) => Array.from(no.getElementsByTagNameNS('*', nome));
function coluna(ref) { let c = 0; for (const ch of String(ref || '').replace(/\d/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; }

/** Lê um .xlsx. Devolve { folhas: [{ nome, linhas }] } ou { erro }. */
export async function lerXLSX(buf) {
  try {
    if (!buf || buf.byteLength < 22) return { erro: 'O ficheiro está vazio ou não é um Excel (.xlsx).' };
    const zip = await lerZip(buf);
    if (!zip || !zip.has('xl/workbook.xml')) return { erro: 'O ficheiro não é um Excel (.xlsx). Ficheiros .xls antigos têm de ser guardados como .xlsx.' };
    const partilhadas = zip.has('xl/sharedStrings.xml')
      ? tags(xml(await zip.get('xl/sharedStrings.xml')()), 'si').map(si => tags(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join('')) : [];
    const nomes = tags(xml(await zip.get('xl/workbook.xml')()), 'sheet').map(s => s.getAttribute('name'));
    const caminhos = [...zip.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    const folhas = [];
    for (let i = 0; i < caminhos.length; i++) {
      const linhas = [];
      for (const row of tags(xml(await zip.get(caminhos[i])()), 'row')) {
        if (linhas.length >= MAX_LINHAS) break;
        const l = [];
        for (const c of tags(row, 'c')) {
          const tipo = c.getAttribute('t'), vEl = tags(c, 'v')[0], bruto = vEl ? vEl.textContent : '';
          let valor;
          if (tipo === 's') valor = partilhadas[+bruto] ?? '';
          else if (tipo === 'inlineStr') valor = tags(c, 't').map(t => t.textContent).join('');
          else if (tipo === 'str' || tipo === 'b' || tipo === 'e') valor = bruto;
          else valor = bruto !== '' && Number.isFinite(+bruto) ? +bruto : bruto;
          const ci = coluna(c.getAttribute('r'));
          l[ci >= 0 ? ci : l.length] = valor;
        }
        linhas.push(Array.from(l, x => x ?? ''));
      }
      folhas.push({ nome: nomes[i] || `Folha ${i + 1}`, linhas });
    }
    return folhas.length ? { folhas } : { erro: 'O Excel não tem folhas.' };
  } catch (e) { return { erro: 'Não foi possível ler este Excel.' }; }
}

// ---------- linhas do articulado ----------
const UNIDADE = /^(m|ml|m\.l\.?|m2|m²|m3|m³|un|und|unid|vg|v\.g\.?|kg|ton|t|cj|conj|h|dia|l|pç|pc)\.?$/i;
function numero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const x = Number(s); return Number.isFinite(x) ? x : null;
}
/** Linhas de uma folha → [{ art, desc, un, qtd }]. Procura o cabeçalho; se não houver, adivinha as colunas. */
export function extrairLinhas(linhas, { exigirCabecalho = false } = {}) {
  const rows = (Array.isArray(linhas) ? linhas : []).map(r => (Array.isArray(r) ? r : []).map(c => (typeof c === 'number' ? c : String(c ?? '').trim())));
  let cab = -1, col = {};
  for (let i = 0; i < Math.min(rows.length, 40) && cab < 0; i++) {
    const c = rows[i].map(semAcentos), d = c.findIndex(x => /desig|descri/.test(x));
    if (d < 0) continue;
    const q = c.findIndex(x => /quant|qtd/.test(x)), u = c.findIndex(x => /^(un|unid)/.test(x));
    if (q < 0 && u < 0) continue;
    cab = i; col = { desc: d, qtd: q, un: u, art: c.findIndex((x, k) => k !== d && /^(art|item|n\.?[ºo°]?$|cod|ref|cap)/.test(x)) };
  }
  let corpo = rows.slice(cab + 1);
  if (cab < 0 && exigirCabecalho) return [];
  if (cab < 0) {
    corpo = rows.filter(r => r.some(c => c !== ''));
    if (!corpo.length) return [];
    const nc = Math.max(...corpo.map(r => r.length)), media = k => corpo.reduce((s, r) => s + (typeof r[k] === 'string' ? r[k].length : 0), 0) / corpo.length;
    const parte = (k, f) => corpo.filter(r => r[k] !== '' && r[k] !== undefined && f(r[k])).length / corpo.length;
    const cols = Array.from({ length: nc }, (_, k) => k);
    const desc = cols.sort((a, b) => media(b) - media(a))[0];
    const resto = Array.from({ length: nc }, (_, k) => k).filter(k => k !== desc);
    const un = resto.find(k => parte(k, v => UNIDADE.test(String(v))) > 0.5) ?? -1;
    const qtd = [...resto].reverse().find(k => k !== un && k > desc && parte(k, v => numero(v) !== null) > 0.5) ?? -1;
    const art = resto.find(k => k < desc && k !== un && k !== qtd) ?? -1;
    if (media(desc) < 4) return [];
    col = { desc, un, qtd, art };
  }
  const out = [];
  for (const r of corpo) {
    const desc = String(r[col.desc] ?? '').trim();
    if (!desc) continue;
    out.push({ art: col.art >= 0 ? String(r[col.art] ?? '').trim() : '', desc: desc.slice(0, 600), un: col.un >= 0 ? String(r[col.un] ?? '').trim() : '', qtd: col.qtd >= 0 ? numero(r[col.qtd]) : null });
    if (out.length >= MAX_LINHAS) break;
  }
  return out;
}

/** 'guarda' | 'corrimao' | 'portao' | 'outro' (serralharia sem modelo na app) | null (não é serralharia). */
export function classificar(desc) {
  const t = semAcentos(desc);
  if (!t.trim()) return null;
  // Guarda, corrimão e portão: ganha o que aparece primeiro no texto («guarda ... incluindo corrimão» é uma guarda).
  const limpo = t.replace(/guarda[- ]?(vento|fatos?|roupas?|lamas|po|chuva|rodas|sol|fogo)/g, m => ' '.repeat(m.length));
  const onde = re => { const m = limpo.match(re); return m ? m.index : Infinity; };
  const pos = { portao: onde(/\bportao\b|\bportoes\b/), corrimao: onde(/corrim/), guarda: onde(/\bguardas?\b|guarda[- ]?corpos|balaustrada/) };
  const primeiro = Object.keys(pos).sort((a, b) => pos[a] - pos[b])[0];
  if (pos[primeiro] !== Infinity) return primeiro;
  if (/tubagem|tubagens|\bcondutas?\b/.test(t)) return 'tubagem';
  if (/serralh|gradeament|\bgrades?\b|\binox\b|ferro forjado|estrutura metalica|estruturas metalicas|escada metalica|perfis metalicos|chapa (de |em )?(aco|ferro|inox|aluminio)|tubagem em (aco|ferro|inox)|\bconduta|tampa metalica|pala metalica|pergola metalica|vedacao metalica|rede metalica|caixilharia (de |em )?(ferro|aco)/.test(t)) return 'outro';
  return null;
}

/** Medidas iniciais de um trabalho a partir de uma linha em metros. */
export function medidasDeLinha(l, tipo) {
  const un = semAcentos(l && l.un).replace(/\./g, ''), q = l && l.qtd;
  if (!/^(m|ml)$/.test(un) || !(q > 0)) return {};
  const comp = Math.round(q * 1000);
  if (tipo === 'guarda') return { trocos: [{ comp, desnivel: 0, viragem: 0 }] };
  if (tipo === 'corrimao') return { comp };
  if (tipo === 'tubagem') return { trocos: [{ comp, dir: 'dir', tes: 0 }] };
  return {};
}

/**
 * Linhas de todas as folhas de um Excel. Se alguma folha tiver cabeçalho de articulado, só essas contam
 * (capas e folhas de notas ficam de fora); se nenhuma tiver, tenta adivinhar as colunas em todas.
 */
export function extrairDeFolhas(folhas) {
  const lista = Array.isArray(folhas) ? folhas : [];
  const comCab = lista.flatMap(f => extrairLinhas(f.linhas, { exigirCabecalho: true }));
  return comCab.length ? comCab : lista.flatMap(f => extrairLinhas(f.linhas));
}
