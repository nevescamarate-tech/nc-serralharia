import { test, eq, ok } from './t.js';
import * as store from '../js/store.js';
import { resumoPin, quemE, verificarPin, temPin, esperaSegundos, registarFalha, limparFalhas } from '../js/pin.js';
import { SAL, VOLTAS, ACESSOS } from '../js/acesso.js';

const SAL_T = '00112233445566778899aabbccddeeff', V = 1000;   // lista de teste, rápida
const lista = async () => [{ nome: 'A', h: await resumoPin('11112222', SAL_T, V) }, { nome: 'B', h: await resumoPin('33334444', SAL_T, V) }];
const limpo = async () => { await store.abrir('nc-teste'); await limparFalhas(); };

test('o resumo calculado no browser é igual ao do gerador de PIN (vetor de teste)', async () => {
  eq(SAL, 'c9757ed6cc22b39cf25c5b9fb79ebdc8'); eq(VOLTAS, 600000);
  eq(await resumoPin('00000000'), '3b0f54cc561af329968b8d4dc4052b0cbad1dd99685b9ef7001861b1e8183813');
});
test('a app tem cinco PIN de acesso, guardados só como resumos diferentes', () => {
  eq(ACESSOS.length, 5); ok(temPin()); eq(new Set(ACESSOS.map(a => a.h)).size, 5);
  for (const a of ACESSOS) ok(/^[0-9a-f]{64}$/.test(a.h), 'resumo mal formado');
  ok(ACESSOS[0].h !== ACESSOS[1].h);
  ok(!/\d{4}/.test(ACESSOS.map(a => a.nome).join(' ')), 'PIN em claro no código');
});
test('cada PIN da lista entra e diz a quem pertence; os outros não entram', async () => {
  const l = await lista();
  eq(await quemE('11112222', l, SAL_T, V), 'A'); eq(await quemE('33334444', l, SAL_T, V), 'B');
  eq(await quemE('11112223', l, SAL_T, V), null); eq(await verificarPin('33334444', l, SAL_T, V), true);
});
test('só aceita 4 a 12 algarismos', async () => {
  const l = await lista();
  for (const p of ['', '123', 'abcd1234', '1111 2222', '1234567890123', null, undefined, 11112222]) eq(await quemE(p, l, SAL_T, V), null);
});
test('PIN óbvios não abrem a app verdadeira', async () => {
  for (const p of ['0000', '1234', '00000000', '12345678']) eq(await quemE(p), null);
});
test('lista vazia ou mal formada nunca dá acesso', async () => {
  eq(await quemE('11112222', [], SAL_T, V), null); eq(await quemE('11112222', [null, {}, { nome: 'x', h: 5 }], SAL_T, V), null);
});
test('quatro falhas não bloqueiam; a quinta obriga a esperar 30 segundos', async () => {
  await limpo(); const t0 = 1e12;
  for (let i = 0; i < 4; i++) eq(await registarFalha(t0), 0);
  eq(await esperaSegundos(t0), 0);
  eq(await registarFalha(t0), 30); eq(await esperaSegundos(t0), 30); eq(await esperaSegundos(t0 + 31000), 0);
  await limparFalhas();
});
test('a espera duplica a cada 5 falhas e não passa de 1 hora', async () => {
  await limpo(); const t0 = 1e12; const esperas = [];
  for (let i = 1; i <= 50; i++) { const e = await registarFalha(t0); if (e) esperas.push(e); }
  eq(esperas.slice(0, 4), [30, 60, 120, 240]); eq(esperas[esperas.length - 1], 3600);
  await limparFalhas();
});
test('as falhas ficam guardadas (recarregar não as apaga) e entrar com sucesso limpa-as', async () => {
  await limpo(); const t0 = Date.now();
  for (let i = 0; i < 5; i++) await registarFalha(t0);
  await store.abrir('nc-teste'); ok(await esperaSegundos(t0) > 0);
  await limparFalhas(); eq(await esperaSegundos(t0), 0); eq(await registarFalha(t0), 0);
  await limparFalhas();
});
