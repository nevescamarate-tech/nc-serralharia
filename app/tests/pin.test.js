import { test, eq, ok } from './t.js';
import * as store from '../js/store.js';
import { temPin, definirPin, verificarPin, removerPin, adicionarPin, listarPins, quemE, mudarPin, MAX_PINS } from '../js/pin.js';

async function limpo() { await store.abrir('nc-teste'); await store.kv.guardar('pins', null); await store.kv.guardar('pin', null); }

test('sem PIN definido: não há bloqueio e qualquer verificação falha', async () => {
  await limpo(); eq(await temPin(), false); eq(await verificarPin('1234'), false); eq(await listarPins(), []);
});
test('definir e verificar o PIN', async () => {
  await limpo(); eq((await definirPin('1234')).ok, true);
  eq(await temPin(), true); eq(await verificarPin('1234'), true); eq(await verificarPin('1235'), false); eq(await verificarPin(''), false);
});
test('o PIN não fica guardado em claro', async () => {
  await limpo(); await definirPin('482615');
  ok(!JSON.stringify(await store.kv.ler('pins')).includes('482615'));
  ok(!(await store.exportar()).includes('482615'));
});
test('PIN tem de ter 4 a 8 algarismos', async () => {
  await limpo();
  for (const p of ['', '12', '123', 'abcd', '123456789', '12 34', null]) eq((await definirPin(p)).ok, false, String(p));
  eq(await temPin(), false);
});
test('remover todos os PIN', async () => {
  await limpo(); await definirPin('1234'); await removerPin(); eq(await temPin(), false);
});
test('o mesmo PIN definido duas vezes dá registos diferentes (sal aleatório)', async () => {
  await limpo(); await definirPin('1234'); const a = JSON.stringify(await store.kv.ler('pins'));
  await definirPin('1234'); ok(a !== JSON.stringify(await store.kv.ler('pins')));
});

// --- dois PIN, um por pessoa ---
test('duas pessoas, cada uma com o seu PIN, ambas entram', async () => {
  await limpo();
  eq((await adicionarPin('Nuno', '1111')).ok, true); eq((await adicionarPin('Neves', '2222')).ok, true);
  eq((await listarPins()).map(p => p.nome), ['Nuno', 'Neves']);
  eq(await verificarPin('1111'), true); eq(await verificarPin('2222'), true); eq(await verificarPin('3333'), false);
  eq(await quemE('2222'), 'Neves'); eq(await quemE('1111'), 'Nuno'); eq(await quemE('9999'), null);
});
test('não aceita dois PIN iguais nem nome vazio', async () => {
  await limpo(); await adicionarPin('Nuno', '1111');
  eq((await adicionarPin('Neves', '1111')).ok, false);
  eq((await adicionarPin('  ', '2222')).ok, false);
  eq((await listarPins()).length, 1);
});
test('há um número máximo de PIN', async () => {
  await limpo();
  for (let i = 0; i < MAX_PINS; i++) eq((await adicionarPin('P' + i, String(1000 + i))).ok, true);
  eq((await adicionarPin('A mais', '9999')).ok, false); eq((await listarPins()).length, MAX_PINS);
});
test('mudar o PIN de uma pessoa não mexe no da outra', async () => {
  await limpo(); await adicionarPin('Nuno', '1111'); await adicionarPin('Neves', '2222');
  eq((await mudarPin(0, '5555')).ok, true);
  eq(await verificarPin('1111'), false); eq(await quemE('5555'), 'Nuno'); eq(await quemE('2222'), 'Neves');
  eq((await mudarPin(0, '2222')).ok, false, 'não pode ficar igual ao da outra pessoa');
  eq((await mudarPin(7, '4444')).ok, false);
});
test('remover o PIN de uma pessoa mantém o da outra', async () => {
  await limpo(); await adicionarPin('Nuno', '1111'); await adicionarPin('Neves', '2222');
  await removerPin(0);
  eq((await listarPins()).map(p => p.nome), ['Neves']); eq(await verificarPin('1111'), false); eq(await verificarPin('2222'), true);
});
test('PIN criado numa versão anterior da app continua a funcionar', async () => {
  await limpo(); await definirPin('1234');
  const [antigo] = await store.kv.ler('pins');
  await store.kv.guardar('pins', null); await store.kv.guardar('pin', { s: antigo.s, h: antigo.h });   // formato antigo
  eq(await temPin(), true); eq(await verificarPin('1234'), true); eq((await listarPins()).length, 1);
  eq((await adicionarPin('Neves', '2222')).ok, true); eq(await verificarPin('1234'), true);
  await limpo();
});
