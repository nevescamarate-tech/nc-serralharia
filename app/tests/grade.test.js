import { test, eq, ok, perto, semNaN } from './t.js';
import { calcGrade } from '../js/modelos/grade.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { listaPosicoes } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { alcadoSVG } from '../js/desenho2d.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

// VE.03a da obra 1698: grade 1350 × 1300, aro 40×20, varões Ø20, 4 unidades.
const g = (m = {}) => calcGrade({ largura: 1350, altura: 1300, ...m });
const de = (r, grupo) => r.pecas.filter(p => p.grupo === grupo);
const qtd = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('o tipo grade existe e sem medidas pede-as', () => {
  ok(TIPOS.grade); eq(calcGrade({}).pecas.length, 0); ok(calcGrade({ largura: 1350 }).avisos.some(a => /altura/i.test(a)));
});
test('aro de 4 peças em meia-esquadria com as medidas exteriores da grade', () => {
  const r = g(), aro = de(r, 'aro');
  eq(aro.length, 4); eq(aro.map(p => p.L).sort((a, b) => a - b), [1300, 1300, 1350, 1350]);
  ok(aro.every(p => p.ang[0] === 45 && p.ang[1] === 45)); ok(semNaN(r));
});
test('varões verticais com folga igual e nunca acima do vão máximo', () => {
  const r = g({ vaoMax: 120 }), v = de(r, 'varao');
  ok(v.length >= 8); ok(r.vaos[0].folga <= 120.1 && r.vaos[0].folga > 0);
  perto(v[0].L, 1300 - 2 * 20, 0.5);
  const xs = v.map(p => p.s[0]); perto(xs[1] - xs[0], r.vaos[0].folga + 20, 0.2);
});
test('grades altas levam travessa intermédia; as baixas não', () => {
  eq(de(g(), 'travessa').length, 1); eq(de(g({ altura: 700 }), 'travessa').length, 0); eq(de(g({ altura: 2500 }), 'travessa').length, 2);
});
test('quantidade: 4 grades iguais multiplicam peças, patas e buchas', () => {
  const um = g(), quatro = g({ qtd: 4 });
  eq(quatro.pecas.length, 4 * um.pecas.length); eq(qtd(quatro, 'pata_grade'), 4 * qtd(um, 'pata_grade'));
  eq(qtd(um, 'pata_grade'), 4); eq(qtd(um, 'bucha_quimica'), 4); eq(quatro.unidades, 4);
  eq(qtd(g({ altura: 1800 }), 'pata_grade'), 6);
  const pos = listaPosicoes(quatro, 'aco').posicoes;
  eq(pos.find(p => p.grupo === 'varao').qtd, 4 * de(um, 'varao').length);
});
test('medidas absurdas ou quantidade a mais são recusadas ou limitadas', () => {
  for (const m of [{ largura: 90000 }, { altura: 30000 }, { largura: 50 }]) { const r = g(m); eq(r.pecas.length, 0); ok(r.avisos.length > 0); }
  eq(g({ qtd: 5000 }).unidades, 50); eq(g({ qtd: -3 }).unidades, 1);
});
test('custo e desenho de 9 grades 1350 × 700 (VE.02a)', () => {
  const t = { id: 't', tipo: 'grade', nome: 'Grades VE.02a', medidas: { largura: 1350, altura: 700, qtd: 9 }, material: 'aco', acabamento: 'pintado', margem: 30, horasOficina: null, horasMontagem: 8 };
  const res = calcular(t), plano = planoCorte(res.pecas), c = custo(t, res, plano, JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.total > 200); ok(semNaN(c));
  const svg = alcadoSVG(res); ok(svg.includes('>1350<')); ok(svg.includes('>700<'));
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1698', trabalhos: [t] }, t, res, plano, '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['9 unidades iguais', 'pata de fixação', 'vão tipo', 'a1', 'v1']) ok(tx.includes(p), 'falta «' + p + '»');
});
