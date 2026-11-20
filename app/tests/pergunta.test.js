// Pergunta de confirmação desenhada na página (os navegadores embutidos e o «impedir mais caixas» bloqueiam o confirm()).
import { test, eq, ok } from './t.js';
import { pergunta } from '../js/pergunta.js';

const caixa = () => document.querySelector('.pergunta');
const carrega = sel => caixa().querySelector(sel).click();

test('mostra o texto e responde sim ao carregar no botão de confirmar', async () => {
  const p = pergunta('Apagar a obra «A <b>x</b>»?', { sim: 'Apagar' });
  ok(caixa()); ok(caixa().textContent.includes('Apagar a obra «A <b>x</b>»?'), 'o texto aparece tal e qual (escapado)');
  eq(caixa().querySelector('[data-r="sim"]').textContent, 'Apagar');
  carrega('[data-r="sim"]'); eq(await p, true); ok(!caixa(), 'a caixa fecha');
});
test('responde não ao cancelar, ao carregar fora e com Escape', async () => {
  let p = pergunta('Apagar?'); carrega('[data-r="nao"]'); eq(await p, false);
  p = pergunta('Apagar?'); caixa().click(); eq(await p, false);
  p = pergunta('Apagar?'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); eq(await p, false);
  ok(!caixa());
});
test('só aviso (sem escolha): um único botão OK que responde verdadeiro', async () => {
  const p = pergunta('Ficheiro inválido.', { so: true });
  eq(caixa().querySelectorAll('button').length, 1); carrega('button'); eq(await p, true);
});
test('não dependem do confirm() do navegador: nenhum ficheiro da app o usa', async () => {
  for (const f of ['app.js', 'formularios.js', 'assistente.js', 'importar.js']) {
    const txt = await (await fetch('/js/' + f + '?v=' + Date.now())).text();
    ok(!/\b(confirm|alert|prompt)\(/.test(txt), f + ' ainda usa confirm/alert/prompt');
  }
});
