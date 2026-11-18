import { test, eq, ok } from './t.js';
import * as store from '../js/store.js';
import { reduzirFoto, guardarFoto, lerFoto, apagarFotos, copiarFotos, MAX_FOTOS } from '../js/fotos.js';
import { folhaPreparacao } from '../js/folhas.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';

function imagem(w, h, tipo = 'image/png') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, w, h);
  return new Promise(r => c.toBlob(b => r(new File([b], 'foto.png', { type: tipo })), tipo));
}
const medidas = src => new Promise((ok2, ko) => { const i = new Image(); i.onload = () => ok2([i.naturalWidth, i.naturalHeight]); i.onerror = ko; i.src = src; });
const limpo = () => store.abrir('nc-teste');

test('foto grande é reduzida para caber no lado máximo, mantendo a proporção', async () => {
  const url = await reduzirFoto(await imagem(3000, 1500), 1000);
  ok(url.startsWith('data:image/jpeg')); eq(await medidas(url), [1000, 500]);
});
test('foto pequena não é ampliada', async () => {
  eq(await medidas(await reduzirFoto(await imagem(400, 300), 1000)), [400, 300]);
});
test('ficheiro que não é imagem: devolve null, sem exceção', async () => {
  eq(await reduzirFoto(new File(['isto não é uma imagem'], 'x.txt', { type: 'text/plain' })), null);
  eq(await reduzirFoto(new File(['lixo'], 'x.jpg', { type: 'image/jpeg' })), null);
  eq(await reduzirFoto(null), null);
});
test('guardar, ler e apagar fotos', async () => {
  await limpo();
  const f = await guardarFoto(await imagem(800, 600));
  ok(f.id); ok((await lerFoto(f.id)).startsWith('data:image/jpeg'));
  await apagarFotos([f]); eq(await lerFoto(f.id), null);
  eq(await guardarFoto(new File(['x'], 'x.txt', { type: 'text/plain' })), null);
});
test('copiar fotos dá identificadores novos e mantém as legendas', async () => {
  await limpo();
  const f = await guardarFoto(await imagem(200, 100)); f.legenda = 'Canto da varanda';
  const [c] = await copiarFotos([f]);
  ok(c.id !== f.id); eq(c.legenda, 'Canto da varanda'); ok(await lerFoto(c.id));
  await apagarFotos([f]); ok(await lerFoto(c.id), 'apagar o original não apaga a cópia');
  await apagarFotos([c]);
});
test('apagar a obra apaga as fotos dos seus trabalhos', async () => {
  await limpo();
  const f = await guardarFoto(await imagem(200, 100));
  await store.guardarObra({ id: 'ofoto', nome: 'O', trabalhos: [{ id: 't', tipo: 'guarda', medidas: {}, precos: {}, fotos: [f] }], alterado: 1 });
  await store.apagarObra('ofoto'); eq(await lerFoto(f.id), null);
});
test('limite de fotos por trabalho é 12', () => eq(MAX_FOTOS, 12));
test('folha de preparação mostra as fotos com legenda escapada', () => {
  const t = { id: 't', tipo: 'guarda', nome: 'G', medidas: { trocos: [{ comp: 3000 }] }, material: 'aco', acabamento: 'pintado' };
  const res = calcular(t), html = folhaPreparacao({ cliente: '', nome: '', morada: '', numero: '', data: '2026-11-18' }, t, res, planoCorte(res.pecas), '', {},
    [{ src: 'data:image/jpeg;base64,AAAA', legenda: 'Parede <b>torta</b>' }]);
  ok(html.includes('data:image/jpeg;base64,AAAA')); ok(!html.includes('<b>torta</b>')); ok(/Fotos/.test(html));
  ok(!/Fotos/.test(folhaPreparacao({ data: '2026-11-18' }, t, res, planoCorte(res.pecas), '', {})), 'sem fotos não há secção');
});
