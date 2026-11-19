import { test, eq, ok, perto, semNaN } from './t.js';
import { listaPosicoes, aprovisionamento, notasFabrico, escalaPara, pormenorVao, pormenorPe } from '../js/preparacao.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { pesoKg } from '../js/custo.js';
import { alcadoSVG } from '../js/desenho2d.js';
import { folhaPreparacao } from '../js/folhas.js';

const guarda = (m = {}) => ({ tipo: 'guarda', nome: 'Guarda', medidas: { trocos: [{ comp: 3000 }], ...m }, material: 'aco', acabamento: 'pintado' });
const obra = { id: 'o', cliente: 'C', nome: 'Moradia', morada: '', numero: '2026/007', data: '2026-11-19', trabalhos: [] };
const texto = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

test('cada peça fica numa posição e as quantidades batem com o número de peças', () => {
  const res = calcular(guarda()), { posicoes, refDe } = listaPosicoes(res, 'aco');
  eq(posicoes.filter(p => p.tipo === 'perfil').reduce((s, p) => s + p.qtd, 0), res.pecas.length);
  for (const p of res.pecas) ok(refDe.get(p), 'peça sem referência');
  ok(semNaN(posicoes));
});
test('as referências são únicas e têm a letra do grupo', () => {
  const { posicoes } = listaPosicoes(calcular(guarda()), 'aco');
  const refs = posicoes.map(p => p.ref);
  eq(new Set(refs).size, refs.length);
  ok(refs.includes('C1'), 'corrimão'); ok(refs.includes('P1'), 'prumo'); ok(refs.includes('T1'), 'travessa'); ok(refs.includes('V1'), 'varão');
});
test('peças iguais ficam na mesma posição', () => {
  const res = calcular(guarda()), { posicoes } = listaPosicoes(res, 'aco');
  const prumos = posicoes.filter(p => p.grupo === 'prumo');
  eq(prumos.length, 1); eq(prumos[0].qtd, res.pecas.filter(p => p.grupo === 'prumo').length);
});
test('o peso das posições é igual ao peso do trabalho', () => {
  const res = calcular(guarda({ enchimento: 'chapa' })), { posicoes } = listaPosicoes(res, 'aco');
  perto(posicoes.reduce((s, p) => s + p.kg, 0), pesoKg(res, 'aco'), 0.05);
  const p = posicoes[0]; perto(p.kg, p.kgUn * p.qtd, 0.02);
});
test('corte em esquadria escreve-se 90°/90° e a meia-esquadria 45°', () => {
  const res = calcular(guarda({ trocos: [{ comp: 2000 }, { comp: 2000, viragem: 90 }] })), { posicoes } = listaPosicoes(res, 'aco');
  eq(posicoes.find(p => p.grupo === 'prumo').corte, '90°/90°');
  const c = posicoes.filter(p => p.grupo === 'corrimao').map(p => p.corte);
  ok(c.some(x => x.includes('45°')), 'corrimão sem 45°: ' + c.join(' '));
});
test('painéis de chapa e de vidro também têm posição com dimensão', () => {
  const ch = listaPosicoes(calcular(guarda({ enchimento: 'chapa' })), 'aco').posicoes.find(p => p.tipo === 'painel');
  ok(ch && /^CH\d/.test(ch.ref)); ok(/\d+ × \d+/.test(ch.dim)); ok(ch.kg > 0);
  const vd = listaPosicoes(calcular(guarda({ enchimento: 'vidro' })), 'aco').posicoes.find(p => p.tipo === 'painel');
  ok(vd && /^VD\d/.test(vd.ref)); eq(vd.kg, 0);
});
test('os quatro tipos de trabalho dão posições sem erros', () => {
  for (const t of [{ tipo: 'corrimao', medidas: { comp: 3000 } }, { tipo: 'portao', medidas: { largura: 3000 } },
    { tipo: 'tubagem', medidas: { dn: 50, trocos: [{ comp: 2000, dir: 'dir' }, { comp: 1000, dir: 'tras' }] } }]) {
    const res = calcular(t), { posicoes } = listaPosicoes(res, 'aco');
    ok(res.pecas.length > 0, t.tipo + ' sem peças'); ok(posicoes.length > 0); ok(semNaN(posicoes));
  }
});
test('trabalho vazio dá lista vazia', () => {
  eq(listaPosicoes(calcular(guarda({ trocos: [{ comp: '' }] })), 'aco').posicoes, []);
});

test('aprovisionamento: o número de varas bate com o plano de corte e os cortes levam a referência', () => {
  const res = calcular(guarda()), plano = planoCorte(res.pecas), ap = aprovisionamento(res, plano, 'aco');
  eq(ap.varas.length, plano.porPerfil.length);
  for (let i = 0; i < ap.varas.length; i++) {
    eq(ap.varas[i].nVaras, plano.porPerfil[i].nVaras);
    eq(ap.varas[i].padroes.reduce((s, p) => s + p.vezes, 0), plano.porPerfil[i].varas.length);
    for (const pd of ap.varas[i].padroes) for (const c of pd.cortes) ok(/^[A-Z]+\d+$/.test(c.ref), 'corte sem referência');
  }
  ok(ap.compra.some(a => /sapata/i.test(a.nome)));
});
test('aprovisionamento junta os painéis por tipo', () => {
  const res = calcular(guarda({ enchimento: 'vidro' })), ap = aprovisionamento(res, planoCorte(res.pecas), 'aco');
  eq(ap.chapas.length, 1); ok(ap.chapas[0].m2 > 0); ok(/vidro/i.test(ap.chapas[0].nome));
});

test('notas de fabrico: aço soldado a MAG, inox a TIG, e o tratamento segue o acabamento', () => {
  const t = guarda(), n = notasFabrico(t, calcular(t)).map(b => b.titulo + ' ' + b.linhas.join(' ')).join(' ');
  ok(/MAG/.test(n)); ok(/pintura|primário/i.test(n)); ok(/CONFIRMAR/.test(n));
  const ti = { ...t, material: 'inox304', acabamento: 'escovado' }, ni = notasFabrico(ti, calcular(ti)).map(b => b.linhas.join(' ')).join(' ');
  ok(/TIG/.test(ni)); ok(/escovad/i.test(ni)); ok(!/MAG/.test(ni));
});

test('escala normalizada: a maior em que o desenho cabe na caixa', () => {
  eq(escalaPara(3000, 1100, 400, 130), 10);
  eq(escalaPara(3000, 1100, 200, 80), 20);
  eq(escalaPara(100, 100, 200, 200), 1);
  eq(escalaPara(60000, 1100, 400, 130), 200);
  eq(escalaPara(0, NaN, 400, 130), 1);
});

test('alçado com balões mostra cada referência uma vez', () => {
  const res = calcular(guarda()), { refDe } = listaPosicoes(res, 'aco');
  const svg = alcadoSVG(res, { refs: refDe, fino: true });
  for (const r of ['C1', 'P1', 'T1', 'V1']) eq((svg.match(new RegExp('>' + r + '<', 'g')) || []).length, 1);
  ok(!alcadoSVG(res).includes('>P1<'), 'sem opção não há balões');
});
test('pormenor do vão tipo mostra a folga entre varões', () => {
  const res = calcular(guarda()), svg = pormenorVao(res);
  ok(svg.startsWith('<svg')); ok(svg.includes('>' + Math.round(res.vaos[0].folga) + '<'), 'falta a folga');
  eq(pormenorVao(calcular(guarda({ trocos: [{ comp: '' }] }))), '');
});
test('pormenor do pé do prumo existe com sapata e avisa que é a confirmar', () => {
  const svg = pormenorPe(calcular(guarda()));
  ok(svg.svg.startsWith('<svg')); ok(/confirmar/i.test(svg.nota));
  eq(pormenorPe(calcular({ tipo: 'tubagem', medidas: { dn: 50, trocos: [{ comp: 2000, dir: 'dir' }] } })), null);
});

test('folha de preparação: folhas A3 numeradas, legenda, posições, corte e notas, sem preços', () => {
  const t = guarda(), res = calcular(t), plano = planoCorte(res.pecas);
  const html = folhaPreparacao(obra, t, res, plano, '', { desenhou: 'N. Camarate' }), tx = texto(html);
  const n = (html.match(/class="a3"/g) || []).length;
  ok(n >= 3, 'esperava pelo menos 3 folhas, há ' + n);
  for (let i = 1; i <= n; i++) ok(tx.includes(`${i}/${n}`), `falta folha ${i}/${n}`);
  for (const p of ['lista de posições', 'lista de corte', 'aprovisionamento', 'soldadura', 'desenho n.º', '2026/007', 'n. camarate', 'alçado 1:', 'p1', 'moradia'])
    ok(tx.includes(p), 'falta «' + p + '»');
  ok(!tx.includes('€'));
});
test('folha de preparação: muitas posições continuam noutra folha em vez de transbordar', () => {
  const trocos = Array.from({ length: 30 }, (_, i) => ({ comp: 900 + i * 37, dir: i % 2 ? 'tras' : 'dir' }));
  const t = { tipo: 'tubagem', nome: 'Linha', medidas: { dn: 50, trocos }, material: 'inox304', acabamento: 'nenhum' };
  const res = calcular(t), html = folhaPreparacao(obra, t, res, planoCorte(res.pecas), '', {});
  ok(texto(html).includes('continuação'), 'sem folha de continuação');
});
test('folha de preparação com fotos junta uma folha de fotos e escapa texto', () => {
  const t = { ...guarda(), nome: '<b>x</b>' }, res = calcular(t);
  const html = folhaPreparacao(obra, t, res, planoCorte(res.pecas), '', {}, [{ src: 'data:image/png;base64,AAAA', legenda: 'Canto <i>norte</i>' }]);
  ok(texto(html).includes('fotos de obra')); ok(!html.includes('<b>x</b>')); ok(!html.includes('<i>norte</i>'));
});
