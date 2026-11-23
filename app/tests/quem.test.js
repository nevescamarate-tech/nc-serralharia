// Quem fez cada obra e trabalho: o nome do PIN com que se entrou na app.
import { test, eq, ok } from './t.js';
import { textoQuem } from '../js/fmt.js';
import { ACESSOS } from '../js/acesso.js';

test('mostra quem fez e, se outra pessoa mexeu depois, quem alterou', () => {
  eq(textoQuem({ feitoPor: 'Brian' }), 'Feito por Brian');
  eq(textoQuem({ feitoPor: 'Brian', alteradoPor: 'Brian' }), 'Feito por Brian');
  eq(textoQuem({ feitoPor: 'Brian', alteradoPor: 'Tiago' }), 'Feito por Brian, alterado por Tiago');
  eq(textoQuem({ alteradoPor: 'Duarte' }), 'Alterado por Duarte');
});
test('trabalhos antigos, sem registo de quem os fez, não mostram nada', () => {
  eq(textoQuem({}), ''); eq(textoQuem(), ''); eq(textoQuem({ feitoPor: null, alteradoPor: null }), '');
});
test('há um PIN para o Brian, o Duarte e o Tiago, todos com nomes diferentes', () => {
  const nomes = ACESSOS.map(a => a.nome);
  for (const n of ['Brian', 'Duarte', 'Tiago']) ok(nomes.includes(n), 'falta ' + n);
  eq(new Set(nomes).size, nomes.length);
});
