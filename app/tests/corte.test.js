import { test, eq, ok } from './t.js';
import { planoCorte } from '../js/corte.js';

const p = (L, perfil = 'tq40x2') => ({ perfil, L, ang: [0, 0] });

test('4 peças de 2900 cabem em 2 varas', () => {
  const r = planoCorte([p(2900), p(2900), p(2900), p(2900)]);
  eq(r.porPerfil[0].nVaras, 2);
});
test('3 peças de 2000 precisam de 2 varas por causa do corte da serra', () => {
  eq(planoCorte([p(2000), p(2000), p(2000)]).porPerfil[0].nVaras, 2);
});
test('peça de 7000 dá aviso de emenda e conta 2 varas', () => {
  const r = planoCorte([p(7000)]);
  eq(r.porPerfil[0].nVaras, 2);
  ok(r.avisos.some(a => /emenda/i.test(a)));
});
test('lista vazia devolve plano vazio', () => eq(planoCorte([]).porPerfil, []));
test('perfis diferentes ficam em grupos separados', () => {
  eq(planoCorte([p(1000, 'tq40x2'), p(1000, 'tr42x2')]).porPerfil.length, 2);
});
test('sobra da vara = vara − cortes − serra', () => {
  const v = planoCorte([p(1000)]).porPerfil[0].varas[0];
  eq(v.sobra, 6000 - 1000 - 3);
});

// --- revisão final ---
test('vara 0 ou inválida usa 6000 em vez de dar infinito', () => {
  for (const vara of [0, -1, NaN, undefined, null]) eq(planoCorte([p(1000)], { vara, serra: 3 }).porPerfil[0].nVaras, 1);
});
