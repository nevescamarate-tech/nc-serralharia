// Tubagem soldada: percurso troço a troço, curvas a 90° de raio longo, flanges, tampões, tês e abraçadeiras.
import { DIAMETROS, ESPESSURAS } from '../catalogo.js';
import { num, reparte, arred, vazio, peca, sacoAcessorios } from './util.js';

export { DIAMETROS, ESPESSURAS };
export const DEF_TUBAGEM = {
  dn: 50, esp: 2, trocos: [{ comp: '', dir: 'dir', tes: 0 }], ini: 'livre', fim: 'livre', maxSuportes: 2000,
};
export const DIRECOES = { dir: [1, 0, 0], esq: [-1, 0, 0], cima: [0, 1, 0], baixo: [0, -1, 0], frente: [0, 0, -1], tras: [0, 0, 1] };
const VARA = 6000, MAX_TROCOS = 60;
// Projeção isométrica: X para a direita e para baixo, «frente» para a direita e para cima, Y na vertical.
const iso = p => [(p[0] - p[2]) * 0.866, p[1] - (p[0] + p[2]) * 0.5];
const escalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function calcTubagem(medidas = {}) {
  const m = { ...DEF_TUBAGEM, ...medidas };
  const dn = DIAMETROS[+m.dn] ? +m.dn : 50, de = DIAMETROS[dn].de;
  const esp = ESPESSURAS.includes(+m.esp) && 2 * +m.esp < de ? +m.esp : 2;
  const perfil = `tu${dn}x${esp}`, R = 1.5 * dn;
  const max = Math.max(300, num(m.maxSuportes, DEF_TUBAGEM.maxSuportes));
  const avisos = [], trocos = [];
  (Array.isArray(m.trocos) ? m.trocos : []).slice(0, MAX_TROCOS).forEach((t, i) => {
    const comp = num(t && t.comp, 0);
    if (!comp) { if (t && t.comp !== '' && t.comp != null) avisos.push(`Troço ${i + 1}: comprimento inválido.`); return; }
    if (comp > 100000) { avisos.push(`Troço ${i + 1}: ${comp} mm é demasiado comprido; confirme a medida (em mm).`); return; }
    trocos.push({ comp, d: DIRECOES[t.dir] || DIRECOES.dir, tes: Math.min(20, Math.max(0, Math.round(num(t.tes, 0)))), n: i + 1 });
  });
  if (!trocos.length) return vazio(avisos.length ? avisos : ['Introduza o comprimento do primeiro troço.']);

  const r = vazio(avisos), ac = sacoAcessorios();
  r.arcos3d = []; r.curvas2d = [];
  let P = [0, 0, 0];
  trocos.forEach((t, i) => {
    const ant = i > 0 ? trocos[i - 1].d : null, seg = i < trocos.length - 1 ? trocos[i + 1].d : null;
    const eAnt = ant ? escalar(ant, t.d) : null, eSeg = seg ? escalar(t.d, seg) : null;
    if (eAnt === -1) avisos.push(`Troço ${t.n}: volta para trás sobre o troço anterior. Confirme a direção.`);
    if (eAnt === 1) r.ligacoes += 1;                         // união topo a topo
    const curvaIni = eAnt === 0, curvaFim = eSeg === 0;
    const Q = [P[0] + t.d[0] * t.comp, P[1] + t.d[1] * t.comp, P[2] + t.d[2] * t.comp];
    const L = t.comp - (curvaIni ? R : 0) - (curvaFim ? R : 0);
    if (L <= 0) avisos.push(`Troço ${t.n}: ${t.comp} mm não chega para as curvas DN${dn} (raio ${R} mm). As curvas ligam diretamente.`);
    else {
      r.pecas.push(peca('tubo', perfil, P, Q, [...iso(P), ...iso(Q)], { L, t: de, p: de }));
      r.ligacoes += Math.ceil(L / VARA) - 1;                 // emendas em tubos maiores do que a vara
    }
    if (curvaFim) {
      ac.junta('curva_inox'); r.ligacoes += 2; r.pontos.push({ tipo: 'curva', p: Q, s: iso(Q), r: de / 2 });
      // eixo da curva com o raio verdadeiro (1,5 × DN), para o desenho e o 3D
      const c = [0, 1, 2].map(k => Q[k] - t.d[k] * R + seg[k] * R), pts = [];
      for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 * k / 10; pts.push([0, 1, 2].map(j => arred(c[j] - seg[j] * R * Math.cos(a) + t.d[j] * R * Math.sin(a), 2))); }
      r.arcos3d.push({ pts, r: de / 2 }); r.curvas2d.push({ pts: pts.map(iso), t: de });
    }
    if (t.tes) { ac.junta('te_inox', t.tes); r.ligacoes += 2 * t.tes; }
    const vaos = reparte(t.comp, max);
    for (let k = i === 0 ? 0 : 1; k <= vaos; k++) {
      const u = t.comp * k / vaos, S = [P[0] + t.d[0] * u, P[1] + t.d[1] * u, P[2] + t.d[2] * u];
      ac.junta('abracadeira_inox'); r.pontos.push({ tipo: 'abracadeira', p: S, s: iso(S) });
    }
    r.cotas.push({ tipo: 'l', a: iso(P), b: iso(Q), texto: String(Math.round(t.comp)), t: de });
    if (t.d[1] === 0) r.trocosPlanta.push({ a: [P[0], P[2]], b: [Q[0], Q[2]], texto: String(Math.round(t.comp)) });
    r.comprimentoTotal += t.comp;
    P = Q;
  });
  const ponta = (tipo, p, d) => {
    if (tipo !== 'flange' && tipo !== 'tampao') return;
    ac.junta(tipo === 'flange' ? 'flange_inox' : 'tampao_inox'); r.ligacoes += 1;
    r.pontos.push({ tipo, p, s: iso(p), dir: d, r: de });
  };
  ponta(m.ini, [0, 0, 0], trocos[0].d); ponta(m.fim, P, trocos[trocos.length - 1].d);

  r.acessorios = ac.lista().map(a => ({ ...a, fator: dn / 50, sufixo: `DN${dn}` }));
  const metros = r.pecas.reduce((s, p) => s + p.L, 0) / 1000;
  r.horas = Math.round((r.ligacoes * (0.25 + dn / 200) + r.pecas.length * 0.1 + metros * 0.1) * 2) / 2;
  r.dn = dn; r.de = de; r.esp = esp; r.altura = 0; r.comprimentoTotal = arred(r.comprimentoTotal);
  return r;
}
