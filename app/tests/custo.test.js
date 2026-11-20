import { test, eq, ok, perto, semNaN } from './t.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo, listaMaterial, pesoKg } from '../js/custo.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

const precos = () => JSON.parse(JSON.stringify(PRECOS_EXEMPLO));
function caso(extra = {}, pr = precos()) {
  const trabalho = { tipo: 'guarda', medidas: { trocos: [{ comp: 3000 }] }, material: 'aco', acabamento: 'pintado',
    margem: 30, horasOficina: null, horasMontagem: 4, ...extra };
  const res = calcular(trabalho);
  const plano = planoCorte(res.pecas, { vara: pr.vara, serra: pr.serra });
  return { trabalho, res, c: custo(trabalho, res, plano, pr) };
}

test('calcular despacha pelo tipo de trabalho', () => {
  ok(calcular({ tipo: 'portao', medidas: { largura: 3000 } }).pecas.length > 0);
  ok(calcular({ tipo: 'corrimao', medidas: { comp: 3000 } }).pecas.length > 0);
  ok(calcular({ tipo: 'outro', medidas: {} }).avisos.length > 0);
});
test('total é a soma das parcelas', () => {
  const { c } = caso();
  perto(c.total, c.material + c.paineis + c.consumiveis + c.acessorios + c.oficina + c.acabamento + c.montagem + c.deslocacao, 0.01);
  ok(c.total > 0); ok(semNaN(c));
});
test('margem de 30% é sobre a venda: venda = custo ÷ 0,70, e IVA de 23%', () => {
  const { c } = caso();
  perto(c.venda, c.total / 0.7, 0.01); perto((c.venda - c.total) / c.venda, 0.3, 1e-9);
  perto(c.vendaIva, c.venda * 1.23, 0.01);
});
test('margem 0 vende ao custo', () => { const { c } = caso({ margem: 0 }); perto(c.venda, c.total, 0.01); });
test('margem de 100 % ou mais não dá preço infinito: fica em 95 %', () => {
  for (const m of [100, 150]) { const { c } = caso({ margem: m }); ok(semNaN(c)); perto(c.venda, c.total / 0.05, 0.01); eq(c.margem, 95); }
});
test('horas de oficina introduzidas à mão substituem a estimativa', () => {
  const { c } = caso({ horasOficina: 10 });
  eq(c.oficinaH, 10); perto(c.oficina, 10 * 28, 0.01);
});
test('montagem = horas × preço, mais deslocação à parte', () => {
  const { c } = caso(); perto(c.montagem, 4 * 30, 0.01); perto(c.deslocacao, 40, 0.01);
});
test('acessório sem preço: conta 0, aparece em semPreco, sem NaN', () => {
  const pr = precos(); delete pr.acessorios.sapata;
  const { c } = caso({}, pr);
  ok(c.semPreco.includes('sapata')); ok(semNaN(c));
});
test('material sem preço por kg: semPreco e sem NaN', () => {
  const pr = precos(); delete pr.kg.aco;
  const { c } = caso({}, pr); ok(c.semPreco.includes('aco')); ok(semNaN(c));
});
test('modo varas cobra varas inteiras; modo útil cobra o comprimento mais desperdício', () => {
  const a = precos(); a.materialModo = 'varas';
  const b = precos(); b.materialModo = 'util'; b.desperdicio = 0;
  ok(caso({}, a).c.material > caso({}, b).c.material);
});
test('lista de material agrupa por perfil com metros e kg', () => {
  const { res } = caso();
  const l = listaMaterial(res, 'aco');
  const prumos = l.find(x => x.perfil === 'tq40x2');
  eq(prumos.qtd, 4); perto(prumos.mTotal, 4 * (1100 - 42.4) / 1000, 0.01);
  perto(l.reduce((s, x) => s + (x.kg || 0), 0), pesoKg(res, 'aco'), 0.01);
});
test('resultado vazio custa só a deslocação e a montagem, sem NaN', () => {
  const { c } = caso({ medidas: {} }); ok(semNaN(c)); perto(c.material, 0, 0);
});
