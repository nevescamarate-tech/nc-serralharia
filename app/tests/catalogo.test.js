import { test, perto, ok } from './t.js';
import { kgm, PERFIS, MATERIAIS, CORES_RAL, PRECOS_EXEMPLO, ACESSORIOS } from '../js/catalogo.js';

test('peso por metro do tubo quadrado 40x2 em aço', () => perto(kgm('tq40x2', 'aco'), 2.39, 0.05));
test('peso por metro do tubo redondo 42,4x2 em inox', () => perto(kgm('tr42x2', 'inox304'), 2.0, 0.05));
test('peso por metro do varão 12 em aço', () => perto(kgm('varao12', 'aco'), 0.888, 0.01));
test('perfil desconhecido pesa 0, sem erro', () => perto(kgm('nao_existe', 'aco'), 0, 0));
test('catálogo tem os quatro materiais e 12 cores', () => {
  ok(MATERIAIS.aco && MATERIAIS.inox304 && MATERIAIS.inox316 && MATERIAIS.aluminio);
  ok(CORES_RAL.length >= 12);
  ok(Object.keys(PERFIS).length >= 20);
});
test('todos os acessórios têm preço de exemplo', () => {
  for (const ref of Object.keys(ACESSORIOS)) ok(PRECOS_EXEMPLO.acessorios[ref] > 0, 'sem preço: ' + ref);
});
