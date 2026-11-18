// Leitor de desenhos DXF (texto). Devolve entidades simples, já com os blocos expandidos.

const UNIDADES_MM = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };   // $INSUNITS → mm
const MAX_ENTIDADES = 200000, MAX_PROF = 8;
const ERRO_DWG = 'Este ficheiro é um DWG. Abra-o no programa de desenho e use «Guardar como» DXF, ou converta-o com o ODA File Converter (gratuito), e carregue o DXF.';

/** Verdadeiro se o ficheiro for um DWG (pelo nome ou pelos primeiros bytes «AC10xx»). */
export function eDWG(nome, bytes) {
  if (/\.dwg$/i.test(nome || '')) return true;
  const cab = String.fromCharCode(...Array.from((bytes || []).slice(0, 6)));
  return /^AC\d{4}/.test(cab);
}

/** Converte os bytes do ficheiro em texto, respeitando a página de códigos dos DXF antigos. */
export function textoDeBytes(bytes) {
  const utf = new TextDecoder('utf-8').decode(bytes);
  const ver = (utf.match(/\$ACADVER\s+1\s+AC(\d{4})/) || [])[1];
  if (ver && +ver < 1021) { try { return new TextDecoder('windows-1252').decode(bytes); } catch (e) { /* fica utf-8 */ } }
  return utf;
}

const n = (v, def = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : def; };
// Transformação afim [a,b,c,d,e,f]: x' = a·x + c·y + e ; y' = b·x + d·y + f
const IDENT = [1, 0, 0, 1, 0, 0];
const aplica = (T, x, y) => [T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]];
const compoe = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const escalaDe = T => Math.sqrt(Math.abs(T[0] * T[3] - T[1] * T[2])) || 1;

function arcoPts(x, y, r, a1, a2, seg = 32) {
  if (a2 <= a1) a2 += 360;
  const k = Math.max(4, Math.ceil(seg * (a2 - a1) / 360)), pts = [];
  for (let i = 0; i <= k; i++) { const a = (a1 + (a2 - a1) * i / k) * Math.PI / 180; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  return pts;
}
function limpaMTexto(t) {
  return String(t).replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;\\]*;/g, '').replace(/\\[LlOoKk~]/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

export function lerDXF(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return { erro: 'O ficheiro está vazio.' };
  if (/^AC\d{4}/.test(texto)) return { erro: ERRO_DWG };
  if (texto.startsWith('AutoCAD Binary DXF')) return { erro: 'Este DXF é binário. Guarde-o como DXF de texto (ASCII) e volte a carregar.' };
  const lin = texto.split(/\r\n|\r|\n/);
  // Registos: cada um começa num código 0.
  const recs = []; let atual = null, maus = 0;
  for (let i = 0; i + 1 < lin.length; i += 2) {
    const c = parseInt(lin[i], 10), v = lin[i + 1];
    if (!Number.isFinite(c)) { if (++maus > 20) break; continue; }
    if (c === 0) { atual = { tipo: v.trim().toUpperCase(), g: [] }; recs.push(atual); }
    else if (atual) atual.g.push([c, v]);
  }
  if (!recs.some(r => r.tipo === 'SECTION')) return { erro: 'O ficheiro não é um desenho DXF.' };

  const val = (r, c) => { const p = r.g.find(x => x[0] === c); return p ? p[1].trim() : undefined; };
  let seccao = null, bloco = null, fatorMM = null;
  const blocos = new Map(), topo = [], tabela = new Map();
  for (const r of recs) {
    if (r.tipo === 'SECTION') {
      seccao = (val(r, 2) || '').toUpperCase();
      if (seccao === 'HEADER') {
        const i = r.g.findIndex(x => x[0] === 9 && x[1].trim() === '$INSUNITS');
        if (i >= 0 && r.g[i + 1]) fatorMM = UNIDADES_MM[parseInt(r.g[i + 1][1], 10)] || null;
      }
      continue;
    }
    if (r.tipo === 'ENDSEC') { seccao = null; continue; }
    if (seccao === 'TABLES' && r.tipo === 'LAYER') tabela.set(val(r, 2), !(n(val(r, 62), 7) < 0 || (n(val(r, 70)) & 1)));
    else if (seccao === 'BLOCKS') {
      if (r.tipo === 'BLOCK') { bloco = { base: [n(val(r, 10)), n(val(r, 20))], recs: [] }; blocos.set(val(r, 2), bloco); }
      else if (r.tipo === 'ENDBLK') bloco = null;
      else if (bloco) bloco.recs.push(r);
    } else if (seccao === 'ENTITIES') topo.push(r);
  }

  const out = []; let cortado = false;
  function converte(lista, T, camadaPai, prof, pilha) {
    const comT = T !== IDENT;
    for (let i = 0; i < lista.length; i++) {
      if (out.length >= MAX_ENTIDADES) { cortado = true; return; }
      const r = lista[i];
      if (prof === 0 && n(val(r, 67)) === 1) continue;   // espaço de papel
      let camada = val(r, 8) || '0';
      if (camada === '0' && camadaPai) camada = camadaPai;
      const P = (x, y) => (comT ? aplica(T, x, y) : [x, y]);
      const poli = (pts, fechada) => { if (pts.length > 1) out.push({ tipo: 'poli', camada, pts: pts.map(p => P(p[0], p[1])), fechada: !!fechada }); };
      switch (r.tipo) {
        case 'LINE': {
          const [x1, y1] = P(n(val(r, 10)), n(val(r, 20))), [x2, y2] = P(n(val(r, 11)), n(val(r, 21)));
          out.push({ tipo: 'linha', camada, x1, y1, x2, y2 }); break;
        }
        case 'LWPOLYLINE': case 'SPLINE': {
          const pts = []; let x = null;
          for (const [c, v] of r.g) { if (c === 10) x = n(v); else if (c === 20 && x !== null) { pts.push([x, n(v)]); x = null; } }
          poli(pts, r.tipo === 'LWPOLYLINE' && (n(val(r, 70)) & 1)); break;
        }
        case 'POLYLINE': {
          const pts = [];
          while (i + 1 < lista.length && lista[i + 1].tipo === 'VERTEX') { i++; pts.push([n(val(lista[i], 10)), n(val(lista[i], 20))]); }
          if (i + 1 < lista.length && lista[i + 1].tipo === 'SEQEND') i++;
          poli(pts, n(val(r, 70)) & 1); break;
        }
        case 'CIRCLE': {
          const x = n(val(r, 10)), y = n(val(r, 20)), raio = n(val(r, 40));
          if (comT) poli(arcoPts(x, y, raio, 0, 360), true); else out.push({ tipo: 'circulo', camada, x, y, r: raio }); break;
        }
        case 'ARC': {
          const x = n(val(r, 10)), y = n(val(r, 20)), raio = n(val(r, 40)), a1 = n(val(r, 50)), a2 = n(val(r, 51));
          if (comT) poli(arcoPts(x, y, raio, a1, a2), false); else out.push({ tipo: 'arco', camada, x, y, r: raio, a1, a2 }); break;
        }
        case 'ELLIPSE': {
          const cx = n(val(r, 10)), cy = n(val(r, 20)), mx = n(val(r, 11)), my = n(val(r, 21)), q = n(val(r, 40), 1);
          const t1 = n(val(r, 41)), t2 = n(val(r, 42), Math.PI * 2), pts = [];
          for (let k = 0; k <= 48; k++) { const t = t1 + (t2 - t1) * k / 48, c = Math.cos(t), s = Math.sin(t); pts.push([cx + mx * c - my * q * s, cy + my * c + mx * q * s]); }
          poli(pts, false); break;
        }
        case 'TEXT': case 'MTEXT': {
          const bruto = r.g.filter(x => x[0] === 3).map(x => x[1]).join('') + (val(r, 1) || '');
          const t = r.tipo === 'MTEXT' ? limpaMTexto(bruto) : bruto.trim();
          if (!t) break;
          const [x, y] = P(n(val(r, 10)), n(val(r, 20)));
          out.push({ tipo: 'texto', camada, x, y, h: n(val(r, 40), 1) * (comT ? escalaDe(T) : 1), t: t.slice(0, 200) }); break;
        }
        case 'INSERT': case 'DIMENSION': {
          const nome = val(r, 2), b = blocos.get(nome);
          if (!b || prof >= MAX_PROF || pilha.includes(nome)) break;
          let M = T;
          if (r.tipo === 'INSERT') {
            const sx = n(val(r, 41), 1), sy = n(val(r, 42), sx), rot = n(val(r, 50)) * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot);
            const local = compoe([c * sx, s * sx, -s * sy, c * sy, n(val(r, 10)), n(val(r, 20))], [1, 0, 0, 1, -b.base[0], -b.base[1]]);
            M = compoe(T, local);
          }
          converte(b.recs, M, camada, prof + 1, [...pilha, nome]); break;
        }
        default: break;   // HATCH, 3DFACE, etc.: ignorado
      }
    }
  }
  converte(topo, IDENT, null, 0, []);
  if (!out.length) return { erro: 'O desenho não tem linhas que a app saiba ler.' };

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ve = (x, y) => { if (!Number.isFinite(x) || !Number.isFinite(y)) return; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  const usadas = new Map();
  for (const e of out) {
    usadas.set(e.camada, (usadas.get(e.camada) || 0) + 1);
    if (e.tipo === 'linha') { ve(e.x1, e.y1); ve(e.x2, e.y2); }
    else if (e.tipo === 'poli') for (const p of e.pts) ve(p[0], p[1]);
    else if (e.tipo === 'texto') ve(e.x, e.y);
    else { ve(e.x - e.r, e.y - e.r); ve(e.x + e.r, e.y + e.r); }
  }
  const camadas = [...usadas].map(([nome, total]) => ({ nome, total, visivel: tabela.get(nome) !== false })).sort((a, b) => a.nome.localeCompare(b.nome));
  return { entidades: out, camadas, limites: { x0, y0, x1, y1 }, fatorMM, cortado };
}

/**
 * Pontos medidos no desenho → troços de guarda. fator converte unidades do desenho em mm.
 * Viragem positiva = para a direita (no desenho, Y cresce para cima).
 */
export function trocosDeMedicao(pts, fator) {
  const trocos = []; let rumoAnt = null;
  for (let i = 1; i < (pts || []).length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], comp = Math.round(Math.hypot(dx, dy) * fator);
    if (!(comp > 0)) continue;
    const rumo = Math.atan2(dy, dx) * 180 / Math.PI;
    let v = rumoAnt === null ? 0 : -(rumo - rumoAnt);
    while (v > 180) v -= 360; while (v <= -180) v += 360;
    trocos.push({ comp, desnivel: 0, viragem: Math.round(v * 10) / 10 || 0 });
    rumoAnt = rumo;
  }
  return trocos;
}

/**
 * Pontos medidos numa planta → troços de tubagem. Cada segmento vai para o eixo mais próximo:
 * +X do desenho = direita, +Y do desenho = frente. Subidas e descidas juntam-se depois à mão.
 */
export function trocosDeTubagem(pts, fator) {
  const trocos = [];
  for (let i = 1; i < (pts || []).length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], comp = Math.round(Math.hypot(dx, dy) * fator);
    if (!(comp > 0)) continue;
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'dir' : 'esq') : (dy >= 0 ? 'frente' : 'tras');
    trocos.push({ comp, dir, tes: 0 });
  }
  return trocos;
}
