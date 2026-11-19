import { test, eq, ok, perto, semNaN } from './t.js';
import { calcGuardaMuro } from '../js/modelos/guardamuro.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo, pesoKg } from '../js/custo.js';
import { listaPosicoes, pormenorRasgo, quadroResumo, sequenciaFabrico } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

// Guardas A26-058 Pedra Algarvia: 118,25 m, módulos de 2970, barras Ø20 a 110, corrimão Ø50, barra chata 50×8 em rasgo 80×80.
const g = (m = {}) => calcGuardaMuro({ comp: 2970, altura: 600, ...m });
const de = (r, grupo) => r.pecas.filter(p => p.grupo === grupo);
const qtd = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('o tipo existe e sem comprimento pede-o', () => {
  ok(TIPOS.guardamuro); eq(calcGuardaMuro({}).pecas.length, 0); ok(calcGuardaMuro({}).avisos.length > 0);
});
test('módulo tipo de 2970: 27 barras de 632 a 110 entre eixos, a primeira a 55 do topo', () => {
  const r = g(), b = de(r, 'varao');
  eq(b.length, 27); perto(b[0].L, 632, 0.1); perto(b[0].s[0], 55, 0.1); perto(b[1].s[0] - b[0].s[0], 110, 0.01);
  eq(de(r, 'corrimao').length, 1); perto(de(r, 'corrimao')[0].L, 2970, 0.1); perto(de(r, 'chata')[0].L, 2970, 0.1);
  ok(semNaN(r));
});
test('peso do módulo perto do exemplo (28,4 kg; 9,6 kg por metro)', () => {
  const kg = pesoKg(g(), 'aco'); ok(kg > 25 && kg < 32, 'peso ' + kg);
});
test('obra de 118,25 m: 40 módulos, 39 uniões com casquilho, grout em sacos', () => {
  const r = g({ comp: 118250 });
  eq(r.guardaMuro.modulos, 40); eq(de(r, 'corrimao').length, 40); eq(qtd(r, 'casquilho'), 39); eq(qtd(r, 'rebite'), 78);
  perto(r.guardaMuro.groutM3, 0.83, 0.02); eq(qtd(r, 'grout'), Math.ceil(832.48 / 12.5)); eq(qtd(r, 'calco_inox'), 120);
  ok(r.guardaMuro.barras > 1050 && r.guardaMuro.barras < 1100);
});
test('o último módulo é o de acerto, com as barras centradas', () => {
  const r = g({ comp: 4000 }), cs = de(r, 'corrimao').map(p => p.L);
  eq(cs, [2970, 1030]);
  const b = de(r, 'varao').filter(p => p.s[0] > 2970); perto(b[0].s[0] - 2970, 4000 - b[b.length - 1].s[0], 0.1);
});
test('medidas absurdas são recusadas e há avisos do rasgo e do cálculo', () => {
  for (const m of [{ comp: 9000000 }, { altura: 9000 }, { comp: 50 }]) { const r = g(m); eq(r.pecas.length, 0); ok(r.avisos.length > 0); }
  ok(g().avisos.some(a => /rasgo/i.test(a))); ok(g().avisos.some(a => /dimension/i.test(a)));
});
test('quadro resumo: comprimento, peso total e peso por metro', () => {
  const t = { tipo: 'guardamuro', medidas: { comp: 2970 }, material: 'aco', acabamento: 'galv_lacado' }, q = quadroResumo(t, calcular(t));
  const linha = n => q.find(l => l[0].toLowerCase().includes(n));
  ok(linha('comprimento')[1].includes('2,97')); ok(linha('peso do metal')); ok(/kg\/m/.test(linha('peso por metro')[1]));
  ok(linha('módulos')); ok(quadroResumo({ tipo: 'guarda', medidas: { trocos: [{ comp: 3000 }] }, material: 'aco' }, calcular({ tipo: 'guarda', medidas: { trocos: [{ comp: 3000 }] } })).length >= 3);
});
test('sequência de fabrico: passos numeráveis para qualquer tipo, com grout nesta guarda', () => {
  const t = { tipo: 'guardamuro', medidas: { comp: 2970 }, material: 'aco', acabamento: 'galv_lacado' }, s = sequenciaFabrico(t, calcular(t));
  ok(s.length >= 5); ok(s.some(x => /grout/i.test(x)));
  for (const tipo of Object.keys(TIPOS)) ok(sequenciaFabrico({ tipo, material: 'aco', acabamento: 'pintado' }, calcular({ tipo, medidas: {} })).length >= 4, tipo);
});
test('custo, posições, pormenor do rasgo e folha', () => {
  const t = { id: 't', tipo: 'guardamuro', nome: 'Guarda do muro', medidas: { comp: 11880 }, material: 'aco', acabamento: 'galv_lacado', margem: 30, horasOficina: null, horasMontagem: 8 };
  const res = calcular(t), plano = planoCorte(res.pecas), c = custo(t, res, plano, JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.total > 300); ok(semNaN(c));
  const refs = listaPosicoes(res, 'aco').posicoes.map(p => p.ref); for (const x of ['C1', 'V1', 'BC1']) ok(refs.includes(x), 'falta ' + x + ' em ' + refs.join(' '));
  const pm = pormenorRasgo(res); ok(pm.svg.includes('>80<')); eq(pormenorRasgo(calcular({ tipo: 'escada', medidas: { desnivel: 2800 } })), null);
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1', trabalhos: [t] }, t, res, plano, '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['quadro resumo', 'peso por metro', 'sequência de fabrico e montagem', 'rasgo e selagem com grout', 'barra chata']) ok(tx.includes(p), 'falta «' + p + '»');
});
