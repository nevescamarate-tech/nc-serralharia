// Gradeamento de muro: módulos iguais entre prumos, com travessas e varões verticais ou barras horizontais.
import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, arred, vazio, peca, sacoAcessorios, repartirVaroes } from './util.js';

export const DEF_GRADEAMENTO = {
  comp: '', altura: 1200, fixacao: 'chumbado', enchimento: 'varoes',
  pPrumo: 'tq50x2', pTravessa: 'tret40x20x2', pVarao: 'vq12',
  maxPrumos: 2000, vaoMax: 110, baixo: 80, topo: 100, pontas: 0, nBarras: 6,
};
const perfilOu = (id, def) => (PERFIS[id] ? id : def);
const CHUMBAR = 150;

export function calcGradeamento(medidas = {}) {
  const m = { ...DEF_GRADEAMENTO, ...medidas };
  const L = num(m.comp, 0), H = num(m.altura, DEF_GRADEAMENTO.altura);
  if (!L) return vazio(['Introduza o comprimento do gradeamento.']);
  if (L > 200000 || H > 4000) return vazio([`Gradeamento de ${L} mm com ${H} mm de altura é demasiado grande; confirme as medidas (em mm).`]);
  const pPrumo = perfilOu(m.pPrumo, DEF_GRADEAMENTO.pPrumo), pTrav = perfilOu(m.pTravessa, DEF_GRADEAMENTO.pTravessa), pVar = perfilOu(m.pVarao, DEF_GRADEAMENTO.pVarao);
  const aP = dims(pPrumo).a, dT = dims(pTrav), tT = dT.b, profT = dT.a, dV = dims(pVar).a;   // travessa deitada
  const baixo = Math.max(0, numLivre(m.baixo)), topo = Math.max(0, numLivre(m.topo)), pontas = Math.min(400, Math.max(0, numLivre(m.pontas)));
  if (L < 4 * aP || H < baixo + topo + 2 * tT + 100) return vazio([`Medidas demasiado pequenas para um gradeamento (${L} × ${H} mm).`]);
  const max = Math.max(300, num(m.maxPrumos, DEF_GRADEAMENTO.maxPrumos)), vaoMax = Math.max(20, num(m.vaoMax, DEF_GRADEAMENTO.vaoMax));
  const nBarras = Math.min(40, Math.max(1, Math.round(num(m.nBarras, DEF_GRADEAMENTO.nBarras))));
  const sapata = m.fixacao === 'sapata', desce = sapata ? 0 : CHUMBAR, barras = m.enchimento === 'barras';

  const r = vazio(), ac = sacoAcessorios();
  const lin = (grupo, perfil, x1, y1, x2, y2, o) => r.pecas.push(peca(grupo, perfil, [x1, y1, 0], [x2, y2, 0], [x1, y1, x2, y2], o));
  const n = reparte(L - aP, max), passo = (L - aP) / n, xs = Array.from({ length: n + 1 }, (_, k) => aP / 2 + k * passo);
  for (const x of xs) {
    lin('prumo', pPrumo, x, -desce, x, H);
    if (sapata) { r.pontos.push({ tipo: 'sapata', p: [x, 0, 0], s: [x, 0] }); ac.junta('sapata'); ac.junta('bucha', 4); }
    ac.junta('tampa'); r.ligacoes += 1;
  }
  const yB = baixo + tT / 2, yT = H - topo - tT / 2;
  for (let k = 0; k < n; k++) {
    const ua = xs[k] + aP / 2, ub = xs[k + 1] - aP / 2, livre = ub - ua;
    if (livre <= 0) continue;
    if (barras) {
      for (let j = 0; j < nBarras; j++) { const y = baixo + (H - topo - baixo) * (nBarras === 1 ? 0.5 : j / (nBarras - 1)); lin('barra', pVar, ua, y, ub, y); r.ligacoes += 2; }
    } else {
      lin('travessa', pTrav, ua, yB, ub, yB, { t: tT, p: profT }); lin('travessa', pTrav, ua, yT, ub, yT, { t: tT, p: profT }); r.ligacoes += 4;
      const { n: nv, folga } = repartirVaroes(livre, dV, vaoMax);
      // sem pontas, o varão fica entre as travessas; com pontas, atravessa a de cima e sobe
      const y1 = baixo + tT, y2 = pontas > 0 ? H - topo + pontas : H - topo - tT;
      for (let j = 0; j < nv; j++) { const x = ua + folga * (j + 1) + dV * (j + 0.5); lin('varao', pVar, x, y1, x, y2); r.ligacoes += 2; }
      r.vaos.push({ livre: arred(livre), n: nv, folga: arred(folga) });
    }
    r.cotas.push({ tipo: 'h', nivel: 1, s1: xs[k], s2: xs[k + 1], texto: String(Math.round(passo)) });
  }
  if (pontas > 0 && !barras) r.avisos.push('Varões com pontas: a travessa de cima é furada para os varões passarem.');
  if (!sapata) r.avisos.push(`Prumos chumbados ${CHUMBAR} mm no muro: prever os negativos ou a carotagem.`);
  r.cotas.push({ tipo: 'h', nivel: 2, s1: 0, s2: L, texto: String(Math.round(L)) }, { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.trocosPlanta.push({ a: [0, 0], b: [L, 0], texto: String(Math.round(L)) });
  r.acessorios = ac.lista();
  r.altura = H; r.comprimentoTotal = L; r.modulos = n;
  return r;
}
