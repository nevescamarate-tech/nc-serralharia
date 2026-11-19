// Verificação simples (pré-dimensionamento) das peças principais: flexão, flecha e encurvadura.
// Unidades internas: N e mm. Não cobre ligações, fixações, fundações, vento nem estabilidade de conjunto.
import { PERFIS, MATERIAIS, area } from './catalogo.js';

const ACO = { fy: 235, E: 210000, gM: 1.0 };
const MAT = { aco: ACO, inox304: { fy: 210, E: 200000, gM: 1.1 }, inox316: { fy: 220, E: 200000, gM: 1.1 }, aluminio: { fy: 110, E: 70000, gM: 1.1 } };
const G_Q = 1.5, G_G = 1.35;                       // coeficientes das ações variáveis e permanentes
export const CARGAS_GUARDA = [['0.5', '0,5 kN/m — habitação'], ['1', '1,0 kN/m — edifícios públicos e comércio'], ['3', '3,0 kN/m — locais com multidões']];
export const DEF_VERIF = { guarda: 0.5, cobertura: 1, escada: 3 };   // guarda: habitação por omissão; escolhe-se no ecrã

/** Propriedades da secção em flexão, com h = dimensão na direção da carga e b = largura. */
export function seccao(perfilId, h, b, fy = 235) {
  const p = PERFIS[perfilId];
  if (!p) return null;
  const eps = Math.sqrt(235 / fy);
  if (p.forma === 'tr' || p.forma === 'tu') {
    const D = p.d, d = D - 2 * p.e, I = Math.PI / 64 * (D ** 4 - d ** 4);
    return { A: Math.PI / 4 * (D * D - d * d), I, Wel: I / (D / 2), Wpl: (D ** 3 - d ** 3) / 6, plastica: D / p.e <= 50 * eps * eps };
  }
  if (p.forma === 'varao') { const D = p.d, I = Math.PI * D ** 4 / 64; return { A: Math.PI * D * D / 4, I, Wel: I / (D / 2), Wpl: D ** 3 / 6, plastica: true }; }
  if (p.forma === 'tq' || p.forma === 'tret') {
    const e = p.e, hi = h - 2 * e, bi = b - 2 * e, I = (b * h ** 3 - bi * hi ** 3) / 12;
    return { A: b * h - bi * hi, I, Wel: I / (h / 2), Wpl: (b * h * h - bi * hi * hi) / 4, plastica: (Math.max(b, h) - 3 * e) / e <= 33 * eps };
  }
  const I = b * h ** 3 / 12;                       // barra chata e varão quadrado: secção cheia
  return { A: b * h, I, Wel: I / (h / 2), Wpl: b * h * h / 4, plastica: true };
}
const kNm = M => M / 1e6, arred = (v, c = 2) => Math.round(v * 10 ** c) / 10 ** c;

function flexao(elemento, peca, h, b, M, flecha, limite, mat, exigeFlecha, comoPassa) {
  const s = seccao(peca.perfil, h, b, mat.fy);
  if (!s) return null;
  const MRd = (s.plastica ? s.Wpl : s.Wel) * mat.fy / mat.gM, ratio = M / MRd, f = flecha(s.I);
  const linha = { elemento, perfil: (PERFIS[peca.perfil] || {}).nome || peca.perfil, perfilId: peca.perfil, esforco: `M = ${arred(kNm(M)).toFixed(2).replace('.', ',')} kNm`,
    ratio: arred(ratio), flecha: arred(f, 1), limite: arred(limite, 1), flechaOk: f <= limite, ok: ratio <= 1 && (!exigeFlecha || f <= limite) };
  if (!linha.ok && comoPassa) linha.sugestao = sugerir(peca.perfil, comoPassa);
  return linha;
}
/** Primeiro perfil da mesma família (por peso crescente) que passa na função dada. */
function sugerir(perfilId, passa) {
  const p = PERFIS[perfilId]; if (!p) return '';
  const familia = Object.values(PERFIS).filter(q => q.forma === p.forma).sort((x, y) => area(x) - area(y));
  const melhor = familia.find(q => passa(q.id));
  return melhor ? melhor.nome : 'nenhum perfil desta família chega: mudar de família ou reduzir o vão';
}
const dimsDe = (id, rodar) => { const p = PERFIS[id]; if (!p) return [0, 0]; const a = p.a || p.d, b = p.b || p.a || p.d; return rodar ? [b, a] : [a, b]; };

/** Consola (prumo ou barra de guarda) com carga horizontal q (N/mm) no topo, numa largura de influência s. */
function consola(elemento, peca, h, b, q, s, alt, mat) {
  const P = q * s, passa = id => { const [x, y] = dimsDe(id, h < b); const z = seccao(id, x, y, mat.fy); return z && G_Q * P * alt <= (z.plastica ? z.Wpl : z.Wel) * mat.fy / mat.gM; };
  return flexao(elemento, peca, h, b, G_Q * P * alt, I => P * alt ** 3 / (3 * mat.E * I), alt / 65, mat, false, passa);
}
/** Viga simplesmente apoiada com carga uniforme: w de cálculo e ws de serviço (N/mm), vão L. */
function viga(elemento, peca, h, b, w, ws, L, mat) {
  const passa = id => { const [x, y] = dimsDe(id, false); const z = seccao(id, x, y, mat.fy); return z && w * L * L / 8 <= (z.plastica ? z.Wpl : z.Wel) * mat.fy / mat.gM && 5 * ws * L ** 4 / (384 * mat.E * z.I) <= L / 200; };
  return flexao(elemento, peca, h, b, w * L * L / 8, I => 5 * ws * L ** 4 / (384 * mat.E * I), L / 200, mat, true, passa);
}
/** Pilar comprimido com encurvadura (curva c), comprimento de encurvadura Le. */
function pilar(elemento, peca, N, Le, mat) {
  const calc = id => { const [a] = dimsDe(id, false); const z = seccao(id, a, a, mat.fy); if (!z) return null;
    const i = Math.sqrt(z.I / z.A), lam = Le / i / (Math.PI * Math.sqrt(mat.E / mat.fy)), fi = 0.5 * (1 + 0.49 * (lam - 0.2) + lam * lam);
    return { NRd: Math.min(1, 1 / (fi + Math.sqrt(Math.max(0, fi * fi - lam * lam)))) * z.A * mat.fy / mat.gM, lam }; };
  const c = calc(peca.perfil); if (!c) return null;
  const ratio = N / c.NRd, ok = ratio <= 1 && c.lam <= 2;
  return { elemento, perfil: (PERFIS[peca.perfil] || {}).nome || peca.perfil, perfilId: peca.perfil, esforco: `N = ${arred(N / 1000, 1).toFixed(1).replace('.', ',')} kN`, ratio: arred(ratio), esbelteza: arred(c.lam), ok,
    ...(ok ? {} : { sugestao: sugerir(peca.perfil, id => { const x = calc(id); return x && N <= x.NRd && x.lam <= 2; }) }) };
}
/** Maior largura de influência entre montantes verticais (metade do vão de cada lado). */
function influencia(xs, total) {
  const o = [...new Set(xs.map(x => Math.round(x)))].sort((a, b) => a - b);
  if (o.length < 2) return total || 0;
  let m = 0;
  for (let i = 0; i < o.length; i++) m = Math.max(m, ((i ? o[i] - o[i - 1] : 0) + (i < o.length - 1 ? o[i + 1] - o[i] : 0)) / 2);
  return m;
}

/**
 * Verifica as peças principais do trabalho. Devolve { cargas, linhas, notas, ok } ou null se o tipo não tiver verificação.
 * trabalho.verif: { guarda: kN/m no corrimão, cobertura: kN/m² em planta, escada: kN/m² no lanço }.
 */
export function verificar(trabalho, res) {
  if (!res || !res.pecas || !res.pecas.length) return null;
  const mat = MAT[trabalho.material] || ACO, v = { ...DEF_VERIF, ...(trabalho.verif || {}) }, de = g => res.pecas.filter(p => p.grupo === g);
  const num = (x, d) => (Number.isFinite(+x) && +x > 0 ? +x : d), linhas = [], cargas = [];
  const notas = [`Material: ${(MATERIAIS[trabalho.material] || MATERIAIS.aco).nome}, tensão de cedência ${mat.fy} MPa. Ações variáveis × ${String(G_Q).replace('.', ',')}; permanentes × ${String(G_G).replace('.', ',')}.`];
  const junta = l => { if (l) linhas.push(l); };
  const tipo = trabalho.tipo, qG = num(v.guarda, DEF_VERIF.guarda);

  if (tipo === 'guarda' || tipo === 'gradeamento') {
    const pr = de('prumo'); if (!pr.length) return null;
    cargas.push(`Carga horizontal no topo: ${String(qG).replace('.', ',')} kN/m`);
    junta(consola('Prumo (o mais carregado)', pr[0], pr[0].p, pr[0].t, qG, influencia(pr.map(p => p.s[0]), res.comprimentoTotal), res.altura, mat));
    notas.push('O prumo trabalha em consola a partir da fixação; a fixação e o suporte não estão verificados.');
  } else if (tipo === 'guardamuro') {
    const b = de('varao'); if (!b.length) return null;
    cargas.push(`Carga horizontal no topo: ${String(qG).replace('.', ',')} kN/m`);
    junta(consola('Barra vertical', b[0], b[0].p, b[0].t, qG, res.guardaMuro.passo, res.altura, mat));
    notas.push('Cada barra trabalha em consola a partir do grout; o rasgo, o grout e as abas do muro não estão verificados.');
  } else if (tipo === 'telheiro') {
    const q = num(v.cobertura, DEF_VERIF.cobertura) / 1000, g = 0.15 / 1000, w = G_G * g + G_Q * q, ws = g + q;
    cargas.push(`Sobrecarga em planta (neve ou uso): ${String(num(v.cobertura, DEF_VERIF.cobertura)).replace('.', ',')} kN/m²`, 'Peso da cobertura considerado: 0,15 kN/m²');
    const vg = de('viga'), xs = [...new Set(vg.map(p => Math.round(p.a[0])))].sort((a, b) => a - b), vao = xs.length > 1 ? Math.max(...xs.slice(1).map((x, i) => x - xs[i])) : res.comprimentoTotal;
    const md = de('madre').concat(de('ripa'));
    if (md.length) { const zs = [...new Set(md.map(p => Math.round(p.a[2])))].sort((a, b) => a - b), af = zs.length > 1 ? Math.max(...zs.slice(1).map((z, i) => z - zs[i])) : res.largura;
      junta(viga(md[0].grupo === 'ripa' ? 'Ripa' : 'Madre', md[0], md[0].t, md[0].p, w * af, ws * af, vao, mat)); }
    if (vg.length) junta(viga(res.aguas === 2 ? 'Viga (meia largura)' : 'Viga', vg[0], vg[0].t, vg[0].p, w * vao, ws * vao, res.aguas === 2 ? res.largura / 2 : res.largura, mat));
    const pl = de('pilar');
    if (pl.length) junta(pilar('Pilar', pl[0], w * vao * (res.largura + 400) / 2, 2 * Math.max(...pl.map(p => p.L)), mat));
    if (res.aguas === 2) notas.push('Duas águas: cada viga é verificada entre o pilar e a cumeeira; a linha entre pilares, que segura o impulso, não está verificada.');
    notas.push('Vigas e madres como simplesmente apoiadas. Pilar com comprimento de encurvadura igual a 2 × a altura (sem contraventamento).', 'O vento (incluindo a sucção, que levanta a cobertura) não está considerado.');
  } else if (tipo === 'escada') {
    const q = num(v.escada, DEF_VERIF.escada) / 1000, g = 0.5 / 1000, bz = de('banzo'); if (!bz.length) return null;
    const larg = res.escada.central ? res.largura : res.largura / 2, L = res.escada.avanco || res.comprimentoTotal - (res.escada.patamar || 0);
    cargas.push(`Sobrecarga no lanço: ${String(num(v.escada, DEF_VERIF.escada)).replace('.', ',')} kN/m²`, 'Peso próprio considerado: 0,5 kN/m²');
    junta(viga(res.escada.central ? 'Viga central' : 'Banzo', bz[0], bz[0].t, bz[0].p, (G_G * g + G_Q * q) * larg, (g + q) * larg, L, mat));
    const ba = de('varao');
    if (ba.length) { cargas.push(`Carga horizontal na guarda: ${String(qG).replace('.', ',')} kN/m`);
      const xs = ba.filter(p => p.a[2] === ba[0].a[2]).map(p => p.s[0]).sort((a, b) => a - b), passoG = xs.length > 1 ? xs[1] - xs[0] : 100;
      junta(consola('Barra da guarda', ba[0], ba[0].p, ba[0].t, qG, passoG, Math.max(...ba.map(p => p.L)), mat)); }
    notas.push('Banzo como viga simplesmente apoiada no vão horizontal do lanço. Degraus, patamar e apoios não estão verificados.');
  } else return null;
  if (!linhas.length) return null;
  notas.push('Pré-dimensionamento indicativo: não verifica ligações, soldaduras, fixações nem fundações, e não substitui o cálculo por técnico habilitado.');
  return { cargas, linhas, notas, ok: linhas.every(l => l.ok) };
}
