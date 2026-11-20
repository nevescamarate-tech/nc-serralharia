// Grade fixa de janela: aro em meia-esquadria, varões verticais, travessas intermédias e patas de fixação.
import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, arred, vazio, peca, sacoAcessorios, repartirVaroes, ripa, afast } from './util.js';

export const DEF_GRADE = { largura: '', altura: '', qtd: 1, pAro: 'tret40x20x2', pBarra: 'tr20x1.5', vaoMax: 120 };
const perfilOu = (id, def) => (PERFIS[id] ? id : def);
const MAX_TRAVESSA = 1000, MAX_UN = 50;

export function calcGrade(medidas = {}) {
  const m = { ...DEF_GRADE, ...medidas };
  const W = num(m.largura, 0), H = num(m.altura, 0);
  if (!W) return vazio(['Introduza a largura da grade.']);
  if (!H) return vazio(['Introduza a altura da grade.']);
  if (W > 6000 || H > 4000) return vazio([`Grade de ${W}×${H} mm demasiado grande; confirme as medidas (em mm).`]);
  const pAro = perfilOu(m.pAro, DEF_GRADE.pAro), pBar = perfilOu(m.pBarra, DEF_GRADE.pBarra);
  const dA = dims(pAro), tA = dA.b, profA = dA.a, fB = ripa(pBar, m.posicao), dB = fB.t;   // aro deitado: de frente vê-se a face menor
  const deitada = m.sentido === 'horizontal';
  if (W < 4 * tA + dB || H < 4 * tA) return vazio([`Grade de ${W}×${H} mm demasiado pequena para este aro.`]);
  const vaoMax = afast(m.vaoMax, DEF_GRADE.vaoMax);
  const un = Math.min(MAX_UN, Math.max(1, Math.round(numLivre(m.qtd)) || 1));

  const r = vazio(), ac = sacoAcessorios();
  const lin = (grupo, perfil, x1, y1, x2, y2, o) => r.pecas.push(peca(grupo, perfil, [x1, y1, 0], [x2, y2, 0], [x1, y1, x2, y2], o));
  const aro = { ang: [45, 45], t: tA, p: profA };
  lin('aro', pAro, 0, tA / 2, W, tA / 2, aro); lin('aro', pAro, 0, H - tA / 2, W, H - tA / 2, aro);
  lin('aro', pAro, tA / 2, 0, tA / 2, H, aro); lin('aro', pAro, W - tA / 2, 0, W - tA / 2, H, aro);
  r.ligacoes += 4;
  if (deitada) {
    // barras deitadas, de lado a lado, afastadas em altura; montantes intermédios ao alto
    const nT = reparte(W - 2 * tA, MAX_TRAVESSA) - 1;
    for (let k = 1; k <= nT; k++) { const x = tA + k * (W - 2 * tA) / (nT + 1); lin('travessa', pAro, x, tA, x, H - tA, { t: tA, p: profA }); r.ligacoes += 2; }
    const livre = H - 2 * tA, { n, folga } = repartirVaroes(livre, dB, vaoMax);
    for (let j = 0; j < n; j++) { const y = tA + folga * (j + 1) + dB * (j + 0.5); lin('barra', pBar, tA, y, W - tA, y, fB); r.ligacoes += 2 + nT; }
    r.vaos.push({ livre: arred(livre), n, folga: arred(folga), horizontal: true });
  } else {
    const nT = reparte(H - 2 * tA, MAX_TRAVESSA) - 1;
    for (let k = 1; k <= nT; k++) { const y = tA + k * (H - 2 * tA) / (nT + 1); lin('travessa', pAro, tA, y, W - tA, y, { t: tA, p: profA }); r.ligacoes += 2; }
    const livre = W - 2 * tA, { n, folga } = repartirVaroes(livre, dB, vaoMax);
    for (let j = 0; j < n; j++) { const x = tA + folga * (j + 1) + dB * (j + 0.5); lin('varao', pBar, x, tA, x, H - tA, fB); r.ligacoes += 2 + nT; }
    r.vaos.push({ livre: arred(livre), n, folga: arred(folga) });
  }

  // Patas de fixação à ombreira, com bucha química
  const porLado = H > 1500 ? 3 : 2;
  for (const x of [0, W]) for (let k = 0; k < porLado; k++) {
    const y = porLado === 2 ? (k ? H - 150 : 150) : [150, H / 2, H - 150][k];
    r.pontos.push({ tipo: 'pata', p: [x, Math.min(Math.max(y, tA), H - tA), 0], s: [x, Math.min(Math.max(y, tA), H - tA)] });
  }
  ac.junta('pata_grade', 2 * porLado); ac.junta('bucha_quimica', 2 * porLado);

  r.cotas.push({ tipo: 'h', nivel: 1, s1: 0, s2: W, texto: String(Math.round(W)) }, { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.trocosPlanta.push({ a: [0, 0], b: [W, 0], texto: String(Math.round(W)) });
  // Várias grades iguais: as peças repetem-se (o desenho mostra uma), para as listas e o custo saírem multiplicados
  if (un > 1) {
    const base = r.pecas.slice();
    for (let k = 1; k < un; k++) r.pecas.push(...base);
    r.ligacoes *= un;
    r.avisos.push(`${un} unidades iguais: o desenho mostra uma; as listas e o custo são do conjunto.`);
  }
  r.acessorios = ac.lista().map(a => ({ ...a, qtd: a.qtd * un }));
  r.unidades = un; r.deitada = deitada; r.altura = H; r.comprimentoTotal = W; r.largura = W;
  return r;
}
