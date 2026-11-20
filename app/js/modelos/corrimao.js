import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, hip, arred, vazio, peca, sacoAcessorios, deitado } from './util.js';

export const DEF_CORRIMAO = {
  comp: '', desnivel: 0, altura: 900, tubo: 'tr42x2', montagem: 'parede', pPrumo: 'tr42x2',
  extremidade: 'tampa', maxSuportes: 1000,
};
const RECUO_SUPORTE = 150, CURVA = 80;

export function calcCorrimao(medidas = {}) {
  const m = { ...DEF_CORRIMAO, ...medidas };
  const comp = num(m.comp, 0);
  if (!comp) return vazio(['Introduza o comprimento do corrimão.']);
  if (comp > 100000) return vazio([`Comprimento de ${comp} mm demasiado grande; confirme a medida (em mm).`]);
  const altura = num(m.altura, DEF_CORRIMAO.altura), max = Math.max(200, num(m.maxSuportes, DEF_CORRIMAO.maxSuportes));
  const desnivel = numLivre(m.desnivel);
  const tubo = PERFIS[m.tubo] ? m.tubo : DEF_CORRIMAO.tubo, pPrumo = PERFIS[m.pPrumo] ? m.pPrumo : DEF_CORRIMAO.pPrumo;
  const fC = deitado(tubo), d = fC.t, aP = dims(pPrumo).a;
  const curva = m.extremidade === 'curva';
  const r = vazio(), ac = sacoAcessorios();
  const y = u => altura - d / 2 + desnivel * u / comp;   // eixo do tubo; a altura é ao topo
  const angInc = arred(Math.abs(Math.atan2(desnivel, comp)) * 180 / Math.PI);

  r.pecas.push(peca('corrimao', tubo, [0, y(0), 0], [comp, y(comp), 0], [0, y(0), comp, y(comp)],
    { L: hip(comp, desnivel) + (curva ? 2 * CURVA : 0), ...fC }));
  ac.junta(curva ? 'curva90' : 'tampa', 2);

  let nos;
  if (m.montagem === 'prumos') {
    const u0 = aP / 2, u1 = comp - aP / 2, n = reparte(u1 - u0, max);
    nos = Array.from({ length: n + 1 }, (_, k) => u0 + k * (u1 - u0) / n);
    nos.forEach(u => {
      const base = desnivel * u / comp, topo = y(u) - d / 2;
      r.pecas.push(peca('prumo', pPrumo, [u, base, 0], [u, topo, 0], [u, base, u, topo], { L: altura - d, ang: [0, angInc] }));
      r.pontos.push({ tipo: 'sapata', p: [u, base, 0], s: [u, base] });
      ac.junta('sapata'); ac.junta('bucha', 4); r.ligacoes += 2;
    });
  } else {
    const recuo = Math.min(RECUO_SUPORTE, comp / 4), n = reparte(comp - 2 * recuo, max);
    nos = Array.from({ length: n + 1 }, (_, k) => recuo + k * (comp - 2 * recuo) / n);
    nos.forEach(u => {
      r.pontos.push({ tipo: 'suporte', p: [u, y(u) - d / 2, 0], s: [u, y(u) - d / 2] });
      ac.junta('suporte_parede'); ac.junta('bucha', 2); r.ligacoes += 1;
    });
  }
  for (let k = 0; k < nos.length - 1; k++)
    r.cotas.push({ tipo: 'h', nivel: 1, s1: nos[k], s2: nos[k + 1], texto: String(Math.round(nos[k + 1] - nos[k])) });
  r.cotas.push({ tipo: 'h', nivel: 2, s1: 0, s2: comp, texto: String(Math.round(comp)) });
  r.cotas.push({ tipo: 'v', y1: 0, y2: altura, texto: String(Math.round(altura)) });
  r.trocosPlanta.push({ a: [0, 0], b: [comp, 0], texto: String(Math.round(comp)) });
  r.acessorios = ac.lista();
  r.altura = altura; r.comprimentoTotal = arred(hip(comp, desnivel));
  return r;
}
