import { test, eq, ok } from './t.js';
import * as store from '../js/store.js';
import { temPin, definirPin, verificarPin, removerPin } from '../js/pin.js';

async function limpo() { await store.abrir('nc-teste'); await store.kv.guardar('pin', null); }

test('sem PIN definido: não há bloqueio e qualquer verificação falha', async () => {
  await limpo(); eq(await temPin(), false); eq(await verificarPin('1234'), false);
});
test('definir e verificar o PIN', async () => {
  await limpo(); eq((await definirPin('1234')).ok, true);
  eq(await temPin(), true); eq(await verificarPin('1234'), true); eq(await verificarPin('1235'), false); eq(await verificarPin(''), false);
});
test('o PIN não fica guardado em claro', async () => {
  await limpo(); await definirPin('482615');
  ok(!JSON.stringify(await store.kv.ler('pin')).includes('482615'));
  ok(!(await store.exportar()).includes('482615'));
});
test('PIN tem de ter 4 a 8 algarismos', async () => {
  await limpo();
  for (const p of ['', '12', '123', 'abcd', '123456789', '12 34', null]) eq((await definirPin(p)).ok, false, String(p));
  eq(await temPin(), false);
});
test('remover o PIN', async () => {
  await limpo(); await definirPin('1234'); await removerPin(); eq(await temPin(), false);
});
test('o mesmo PIN definido duas vezes dá registos diferentes (sal aleatório)', async () => {
  await limpo(); await definirPin('1234'); const a = JSON.stringify(await store.kv.ler('pin'));
  await definirPin('1234'); ok(a !== JSON.stringify(await store.kv.ler('pin')));
  await removerPin();
});
