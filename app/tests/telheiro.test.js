import { test, eq, ok, perto, semNaN } from './t.js';
import { calcTelheiro } from '../js/modelos/telheiro.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { listaPosicoes, pormenorPe } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { alcadoSVG, plantaSVG } from '../js/desenho2d.js';
import { PRECOS_EXEMPLO, dims } from '../js/catalogo.js';

const base = (m = {}) => calcTelheiro({ comp: 7200, largura: 4200, altura: 3000, pendente: 5, vaoMax: 3600, ...m });
const de = (r, g) => r.pecas.filter(p => p.grupo === g);
const qtd = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('o tipo telheiro existe e sem medidas pede-as', () => {
  ok(TIPOS.telheiro); eq(calcTelheiro({}).pecas.length, 0); ok(calcTelheiro({}).avisos.length > 0);
  ok(calcTelheiro({ comp: 7200 }).avisos.some(a => /largura/i.test(a)));
});
test('telheiro 7,20 × 4,20 com vão máximo 3,6 m: 3 eixos, 6 pilares, 3 vigas', () => {
  const r = base();
  eq(de(r, 'pilar').length, 6); eq(de(r, 'viga').length, 3);
  eq(qtd(r, 'placa_base'), 6); eq(qtd(r, 'perno'), 24);
  ok(semNaN(r));
});
test('os pilares de trás são mais altos: altura + largura × pendente', () => {
  const r = base(), ps = de(r, 'pilar'), a = dims('tq80x3').a;
  const frente = ps.filter(p => p.a[2] < 1000), tras = ps.filter(p => p.a[2] > 1000);
  eq(frente.length, 3); eq(tras.length, 3);
  perto(frente[0].b[1], 3000 + a / 2 * 0.05, 1);
  perto(tras[0].b[1] - frente[0].b[1], (4200 - a) * 0.05, 1);
  perto(r.alturaAlta, 3000 + 4200 * 0.05, 0.5);
  ok(frente[0].ang[1] > 2.5 && frente[0].ang[1] < 3.2, 'topo do pilar cortado à pendente (≈2,9°)');
});
test('as vigas têm o comprimento inclinado mais os dois beirais', () => {
  const r = base({ beiral: 200 }), v = de(r, 'viga')[0];
  perto(v.L, (4200 + 400) / Math.cos(Math.atan(0.05)), 1);
});
test('pendente 0 (pérgula) dá pilares todos iguais e cortes em esquadria', () => {
  const r = base({ pendente: 0, cobertura: 'ripado' });
  eq(new Set(de(r, 'pilar').map(p => p.L)).size, 1); eq(de(r, 'pilar')[0].ang, [0, 0]);
  ok(de(r, 'ripa').length > 0); eq(de(r, 'madre').length, 0); eq(r.paineis.length, 0);
});
test('as madres não passam do afastamento máximo e nenhuma é maior do que a vara', () => {
  const r = base({ maxMadres: 1000 }), zs = [...new Set(de(r, 'madre').map(p => Math.round(p.a[2])))].sort((a, b) => a - b);
  ok(zs.length >= 5);
  for (let i = 1; i < zs.length; i++) ok(zs[i] - zs[i - 1] <= 1001, 'madres a ' + (zs[i] - zs[i - 1]));
  ok(de(r, 'madre').every(p => p.L <= 6000));
  const porLinha = de(r, 'madre').filter(p => Math.round(p.a[2]) === zs[0]).reduce((s, p) => s + p.L, 0);
  perto(porLinha, 7200 + 2 * 200, 1);
});
test('ripado a 150 mm numa pérgula de 25 m: muitas ripas, todas emendadas sobre as vigas', () => {
  const r = base({ comp: 25460, largura: 4000, pendente: 0, cobertura: 'ripado', maxMadres: 450 }), xs = de(r, 'viga').map(v => v.a[0]);
  ok(de(r, 'ripa').length >= 10 * 5);
  for (const p of de(r, 'ripa')) for (const x of [p.a[0], p.b[0]])
    ok(x < 0 || x > 25460 || xs.some(v => Math.abs(v - x) < 1), 'emenda fora de uma viga em x=' + x);
});
test('cobertura em painel sandwich: a área dos painéis cobre o telheiro com os beirais', () => {
  const r = base({ cobertura: 'sandwich' }), m2 = r.paineis.reduce((s, p) => s + p.w * p.h, 0) / 1e6;
  ok(r.paineis.every(p => p.grupo === 'sandwich' && p.w <= 1000));
  perto(m2, (7200 + 400) * (4200 + 400) / Math.cos(Math.atan(0.05)) / 1e6, 0.05);
  ok(qtd(r, 'parafuso_cob') > 0);
  eq(base({ cobertura: 'nenhuma' }).paineis.length, 0); eq(qtd(base({ cobertura: 'nenhuma' }), 'parafuso_cob'), 0);
});
test('encostado à parede: só a fila da frente tem pilares e há viga de parede com buchas', () => {
  const r = base({ apoio: 'parede' });
  eq(de(r, 'pilar').length, 3); eq(de(r, 'vigap').length, 1); perto(de(r, 'vigap')[0].L, 7200, 1);
  ok(qtd(r, 'bucha_quimica') >= 12); eq(qtd(r, 'placa_base'), 3);
  ok(de(r, 'viga').every(v => Math.max(v.a[2], v.b[2]) < 4200), 'a viga não atravessa a parede');
});
test('medidas absurdas são recusadas com aviso', () => {
  for (const m of [{ comp: 900000 }, { largura: 50000 }, { altura: 20000 }, { comp: 100 }, { altura: 200 }])
    { const r = base(m); eq(r.pecas.length, 0); ok(r.avisos.length > 0); }
});
test('avisa sempre que a estrutura tem de ser dimensionada por técnico', () => {
  ok(base().avisos.some(a => /dimension/i.test(a)));
});
test('todas as peças têm alçado frontal e lateral; há cotas nas duas vistas', () => {
  const r = base();
  ok(r.pecas.every(p => p.s.length === 4 && p.sl.length === 4 && p.ts > 0 && p.tl > 0));
  ok(r.cotas.some(c => c.texto === '7200')); ok(r.cotasLateral.some(c => c.texto === '4200')); ok(r.cotas.some(c => c.texto === '3000'));
  ok(alcadoSVG(r).includes('>7200<')); ok(plantaSVG(r).startsWith('<svg'));
});
test('custo: cobertura, placas e pernos têm preço de exemplo e nada fica sem preço', () => {
  const t = { tipo: 'telheiro', medidas: { comp: 7200, largura: 4200 }, material: 'aco', acabamento: 'galvanizado', margem: 30, horasOficina: null, horasMontagem: 16 };
  const res = calcular(t), c = custo(t, res, planoCorte(res.pecas), JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.paineis > 0); ok(c.total > 500); ok(semNaN(c));
  ok(c.linhas.some(l => /sandwich/i.test(l.desc)));
});
test('preparação: posições com pilar, viga, madre e cobertura; folha com alçado lateral e placa de base', () => {
  const t = { id: 't', tipo: 'telheiro', nome: 'Telheiro', medidas: { comp: 7200, largura: 4200 }, material: 'aco', acabamento: 'galvanizado' };
  const res = calcular(t), refs = listaPosicoes(res, 'aco').posicoes.map(p => p.ref);
  for (const r of ['PL1', 'PL2', 'VG1', 'M1', 'CB1']) ok(refs.includes(r), 'falta ' + r + ' em ' + refs.join(' '));
  const cb = listaPosicoes(res, 'aco').posicoes.find(p => p.ref === 'CB1'); ok(cb.kg > 0); ok(/sandwich/i.test(cb.perfil));
  const pe = pormenorPe(res); ok(pe && /placa de base/i.test(pe.titulo)); ok(/confirmar/i.test(pe.nota));
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1', trabalhos: [t] }, t, res, planoCorte(res.pecas), '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['alçado frontal', 'alçado lateral', 'planta', 'placa de base', 'a calcular', 'painel sandwich']) ok(tx.includes(p), 'falta «' + p + '»');
});
