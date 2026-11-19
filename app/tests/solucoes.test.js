import { test, eq, ok, perto, semNaN } from './t.js';
import { variantes, compararSolucoes } from '../js/solucoes.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

const precos = () => JSON.parse(JSON.stringify(PRECOS_EXEMPLO));
const tr = (tipo, medidas, extra = {}) => ({ id: 't', tipo, nome: 'T', medidas, material: 'aco', acabamento: 'pintado', margem: 30, horasOficina: null, horasMontagem: 4, precos: precos(), ...extra });

test('guarda: 4 enchimentos × 3 materiais, com a solução atual marcada uma só vez', () => {
  const v = variantes(tr('guarda', { trocos: [{ comp: 3000 }], enchimento: 'vidro' }));
  eq(v.length, 12); eq(v.filter(x => x.atual).length, 1);
  const a = v.find(x => x.atual); eq(a.medidas.enchimento, 'vidro'); eq(a.material, 'aco'); eq(a.acabamento, 'pintado');
  ok(v.some(x => /vidro laminado · inox/i.test(x.rotulo)));
  ok(v.every(x => x.medidas.trocos[0].comp === 3000), 'as medidas não mudam');
});
test('um material fora da lista habitual entra na comparação como a solução atual', () => {
  const v = variantes(tr('guarda', { trocos: [{ comp: 3000 }] }, { material: 'aluminio', acabamento: 'anodizado' }));
  eq(v.filter(x => x.atual).length, 1); eq(v.find(x => x.atual).material, 'aluminio'); eq(v.length, 16);
});
test('comparar: ordenado do mais barato ao mais caro, e o preço da atual é o do ecrã de custo', () => {
  const t = tr('guarda', { trocos: [{ comp: 3000 }] }), l = compararSolucoes(t);
  eq(l.length, 12); for (let i = 1; i < l.length; i++) ok(l[i].venda >= l[i - 1].venda);
  const res = calcular(t), c = custo(t, res, planoCorte(res.pecas, { vara: 6000, serra: 3 }), t.precos);
  perto(l.find(x => x.atual).venda, c.venda, 0.01);
  ok(l.find(x => /inox/i.test(x.rotulo) && x.medidas.enchimento === 'varoes').venda > l.find(x => x.atual).venda, 'inox mais caro do que aço pintado');
  ok(semNaN(l)); ok(l.every(x => x.passa === true || x.passa === false));
});
test('todos os tipos visíveis dão pelo menos duas soluções com preço; sem medidas não há nenhuma', () => {
  const m = { guarda: { trocos: [{ comp: 3000 }] }, guardamuro: { comp: 2970 }, corrimao: { comp: 3000 }, portao: { largura: 3000 }, tubagem: { dn: 50, trocos: [{ comp: 2000, dir: 'dir' }] },
    telheiro: { comp: 6000, largura: 3000 }, grade: { largura: 1200, altura: 1000 }, gradeamento: { comp: 6000 }, escada: { desnivel: 2800 } };
  for (const tipo of Object.keys(TIPOS).filter(k => !TIPOS[k].oculto)) {
    const l = compararSolucoes(tr(tipo, m[tipo], tipo === 'tubagem' ? { material: 'inox304', acabamento: 'nenhum' } : {}));
    ok(l.length >= 2, tipo + ': ' + l.length); ok(l.filter(x => x.atual).length === 1, tipo + ' sem atual'); ok(l.every(x => x.venda > 0 && !x.semPreco), tipo + ' sem preço');
  }
  eq(compararSolucoes(tr('guarda', { trocos: [{ comp: '' }] })), []); eq(variantes(tr('abrigo', {})), []);
});
test('uma opção fora da lista (guarda sem enchimento) continua a ser a solução atual', () => {
  const l = compararSolucoes(tr('guarda', { trocos: [{ comp: 3000 }], enchimento: 'nenhum' }));
  eq(l.filter(x => x.atual).length, 1); eq(l.find(x => x.atual).medidas.enchimento, 'nenhum'); eq(l.length, 15);
});
