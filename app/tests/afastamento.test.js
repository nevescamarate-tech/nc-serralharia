// Afastamento do enchimento (varões, ripas, barras): escolhido por quem mede, na vertical e na horizontal.
import { test, eq, ok, perto, semNaN } from './t.js';
import { calcGrade } from '../js/modelos/grade.js';
import { calcGradeamento } from '../js/modelos/gradeamento.js';
import { calcGuarda } from '../js/modelos/guarda.js';
import { calcPortao } from '../js/modelos/portao.js';
import { CAMPOS } from '../js/formularios.js';
import { dims } from '../js/catalogo.js';

const de = (r, grupo) => r.pecas.filter(p => p.grupo === grupo);
const campo = (tipo, id) => CAMPOS[tipo].find(c => c.id === id);
/** Folgas livres entre peças paralelas seguidas, medidas no alçado (eixo 0 = x, 1 = y). */
const folgas = (ps, eixo) => { const c = ps.map(p => p.s[eixo]).sort((a, b) => a - b); return c.slice(1).map((v, i) => v - c[i] - ps[0].t); };

test('o afastamento está à vista no formulário das grades, não escondido nas regras', () => {
  for (const tipo of ['grade', 'gradeamento', 'guarda', 'portao']) { ok(campo(tipo, 'vaoMax'), tipo); ok(!campo(tipo, 'vaoMax').av, tipo + ' à vista'); }
  for (const tipo of ['gradeamento', 'guarda']) ok(campo(tipo, 'vaoBarras') && !campo(tipo, 'vaoBarras').av, tipo + ' barras');
  ok(campo('grade', 'sentido')); ok(campo('grade', 'posicao')); ok(campo('gradeamento', 'posicao'));
});
test('grade: afastamento de 10, 50 e 100 mm dá folgas iguais que nunca passam do pedido', () => {
  let antes = Infinity;
  for (const v of [100, 50, 10]) {
    const r = calcGrade({ largura: 1200, altura: 1000, vaoMax: v }), f = folgas(de(r, 'varao'), 0);
    ok(f.length > 0); for (const x of f) { ok(x <= v + 0.01, `folga ${x} > ${v}`); perto(x, f[0], 0.05); }
    ok(f[0] > v * 0.7, `folga ${f[0]} muito abaixo de ${v}`); ok(f[0] < antes); antes = f[0];
    perto(r.vaos[0].folga, f[0], 0.1); ok(semNaN(r));
  }
});
test('grade na horizontal: barras deitadas de lado a lado, afastadas em altura', () => {
  const r = calcGrade({ largura: 1200, altura: 1000, vaoMax: 80, sentido: 'horizontal' }), b = de(r, 'barra');
  eq(de(r, 'varao').length, 0); ok(b.length > 3);
  for (const p of b) { eq(p.s[1], p.s[3]); perto(p.L, 1200 - 2 * dims('tret40x20x2').b, 0.1); }
  const f = folgas(b, 1); for (const x of f) { ok(x <= 80.01); perto(x, f[0], 0.05); }
  ok(r.vaos[0] && r.vaos[0].horizontal); perto(r.vaos[0].folga, f[0], 0.1); ok(semNaN(r));
});
test('ripa em tubo retangular ao alto mostra a face estreita e leva mais ripas do que de face', () => {
  const face = calcGrade({ largura: 1200, altura: 1000, vaoMax: 50, pBarra: 'tret40x20x2' });
  const alto = calcGrade({ largura: 1200, altura: 1000, vaoMax: 50, pBarra: 'tret40x20x2', posicao: 'cutelo' });
  eq(de(face, 'varao')[0].t, 40); eq(de(alto, 'varao')[0].t, 20); eq(de(alto, 'varao')[0].p, 40);
  ok(de(alto, 'varao').length > de(face, 'varao').length);
  for (const x of folgas(de(alto, 'varao'), 0)) ok(x <= 50.01);
});
test('ripa em barra chata (chapa) ao alto: vê-se a espessura', () => {
  const r = calcGradeamento({ comp: 4000, altura: 1200, vaoMax: 30, pVarao: 'barra50x8', posicao: 'cutelo' }), v = de(r, 'varao');
  eq(v[0].t, 8); eq(v[0].p, 50);
  for (const x of folgas(v.filter(p => p.s[0] < 1900), 0)) ok(x <= 30.01);
});
test('gradeamento de barras horizontais: com afastamento, o número de barras sai do afastamento', () => {
  const r = calcGradeamento({ comp: 2000, altura: 1200, enchimento: 'barras', vaoBarras: 50, nBarras: 3, pVarao: 'tq20x2' });
  const b = de(r, 'barra'), f = folgas(b, 1), t = dims('tq20x2').a;
  ok(b.length > 3); for (const x of f) { ok(x <= 50.01); perto(x, f[0], 0.05); }
  const ys = b.map(p => p.s[1]); perto(Math.min(...ys) - t / 2, 80, 0.1); perto(Math.max(...ys) + t / 2, 1200 - 100, 0.1);
  ok(r.vaos[0].horizontal); perto(r.vaos[0].folga, f[0], 0.1);
});
test('gradeamento de barras sem afastamento continua pelo número de barras', () => {
  eq(de(calcGradeamento({ comp: 2000, altura: 1200, enchimento: 'barras', nBarras: 4 }), 'barra').length, 4);
  eq(de(calcGradeamento({ comp: 2000, altura: 1200, enchimento: 'barras', nBarras: 4, vaoBarras: '' }), 'barra').length, 4);
});
test('guarda de barras horizontais com afastamento: folgas iguais até ao corrimão', () => {
  const r = calcGuarda({ trocos: [{ comp: 1200 }], altura: 1100, enchimento: 'barras', vaoBarras: 100, nBarras: 2 }), b = de(r, 'barra');
  ok(b.length > 2); for (const x of folgas(b, 1)) ok(x <= 100.01);
  eq(de(calcGuarda({ trocos: [{ comp: 1200 }], altura: 1100, enchimento: 'barras', nBarras: 5 }), 'barra').length, 5);
  ok(semNaN(r));
});
test('aceita afastamentos pequenos (10 mm) em guarda e portão, sem os subir para 20', () => {
  const gd = calcGuarda({ trocos: [{ comp: 1200 }], altura: 1100, enchimento: 'varoes', vaoMax: 10 });
  const pt = calcPortao({ largura: 2000, altura: 1400, enchimento: 'varoes', vaoMax: 10 });
  ok(gd.vaos[0].folga <= 10.01); ok(pt.vaos[0].folga <= 10.01);
});
test('portão de lâminas: o afastamento entre lâminas pode ser escolhido', () => {
  const junto = calcPortao({ largura: 2000, altura: 1800, enchimento: 'laminas', vaoLaminas: 10 });
  const largo = calcPortao({ largura: 2000, altura: 1800, enchimento: 'laminas', vaoLaminas: 100 });
  ok(de(junto, 'lamina').length > de(largo, 'lamina').length);
  ok(campo('portao', 'vaoLaminas') && !campo('portao', 'vaoLaminas').av);
});
test('afastamento absurdo (0, negativo, texto) cai no valor por omissão sem estragar o desenho', () => {
  for (const v of [0, -5, 'abc', '']) { const r = calcGrade({ largura: 1200, altura: 1000, vaoMax: v }); ok(de(r, 'varao').length > 0); ok(semNaN(r)); }
  const r = calcGradeamento({ comp: 2000, altura: 1200, enchimento: 'barras', vaoBarras: 1 }); ok(de(r, 'barra').length <= 80); ok(semNaN(r));
});
