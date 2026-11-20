// Desenho para o cliente: alçado, planta e 3D com as medidas gerais, para aprovação. Sem preços nem nada da oficina.
import { test, eq, ok } from './t.js';
import { folhaCliente } from '../js/folhas.js';
import { calcular } from '../js/calc.js';

const obra = { id: 'o', cliente: 'João <b>Silva</b>', nome: 'Moradia', morada: 'Rua A', numero: '2026/001', data: '2026-11-18', trabalhos: [] };
const guarda = { id: 'g', tipo: 'guarda', nome: 'Guarda da varanda', medidas: { trocos: [{ comp: 3000 }], altura: 1100 }, material: 'aco', acabamento: 'pintado', corNome: 'RAL 7016',
  notas: 'NOTA-INTERNA-OFICINA', confirmar: 'CONFIRMAR-INTERNO', margem: 30, horasMontagem: 4 };
const portao = { id: 'p', tipo: 'portao', nome: 'Portão', medidas: { largura: 3000, altura: 1800 }, material: 'aco', acabamento: 'galvanizado' };
const item = (t, extra = {}) => ({ trabalho: t, res: calcular(t), descricao: 'Guarda com 3,00 m', imagem: 'data:image/png;base64,AAAA', ...extra });
const texto = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const folhas = html => (html.match(/<article class="folha f-cliente">/g) || []).length;

test('uma folha por trabalho, com nome, descrição, material, alçado, planta e 3D', () => {
  const h = folhaCliente(obra, [item(guarda), item(portao, { descricao: 'Portão de 2 folhas' })], {}), t = texto(h);
  eq(folhas(h), 2); ok(t.includes('desenho para aprovação')); ok(t.includes('guarda da varanda')); ok(t.includes('portão de 2 folhas'));
  ok(t.includes('ral 7016')); ok(t.includes('alçado')); ok(t.includes('planta')); ok(h.includes('<img class="f-3d"'));
  ok((h.match(/<svg/g) || []).length >= 4);
});
test('mostra as medidas gerais (3000 e 1100), mas não as cotas de cada vão', () => {
  const r = calcular(guarda), vaos = r.cotas.filter(c => c.nivel === 1).map(c => c.texto);
  ok(vaos.length > 1 && !vaos.includes('3000'));
  const h = folhaCliente(obra, [item(guarda)], {}), alc = h.slice(h.indexOf('<figure class="f-des"'), h.indexOf('</figure>', h.indexOf('<figure class="f-des"')));
  ok(alc.includes('>3000<')); ok(alc.includes('>1100<'));
  for (const v of vaos) ok(!alc.includes('>' + v + '<'), 'cota de vão ' + v);
});
test('nunca mostra preços, margem, horas, notas da oficina nem lista de corte', () => {
  const h = folhaCliente(obra, [item(guarda)], {}), t = texto(h);
  for (const p of ['€', 'margem', 'custo', 'hora', 'lista de corte', 'posições', 'nota-interna-oficina', 'confirmar-interno', 'vara(s)', 'varas a comprar']) ok(!t.includes(p), 'contém «' + p + '»');
});
test('tem a nota de medidas a confirmar em obra e o espaço para o cliente aprovar', () => {
  const t = texto(folhaCliente(obra, [item(guarda)], {}));
  ok(t.includes('a confirmar em obra')); ok(t.includes('aprovação do cliente')); ok(t.includes('assinatura')); ok(t.includes('data'));
});
test('escapa o texto escrito pelo utilizador', () => {
  ok(!folhaCliente(obra, [item(guarda)], {}).includes('<b>Silva</b>'));
});
test('trabalho livre (sem desenho automático) leva só a descrição e a fotografia do rascunho', () => {
  const livre = { id: 'l', tipo: 'livre', nome: 'Suporte', medidas: { pecas: [{ perfil: 'tq40x2', comp: 1000, qtd: 2 }] }, material: 'aco', acabamento: 'pintado' };
  const h = folhaCliente(obra, [item(livre, { descricao: 'Suporte da máquina', imagem: '', fotos: [{ src: 'data:image/png;base64,BBBB' }] })], {});
  eq(folhas(h), 1); ok(texto(h).includes('suporte da máquina')); ok(!h.includes('<svg class')); ok(h.includes('BBBB'));
});
test('sem trabalhos devolve vazio', () => { eq(folhaCliente(obra, [], {}), ''); });
