// Abrigo em quadro: base, 4 pilares, quadro de topo com pendente, travessas a meia altura, porta,
// piso em chapa lacrimada, paredes em chapa trapezoidal e cobertura. x = comprimento, z = largura (0 = frente), y = altura.
import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, arred, vazio, peca, sacoAcessorios } from './util.js';

export const DEF_ABRIGO = {
  comp: 2400, largura: 2000, altura: 2400, pendente: 5, pes: 150,
  porta: true, portaL: 900, portaH: 2000, piso: true, revestimento: 'trapezoidal', cobertura: 'sandwich',
  pPilar: 'tq80x4', pBase: 'tret100x50x3', pTopo: 'tq50x2',
};
const perfilOu = (id, def) => (PERFIS[id] ? id : def);
const P_FOLHA = 'tq40x2', FOLGA = 5, CHAPA = 1250, PAINEL = 1000, BEIRAL = 50, MAX_APOIO = 700;
const ESP = { sandwich: 30, trapezoidal: 0.7 };

export function calcAbrigo(medidas = {}) {
  const m = { ...DEF_ABRIGO, ...medidas };
  const L = num(m.comp, DEF_ABRIGO.comp), W = num(m.largura, DEF_ABRIGO.largura), H = num(m.altura, DEF_ABRIGO.altura);
  if (L > 8000 || W > 5000 || H > 4000) return vazio([`Abrigo de ${L}×${W} mm com ${H} mm de altura é demasiado grande; confirme as medidas (em mm).`]);
  if (L < 600 || W < 600 || H < 1200) return vazio([`Medidas demasiado pequenas para um abrigo (${L}×${W} mm, altura ${H} mm).`]);
  const pend = Math.min(30, Math.max(0, numLivre(m.pendente))), tan = pend / 100, cos = 1 / Math.sqrt(1 + tan * tan), graus = arred(Math.atan(tan) * 180 / Math.PI);
  const pPil = perfilOu(m.pPilar, DEF_ABRIGO.pPilar), pBase = perfilOu(m.pBase, DEF_ABRIGO.pBase), pTopo = perfilOu(m.pTopo, DEF_ABRIGO.pTopo);
  const aP = dims(pPil).a, dB = dims(pBase), hB = dB.a, bB = dB.b, hT = dims(pTopo).a, aF = dims(P_FOLHA).a;
  const pes = Math.min(600, Math.max(0, numLivre(m.pes))), yb = pes + hB;
  if (H < yb + 4 * hT + 300 || L < 4 * aP || W < 4 * aP) return vazio([`Medidas demasiado pequenas para estes perfis (${L}×${W} mm, altura ${H} mm).`]);

  const r = vazio(['Estrutura por dimensionar: secções, ligações e, se for para elevar, os olhais têm de ser verificados por técnico habilitado.']);
  const ac = sacoAcessorios();
  // h = dimensão da secção na vertical, w = na horizontal; gera a peça com as projeções frontal (x-y) e lateral (z-y)
  const junta = (grupo, perfil, a, b, h, w, o = {}) => {
    const p = peca(grupo, perfil, a, b, [0, 0, 0, 0], { ...o, t: h, p: w });
    const aoComprido = Math.abs(b[0] - a[0]) > 1, aoLargo = Math.abs(b[2] - a[2]) > 1, y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (aoComprido) { p.s = [a[0], a[1], b[0], b[1]]; p.ts = h; p.sl = [a[2], y0 - h / 2, a[2], y1 + h / 2]; p.tl = w; }
    else if (aoLargo) { p.s = [a[0], y0 - h / 2, a[0], y1 + h / 2]; p.ts = w; p.sl = [a[2], a[1], b[2], b[1]]; p.tl = h; }
    else { p.s = [a[0], a[1], b[0], b[1]]; p.ts = w; p.sl = [a[2], a[1], b[2], b[1]]; p.tl = w; p.t = w; }
    r.pecas.push(p); r.ligacoes += 2; return p;
  };
  const yTopo = z => H - (z - aP / 2) * tan;          // topo da estrutura (cai para trás)
  const xE = aP / 2, xD = L - aP / 2, zF = aP / 2, zT = W - aP / 2;

  for (const [x, z] of [[xE, zF], [xD, zF], [xE, zT], [xD, zT]]) {
    junta('pilar', pPil, [x, 0, z], [x, yTopo(z), z], aP, aP, { ang: [0, graus] });
    r.pontos.push({ tipo: 'sapata', p: [x, 0, z], s: [x, 0], sl: [z, 0], lado: Math.ceil((aP + 120) / 10) * 10 });
    ac.junta('placa_base'); ac.junta('tampa');
  }
  // Base: longarinas e travessas entre pilares, faces de fora alinhadas; intermédias para apoiar o piso
  const yB = pes + hB / 2;
  for (const z of [bB / 2, W - bB / 2]) junta('base', pBase, [aP, yB, z], [L - aP, yB, z], hB, bB);
  for (const x of [bB / 2, L - bB / 2]) junta('base', pBase, [x, yB, aP], [x, yB, W - aP], hB, bB);
  const nI = reparte(W - 2 * aP, MAX_APOIO) - 1;
  for (let k = 1; k <= nI; k++) { const z = aP + k * (W - 2 * aP) / (nI + 1); junta('base', pBase, [bB, yB, z], [L - bB, yB, z], hB, bB); }
  // Quadro de topo: frente e trás de nível, laterais com a pendente, madre a meio
  for (const z of [hT / 2, W - hT / 2]) junta('topo', pTopo, [aP, yTopo(z) - hT / 2, z], [L - aP, yTopo(z) - hT / 2, z], hT, hT);
  for (const x of [hT / 2, L - hT / 2]) junta('topo', pTopo, [x, yTopo(aP) - hT / 2, aP], [x, yTopo(W - aP) - hT / 2, W - aP], hT, hT, { L: (W - 2 * aP) / cos, ang: [graus, graus] });
  if (W > 1500) junta('topo', pTopo, [hT, yTopo(W / 2) - hT / 2, W / 2], [L - hT, yTopo(W / 2) - hT / 2, W / 2], hT, hT);

  // Porta na frente, encostada ao pilar direito
  const pL = num(m.portaL, DEF_ABRIGO.portaL), pH = num(m.portaH, DEF_ABRIGO.portaH), x2 = L - aP, x1 = x2 - pL;
  let comPorta = !!m.porta;
  if (comPorta && (pL < 400 || pH < 800 || x1 - hT < aP + 100 || yb + pH + hT > H - hT)) {
    comPorta = false; r.avisos.push(`A porta de ${pL}×${pH} mm não cabe na frente deste abrigo; ficou sem porta.`);
  }
  // Travessas a meia altura (fixação das chapas)
  const ym = yb + (yTopo(W) - yb) / 2;
  junta('travessa', pTopo, [aP, ym, W - hT / 2], [L - aP, ym, W - hT / 2], hT, hT);
  for (const x of [hT / 2, L - hT / 2]) junta('travessa', pTopo, [x, ym, aP], [x, ym, W - aP], hT, hT);
  junta('travessa', pTopo, [aP, ym, hT / 2], [comPorta ? x1 - hT : L - aP, ym, hT / 2], hT, hT);
  if (comPorta) {
    junta('ombreira', pTopo, [x1 - hT / 2, yb, hT / 2], [x1 - hT / 2, H - hT, hT / 2], hT, hT);
    junta('padieira', pTopo, [x1, yb + pH + hT / 2, hT / 2], [x2, yb + pH + hT / 2, hT / 2], hT, hT);
    const fa = x1 + FOLGA, fb = x2 - FOLGA, f0 = yb + FOLGA, f1 = yb + pH - FOLGA;
    for (const x of [fa + aF / 2, fb - aF / 2]) junta('aro', P_FOLHA, [x, f0, aF / 2], [x, f1, aF / 2], aF, aF);
    for (const y of [f0 + aF / 2, (f0 + f1) / 2, f1 - aF / 2]) junta('aro', P_FOLHA, [fa + aF, y, aF / 2], [fb - aF, y, aF / 2], aF, aF);
    r.paineis.push({ grupo: 'chapa', esp: 2, w: arred(fb - fa), h: arred(f1 - f0), o: [fa, f0, -2], u: [1, 0, 0], dy: 0, s: [fa, f0, fb, f1], frente: true, nota: 'folha da porta' });
    ac.junta('dobradica', 3); ac.junta('fechadura', 1);
    r.cotas.push({ tipo: 'h', nivel: 1, s1: 0, s2: x1, texto: String(Math.round(x1)) }, { tipo: 'h', nivel: 1, s1: x1, s2: x2, texto: String(Math.round(pL)) });
  }
  // Piso em chapa lacrimada, em faixas da largura comercial
  if (m.piso) for (let z = 0; z < W - 0.5; z += CHAPA) {
    const h = arred(Math.min(CHAPA, W - z));
    r.paineis.push({ grupo: 'piso', esp: 4, w: arred(L), h, o: [0, yb, z], u: [1, 0, 0], v: [0, 0, 1], plano: true, sem2d: true, dy: 0, s: [0, yb, L, yb + 4], nota: 'recortes nos pilares' });
  }
  // Paredes em chapa trapezoidal (não se desenham nos alçados, para a estrutura se ver)
  let m2 = 0;
  if (m.revestimento === 'trapezoidal') {
    const parede = (w, h, o, u) => { if (w > 0 && h > 0) { r.paineis.push({ grupo: 'parede', esp: 0.7, w: arred(w), h: arred(h), o, u, dy: 0, sem2d: true, s: [o[0], o[1], o[0] + w * u[0], o[1] + h] }); m2 += w * h / 1e6; } };
    parede(L, yTopo(W) - pes, [0, pes, W + 1], [1, 0, 0]);
    for (const x of [-1, L + 1]) parede(W, yTopo(W / 2) - pes, [x, pes, 0], [0, 0, 1]);
    if (comPorta) { parede(x1, H - pes, [0, pes, -1], [1, 0, 0]); parede(L - x1, H - yb - pH, [x1, yb + pH, -1], [1, 0, 0]); }
    else parede(L, H - pes, [0, pes, -1], [1, 0, 0]);
  }
  // Cobertura em painéis de 1 m, inteiros no sentido da pendente
  const cob = ESP[m.cobertura] ? m.cobertura : null;
  if (cob) {
    const z0 = -BEIRAL, z1 = W + BEIRAL, S = arred((z1 - z0) / cos), xa = -BEIRAL, xb = L + BEIRAL;
    for (let x = xa; x < xb - 0.5; x += PAINEL) {
      const w = arred(Math.min(PAINEL, xb - x));
      r.paineis.push({ grupo: cob, esp: ESP[cob], w, h: S, o: [x, yTopo(z0), z0], u: [1, 0, 0], v: [0, -tan * cos, cos], plano: true, dy: 0,
        s: [x, yTopo(z1), x + w, yTopo(z0) + Math.max(ESP[cob], 20)] });
    }
    m2 += (xb - xa) * S / 1e6;
  }
  if (m2 > 0) ac.junta('parafuso_cob', Math.ceil(m2 * 6));

  r.cotas.push({ tipo: 'h', nivel: 2, s1: 0, s2: L, texto: String(Math.round(L)) }, { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.cotasLateral = [{ tipo: 'h', nivel: 1, s1: 0, s2: W, texto: String(Math.round(W)) }, { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) }];
  r.trocosPlanta.push({ a: [0, 0], b: [L, 0], texto: String(Math.round(L)) }, { a: [0, W], b: [0, 0], texto: String(Math.round(W)) });
  r.acessorios = ac.lista();
  r.altura = H; r.alturaAlta = arred(yTopo(zT)); r.pendente = pend; r.comprimentoTotal = L; r.largura = W; r.abrigo = true;
  return r;
}
