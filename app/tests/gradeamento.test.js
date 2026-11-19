import { test, eq, ok, perto, semNaN } from './t.js';
import { calcGradeamento } from '../js/modelos/gradeamento.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { listaPosicoes, pormenorPe, pormenorVao } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { PRECOS_EXEMPLO, dims } from '../js/catalogo.js';

const g = (m = {}) => calcGradeamento({ comp: 10000, altura: 1200, ...m });
const de = (r, grupo) => r.pecas.filter(p => p.grupo === grupo);
const qtd = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('o tipo gradeamento existe e sem comprimento pede-o', () => {
  ok(TIPOS.gradeamento); eq(calcGradeamento({}).pecas.length, 0); ok(calcGradeamento({}).avisos.length > 0);
});
test('10 m com módulos de 2 m no máximo: 5 módulos iguais e 6 prumos', () => {
  const r = g(), pr = de(r, 'prumo'), a = dims('tq50x2').a;
  eq(pr.length, 6); eq(de(r, 'travessa').length, 10);
  const xs = pr.map(p => p.s[0]); perto(xs[0], a / 2, 0.1); perto(xs[5], 10000 - a / 2, 0.1);
  for (let i = 1; i < xs.length; i++) { perto(xs[i] - xs[i - 1], (10000 - a) / 5, 0.1); ok(xs[i] - xs[i - 1] <= 2000); }
  ok(semNaN(r));
});
test('prumos chumbados descem 150 mm no muro; com sapata ficam à face e levam buchas', () => {
  const ch = g({ fixacao: 'chumbado' }), sp = g({ fixacao: 'sapata' });
  perto(de(ch, 'prumo')[0].L, 1200 + 150, 0.1); perto(de(sp, 'prumo')[0].L, 1200, 0.1);
  eq(qtd(ch, 'sapata'), 0); eq(qtd(sp, 'sapata'), 6); eq(qtd(sp, 'bucha'), 24);
  ok(pormenorPe(sp)); eq(pormenorPe(ch), null);
});
test('varões com folga igual em todos os módulos, nunca acima do vão máximo', () => {
  const r = g({ vaoMax: 110 });
  eq(r.vaos.length, 5); ok(r.vaos.every(v => v.folga > 0 && v.folga <= 110.1));
  eq(new Set(de(r, 'varao').map(p => p.L)).size, 1);
});
test('pontas acima da travessa alongam os varões', () => {
  const sem = de(g(), 'varao')[0].L, com = de(g({ pontas: 120 }), 'varao')[0].L;
  perto(com - sem, 120 + dims('tret40x20x2').b, 0.2);
});
test('barras horizontais em vez de varões', () => {
  const r = g({ enchimento: 'barras', nBarras: 6 });
  eq(de(r, 'varao').length, 0); eq(de(r, 'barra').length, 6 * 5); eq(de(r, 'travessa').length, 0);
});
test('medidas absurdas são recusadas', () => {
  for (const m of [{ comp: 900000 }, { altura: 9000 }, { comp: 100 }, { altura: 100 }]) { const r = g(m); eq(r.pecas.length, 0); ok(r.avisos.length > 0); }
});
test('custo, posições e folha de preparação', () => {
  const t = { id: 't', tipo: 'gradeamento', nome: 'Gradeamento', medidas: { comp: 10000, fixacao: 'sapata' }, material: 'aco', acabamento: 'galv_lacado', margem: 30, horasOficina: null, horasMontagem: 8 };
  const res = calcular(t), plano = planoCorte(res.pecas), c = custo(t, res, plano, JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.total > 300); ok(semNaN(c));
  const refs = listaPosicoes(res, 'aco').posicoes.map(p => p.ref); for (const r of ['P1', 'T1', 'V1']) ok(refs.includes(r));
  ok(pormenorVao(res).startsWith('<svg'));
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1', trabalhos: [t] }, t, res, plano, '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['vão tipo', 'pé do prumo', 'lista de corte', '10000']) ok(tx.includes(p), 'falta «' + p + '»');
});
