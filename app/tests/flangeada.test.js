import { test, eq, ok, perto, semNaN } from './t.js';
import { calcFlangeada, DEF_FLANGEADA, FLANGES, parafuso } from '../js/modelos/flangeada.js';
import { calcTubagem } from '../js/modelos/tubagem.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { listaPosicoes, aprovisionamento } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { alcadoSVG, plantaSVG } from '../js/desenho2d.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

const T = (comp, dir = 'dir') => ({ tipo: 'tubo', comp, dir });
const linha = (itens, m = {}) => calcFlangeada({ letra: 'A', dn: 300, esp: 3, pn: 10, nIni: 1, ini: 'ffd', fim: 'ffd', itens, ...m });
const F = r => r.flangeada, ac = (r, ref, suf) => r.acessorios.filter(a => a.ref === ref && (!suf || a.sufixo === suf)).reduce((s, a) => s + a.qtd, 0);

test('o tipo existe e, sem peças na linha, pede a primeira', () => {
  ok(TIPOS.flangeada && !TIPOS.flangeada.oculto); eq(calcFlangeada({}).pecas.length, 0); ok(calcFlangeada({}).avisos.length > 0);
  eq(calcular({ tipo: 'flangeada', medidas: JSON.parse(JSON.stringify(DEF_FLANGEADA)) }).pecas.length, 0);
});
test('tabela de flanges EN 1092-1: PN10 e PN16 para todos os diâmetros da app, e os valores do exemplo', () => {
  eq(FLANGES[10][300], { D: 445, K: 400, n: 12, h: 22, M: 20 }); eq(FLANGES[10][100], { D: 220, K: 180, n: 8, h: 18, M: 16 });
  eq(FLANGES[10][65], { D: 185, K: 145, n: 8, h: 18, M: 16 }); eq(FLANGES[10][500], { D: 670, K: 620, n: 20, h: 26, M: 24 }); eq(FLANGES[10][200].n, 8);
  eq(FLANGES[16][200].n, 12); eq(FLANGES[16][300], { D: 460, K: 410, n: 12, h: 26, M: 24 });
  for (const pn of [10, 16]) for (const dn of [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600]) { const f = FLANGES[pn][dn]; ok(f && f.D > f.K && f.K > dn && f.n % 4 === 0, pn + '/' + dn); }
});
test('comprimento do parafuso: como no exemplo (DN300 inox–ferro com kit dá M20 × 100)', () => {
  eq(parafuso(300, 10, 'inox-FFD'), { M: 20, n: 12, L: 100, L0: 93 });       // 32 + 25 + 9 + 2×3 + 16 + 5
  eq(parafuso(300, 10, 'inox-inox').L0, 94); eq(parafuso(300, 10, 'ferro-ferro').L0, 80); eq(parafuso(100, 10, 'inox-FFD').L, 80);
});
test('um tubo reto entre dois equipamentos: um troço, duas ligações com kit de isolamento', () => {
  const r = linha([T(950)]), f = F(r);
  eq(f.trocos.map(t => [t.id, t.nome, t.L, t.ends]), [['A1', 'Tubo reto DN300', '950', [1, 2]]]);
  eq(f.ligacoes.map(l => [l.n, l.tipo, l.dn, l.kit, l.nossas]), [[1, 'inox-FFD', 300, true, 1], [2, 'inox-FFD', 300, true, 1]]);
  eq(f.ligacoes[0].parafuso, { M: 20, n: 12, L: 100, L0: 93 });
  eq(f.resumo, { parafusos: { 'M20 × 100': 24 }, flanges: { DN300: 2 }, juntas: {}, kits: { DN300: 2 } });
  eq(r.pecas.length, 1); eq([r.pecas[0].L, r.pecas[0].perfil], [950, 'tu300x3']);
  eq(ac(r, 'flange_solta'), 2); eq(ac(r, 'colar_inox'), 2); eq(ac(r, 'kit_isolamento'), 2); eq(ac(r, 'junta_epdm'), 0); eq(ac(r, 'parafuso_a4', 'M20×100'), 24);
  ok(semNaN(r));
});
test('uma válvula a meio parte a linha em dois troços e junta duas ligações; aparece nos equipamentos', () => {
  const r = linha([T(950), { tipo: 'valvula', comp: 319 }, T(305)]), f = F(r);
  eq(f.trocos.map(t => [t.id, t.L, t.ends]), [['A1', '950', [1, 2]], ['A2', '305', [3, 4]]]);
  eq(f.ligacoes.map(l => l.tipo), ['inox-FFD', 'inox-FFD', 'inox-FFD', 'inox-FFD']);
  eq(f.equipamentos.map(e => [e.nome, e.dn, e.comp, e.ligs]), [['Válvula de seccionamento (volante)', 300, 319, [2, 3]]]);
  perto(r.pecas[1].a[0], 950 + 319, 0.1); eq(r.comprimentoTotal, 950 + 319 + 305);
  eq(f.ligacoes[1].entre, ['A1', 'Válvula de seccionamento (volante)']);
});
test('ligação flangeada entre dois troços de inox: junta EPDM, duas flanges nossas; a ponta para outra linha de inox leva uma', () => {
  const r = linha([T(1000), { tipo: 'flange' }, T(500)], { fim: 'inox' }), f = F(r);
  eq(f.trocos.map(t => t.ends), [[1, 2], [2, 3]]);
  eq(f.ligacoes.map(l => [l.tipo, l.kit, l.nossas]), [['inox-FFD', true, 1], ['inox-inox', false, 2], ['inox-inox', false, 1]]);
  eq(f.resumo.flanges, { DN300: 4 }); eq(f.resumo.juntas, { DN300: 2 }); eq(f.resumo.kits, { DN300: 1 });
  eq(f.resumo.parafusos, { 'M20 × 100': 36 }); eq(ac(r, 'junta_epdm'), 2);
});
test('dois equipamentos seguidos ligam ferro com ferro: junta EPDM e nenhuma flange nossa', () => {
  const f = F(linha([T(500), { tipo: 'junta_desm', comp: 370 }, { tipo: 'valvula_mot', comp: 250 }, T(600)]));
  eq(f.ligacoes.map(l => [l.n, l.tipo, l.nossas]), [[1, 'inox-FFD', 1], [2, 'inox-FFD', 1], [3, 'ferro-ferro', 0], [4, 'inox-FFD', 1], [5, 'inox-FFD', 1]]);
  eq(f.resumo.juntas, { DN300: 1 }); eq(f.resumo.parafusos, { 'M20 × 100': 48, 'M20 × 80': 12 }); eq(f.equipamentos.length, 2);
});
test('mudança de direção dentro do troço: curva de raio 1,5 × DN, tubos descontados e comprimentos ao eixo', () => {
  const r = linha([T(1000), T(800, 'cima')], { dn: 100, esp: 2 }), t = F(r).trocos[0];
  eq([t.nome, t.L], ['Peça com 1 curva 90° DN100', '1000 + 800 (ao eixo)']);
  eq(r.pecas.map(p => p.L), [850, 650]); eq(ac(r, 'curva_inox', 'DN100'), 1);
  eq(r.arcos3d.length, 1); eq(r.curvas2d.length, 1); ok(r.curvas2d[0].pts.length >= 8);
  perto(r.arcos3d[0].pts[0][0], 850, 0.1); perto(r.arcos3d[0].pts.at(-1)[1], 150, 0.1); perto(r.arcos3d[0].pts.at(-1)[0], 1000, 0.1);
});
test('curva logo a seguir a um equipamento: começa à face da flange e a medida é face-eixo', () => {
  const r = linha([T(500), { tipo: 'valvula', comp: 200 }, T(600, 'cima')], { dn: 100, esp: 2 }), t = F(r).trocos[1];
  eq(t.L, '150 (face-eixo) + 600'); eq(t.nome, 'Peça com 1 curva 90° DN100'); eq(r.pecas[1].L, 450);
  eq(r.pecas[1].b, [850, 600, 0]); eq(F(r).ligacoes.at(-1).p, [850, 600, 0]);
});
test('redução: muda o diâmetro a meio do troço e as ligações seguintes já são do diâmetro novo', () => {
  const r = linha([T(500), { tipo: 'reducao', dn2: 65, comp: 100 }, T(300)], { dn: 100, esp: 2 }), f = F(r);
  eq([f.trocos[0].nome, f.trocos[0].L, f.trocos[0].dn], ['Tubo com redução DN100→DN65', '900', 'DN100 → DN65']);
  eq(r.pecas.map(p => p.perfil), ['tu100x2', 'tu65x2']); eq(f.ligacoes.map(l => l.dn), [100, 65]);
  eq(f.resumo.flanges, { DN65: 1, DN100: 1 }); eq(ac(r, 'reducao_inox'), 1); eq(f.ligacoes[1].flange.n, 8);
});
test('tê: o ramal acaba numa flange, com a sua ligação e o seu diâmetro', () => {
  const r = linha([T(260), { tipo: 'te', dn2: 100, dirR: 'frente', compR: 305, ramal: 'inox' }, T(260)]), f = F(r);
  eq([f.trocos[0].nome, f.trocos[0].ends, f.trocos[0].L], ['Tê DN300×DN100', [1, 2, 3], '520 (passagem) · 305 (derivação)']);
  eq(f.ligacoes.map(l => [l.n, l.dn, l.tipo]), [[1, 300, 'inox-FFD'], [2, 100, 'inox-inox'], [3, 300, 'inox-FFD']]);
  eq(f.ligacoes[1].p, [260, 0, -305]); eq(ac(r, 'te_inox'), 1); eq(r.pecas.filter(p => p.perfil === 'tu100x3').length, 1);
  eq(F(linha([T(260), { tipo: 'te' }, T(260)])).trocos[0].nome, 'Tê DN300');
});
test('numeração e pontas: letra e primeiro número à escolha; ponta livre sem flange; ligação já contada só leva a flange', () => {
  const f = F(linha([T(500), { tipo: 'flange' }, T(500)], { letra: 'c', nIni: 40, ini: 'livre', fim: 'contada' }));
  eq(f.trocos.map(t => t.id), ['C1', 'C2']); eq(f.ligacoes.map(l => l.n), [40]);
  eq(f.trocos[0].ends, [{ livre: 'Ponta livre, sem flange' }, 40]); eq(f.trocos[1].ends, [40, { livre: 'Flange; ligação contada noutra linha' }]);
  eq(f.resumo.flanges, { DN300: 3 }); eq(f.resumo.parafusos, { 'M20 × 100': 12 });
});
test('PN16 muda as flanges e os parafusos', () => {
  const f = F(linha([T(950)], { pn: 16 }));
  eq(f.ligacoes[0].flange, FLANGES[16][300]); eq(f.ligacoes[0].parafuso.M, 24); eq(f.pn, 16);
});
test('entradas más não rebentam: peça desconhecida, volta para trás, flange sem tubo e medidas absurdas dão aviso', () => {
  const r = linha([{ tipo: 'foguetao' }, { tipo: 'flange' }, T(500), T(300, 'esq'), T(9e8), T(''), { tipo: 'valvula', comp: -4 }, { tipo: 'te', dn2: 9999 }, T(400, 'cima')]);
  ok(r.pecas.length >= 2); ok(semNaN(r)); ok(r.avisos.length >= 3, r.avisos.join(' | '));
  ok(r.avisos.some(a => /volta para trás/i.test(a))); ok(F(r).ligacoes.every(l => l.flange && l.parafuso.L > 0));
  eq(calcFlangeada({ itens: 'x' }).pecas.length, 0); eq(calcFlangeada({ dn: 7, itens: [T(500)] }).flangeada.trocos[0].dn, 'DN100');
});
test('custo: flanges, colares, juntas, kits e parafusos têm preço de exemplo; nada fica sem preço', () => {
  const t = { id: 't', tipo: 'flangeada', nome: 'Linha A', medidas: { dn: 300, esp: 3, itens: [T(950), { tipo: 'valvula', comp: 319 }, T(1000), T(800, 'cima'), { tipo: 'flange' }, T(500)], fim: 'inox' }, material: 'inox316', acabamento: 'decapado', margem: 30, horasOficina: null, horasMontagem: 8 };
  const res = calcular(t), c = custo(t, res, planoCorte(res.pecas), JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(semNaN(c)); ok(c.acessorios > 0 && c.material > 0); ok(c.oficinaH > 0);
  for (const p of [/Flange solta.*DN300/, /Colar de soldar.*DN300/, /Kit de isolamento.*DN300/, /Junta plana EPDM.*DN300/, /Parafuso.*M20×100/, /Curva 90°.*DN300/]) ok(c.linhas.some(l => p.test(l.desc)), 'falta ' + p);
});
test('preparação: os tubos levam o troço no nome, e as folhas têm troços, ligações, parafusaria e resumo de encomenda', () => {
  const t = { id: 't', tipo: 'flangeada', nome: 'Linha A', medidas: { dn: 300, esp: 3, itens: [T(950), { tipo: 'valvula', comp: 319 }, T(1000), T(800, 'cima')] }, material: 'inox316', acabamento: 'decapado' };
  const res = calcular(t), plano = planoCorte(res.pecas), pos = listaPosicoes(res, 'inox316').posicoes;
  eq(pos.map(p => [p.ref, p.designacao]), [['TB1', 'Tubo do troço A1'], ['TB2', 'Tubo do troço A2'], ['TB3', 'Tubo do troço A2']]);
  ok(!aprovisionamento(res, plano, 'inox316').varas.flatMap(v => v.padroes.flatMap(p => p.cortes.map(c => c.ref))).includes('?'));
  const html = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1700', trabalhos: [t] }, t, res, plano, '', {}), tx = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  for (const p of ['troços e ligações', 'peça com 1 curva 90° dn300', 'kit de isolamento', '12 × m20 × 100', 'resumo de encomenda', 'pressuposto', 'válvula de seccionamento', 'isométrico', 'a confirmar em obra']) ok(tx.includes(p), 'falta «' + p + '»');
  ok(!/NaN|undefined/.test(html)); ok(html.includes('1700-F1'));
});
test('desenho: curvas com o raio verdadeiro, etiquetas dos troços e número das ligações; sem bolas nas curvas', () => {
  const r = linha([T(950), { tipo: 'valvula', comp: 319 }, T(1000), T(800, 'cima')]), svg = alcadoSVG(r);
  ok(svg.startsWith('<svg')); ok(!/NaN|undefined/.test(svg + plantaSVG(r)));
  ok(svg.includes('class="arco"'), 'curva desenhada como arco'); ok(svg.includes('>A1<') && svg.includes('>A2<')); ok(svg.includes('class="lig o"'));
  ok(svg.includes('>950<') && svg.includes('>800<')); ok(svg.includes('class="eq"'), 'equipamento desenhado');
});
test('a tubagem soldada também passou a desenhar as curvas com o raio verdadeiro', () => {
  const r = calcTubagem({ dn: 50, esp: 2, trocos: [{ comp: 1000, dir: 'dir' }, { comp: 800, dir: 'cima' }, { comp: 500, dir: 'frente' }] });
  eq(r.curvas2d.length, 2); eq(r.arcos3d.length, 2); perto(r.arcos3d[0].r, 60.3 / 2, 0.01);
  const svg = alcadoSVG(r); eq(svg.split('class="arco"').length - 1, 2); ok(!/NaN/.test(svg));
});

// --- curva como peça própria, com o ângulo tirado no local ---
const C = (ang, para, angOutro) => ({ tipo: 'curva', ang, para, angOutro });
const dn100 = itens => linha(itens, { dn: 100, esp: 2 });
test('curva a 45°: o tubo seguinte segue inclinado, e os dois tubos descontam a tangente da curva', () => {
  const r = dn100([T(1000), C(45, 'cima'), T(800, 'segue')]), t = F(r).trocos[0], tg = 150 * Math.tan(Math.PI / 8);
  eq([t.nome, t.L, t.angulos], ['Peça com 1 curva 45° DN100', '1000 + 800 (ao eixo)', [45]]);
  perto(r.pecas[0].L, 1000 - tg, 0.11); perto(r.pecas[1].L, 800 - tg, 0.11);
  const fimLinha = F(r).ligacoes.at(-1).p; perto(fimLinha[0], 1000 + 800 * Math.SQRT1_2, 0.1); perto(fimLinha[1], 800 * Math.SQRT1_2, 0.1); eq(fimLinha[2], 0);
  eq(ac(r, 'curva45_inox', 'DN100'), 1); eq(ac(r, 'curva_inox'), 0); ok(semNaN(r));
  const a = r.arcos3d[0].pts; perto(a[0][0], 1000 - tg, 0.1); perto(a.at(-1)[0], 1000 + tg * Math.SQRT1_2, 0.1); perto(a.at(-1)[1], tg * Math.SQRT1_2, 0.1);
});
test('curva a 90° posta à mão dá o mesmo que mudar a direção do tubo', () => {
  const a = dn100([T(1000), C(90, 'cima'), T(800, 'segue')]), b = dn100([T(1000), T(800, 'cima')]);
  eq(a.pecas.map(p => [p.L, p.a, p.b]), b.pecas.map(p => [p.L, p.a, p.b])); eq(F(a).trocos, F(b).trocos); eq(F(a).ligacoes.map(l => l.p), F(b).ligacoes.map(l => l.p));
  eq(ac(a, 'curva_inox', 'DN100'), 1);
});
test('outros ângulos: 30°, 22,5° e um ângulo medido no local ficam no nome do troço e na lista de compra', () => {
  eq(F(dn100([T(1000), C(30, 'tras'), T(800, 'segue')])).trocos[0].nome, 'Peça com 1 curva 30° DN100');
  eq(F(dn100([T(1000), C(22.5, 'frente'), T(800, 'segue')])).trocos[0].nome, 'Peça com 1 curva 22,5° DN100');
  const r = dn100([T(1000), C('outro', 'baixo', '37'), T(800, 'segue')]);
  eq(F(r).trocos[0].nome, 'Peça com 1 curva 37° DN100'); eq(ac(r, 'curva_ang_inox', '37° DN100'), 1);
  eq(F(dn100([T(1000), C(90, 'cima'), T(800, 'segue'), C(45, 'dir'), T(600, 'segue')])).trocos[0].nome, 'Peça com 2 curvas (90° + 45°) DN100');
  eq(F(dn100([T(1000), C(45, 'cima'), T(800, 'segue'), C(45, 'dir'), T(600, 'segue')])).trocos[0].nome, 'Peça com 2 curvas 45° DN100');
});
test('curva soldada logo antes de um equipamento: a medida vai do eixo à face', () => {
  const r = dn100([T(500), C(90, 'cima'), { tipo: 'valvula', comp: 200 }, T(300, 'segue')]), f = F(r);
  eq(f.trocos[0].L, '500 + 150 (eixo-face)'); eq(r.pecas[0].L, 350); eq(f.ligacoes[1].p, [500, 150, 0]); eq(r.pecas[1].a, [500, 350, 0]); eq(r.pecas[1].b, [500, 650, 0]);
});
test('duas curvas seguidas sem tubo no meio: a medida entre elas é de eixo a eixo', () => {
  const f = F(dn100([T(500), C(90, 'cima'), C(90, 'dir'), T(400, 'segue')]));
  eq(f.trocos[0].L, '500 + 300 + 400 (ao eixo)'); eq(f.trocos[0].curvas, 2);
});
test('curva mal definida dá aviso em vez de desenho errado', () => {
  const av = itens => dn100(itens).avisos.join(' | ');
  ok(/para que lado/i.test(av([T(500), C(90, 'dir'), T(300, 'segue')]))); ok(/para que lado/i.test(av([T(500), C(90, ''), T(300, 'segue')])));
  ok(/ângulo/i.test(av([T(500), C('outro', 'cima', ''), T(300, 'segue')]))); ok(/ângulo/i.test(av([T(500), C(170, 'cima'), T(300, 'segue')])));
  ok(/mais de 90/i.test(av([T(500), C(45, 'cima'), T(300, 'esq')])));
});
test('tudo o que é de um troço fica marcado com o nome dele, para a ficha e para o clique no 3D', () => {
  const r = dn100([T(1000), C(45, 'cima'), T(800, 'segue'), { tipo: 'valvula', comp: 200 }, T(500, 'segue'), { tipo: 'reducao', dn2: 65, comp: 100 }, T(300, 'segue')]);
  ok(r.pecas.every(p => p.tro)); ok(r.arcos3d.every(a => a.tro === 'A1') && r.curvas2d.every(a => a.tro === 'A1'));
  eq(r.etiquetas3d.filter(e => e.tro).map(e => e.txt), ['A1', 'A2']); eq(r.etiquetas3d.filter(e => e.lig).map(e => e.txt), ['1', '2', '3', '4']);
  ok(r.blocos3d.some(b => b.tro === 'A2' && b.tipo === 'reducao')); ok(r.cotas.filter(c => c.tro === 'A1').length === 2);
});

// --- ficha de cada troço ---
test('ficha de um troço: desenho só dessa peça, o que está do outro lado de cada ligação e o total de parafusos', async () => {
  const { fichaTroco, tabelaLigacoes, subTroco } = await import('../js/fichas.js');
  const r = linha([T(950), { tipo: 'valvula', comp: 319 }, T(305), { tipo: 'flange' }, T(500)]), f = fichaTroco(r, 'A1');
  eq(f.troco.id, 'A1'); eq(f.ligs.map(l => [l.n, l.outro, l.partilhada]), [[1, 'Ferro fundido / equipamento existente', false], [2, 'Válvula de seccionamento (volante)', false]]);
  eq(f.total, { 'M20 × 100': 24 }); ok(f.svg.includes('>950<') && !f.svg.includes('>305<') && !f.svg.includes('>319<'), 'só as cotas deste troço');
  ok(f.svg.includes('>1<') && f.svg.includes('>2<') && !f.svg.includes('>3<'), 'só os números das ligações deste troço');
  const a2 = fichaTroco(r, 'A2'); eq(a2.ligs.map(l => [l.n, l.outro, l.partilhada]), [[3, 'Válvula de seccionamento (volante)', false], [4, 'A3', true]]);
  ok(/Flange solta/.test(a2.ligs[1].dela) && /ferro fundido/.test(a2.ligs[0].dela));
  const h = tabelaLigacoes(a2); ok(h.includes('12 × M20 × 100') && h.includes('Kit de isolamento') && h.includes('contar uma vez')); ok(!/undefined|NaN/.test(h + f.svg));
  eq(fichaTroco(r, 'Z9'), null); eq(subTroco(r, 'A1').pecas.length, 1);
  const livre = fichaTroco(linha([T(500)], { fim: 'livre' }), 'A1'); eq(livre.ligs[1], { livre: 'Ponta livre, sem flange' }); ok(tabelaLigacoes(livre).includes('Ponta livre'));
});
test('as folhas trazem uma ficha por troço, com o ângulo das curvas', () => {
  const t = { id: 't', tipo: 'flangeada', nome: 'Linha A', medidas: { dn: 100, esp: 2, itens: [T(950), { tipo: 'valvula', comp: 319 }, T(1000), { tipo: 'curva', ang: 45, para: 'cima' }, T(800, 'segue')] }, material: 'inox316', acabamento: 'decapado' };
  const res = calcular(t), html = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1700', trabalhos: [t] }, t, res, planoCorte(res.pecas), '', {}), tx = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  for (const p of ['ficha do troço a1', 'ficha do troço a2', 'peça com 1 curva 45° dn100', 'curvas: 45°', 'isométrico do troço', 'total neste troço']) ok(tx.includes(p), 'falta «' + p + '»');
  ok(!/NaN|undefined/.test(html));
});

// --- cada peça que se junta aparece logo no desenho, mesmo antes de ter as medidas todas ---
test('peças acabadas de juntar, ainda sem medidas, já se desenham: a curva vira para um lado e o equipamento leva um comprimento habitual, com aviso', () => {
  const so = itens => dn100([T(500), ...itens]);
  const c = so([{ tipo: 'curva' }]); eq(c.arcos3d.length, 1); eq(F(c).trocos[0].nome, 'Peça com 1 curva 90° DN100'); ok(c.avisos.some(a => /para que lado/i.test(a)));
  eq(F(c).ligacoes.at(-1).p, [500, 150, 0]);
  const v = so([{ tipo: 'valvula' }]); eq(F(v).equipamentos.length, 1); ok(F(v).equipamentos[0].comp >= 150); ok(v.avisos.some(a => /face a face/i.test(a) && /confirme/i.test(a))); eq(v.blocos3d.length, 1);
  const t = so([{ tipo: 'te' }]); eq(F(t).trocos[0].ends.length, 3); eq(t.pecas.length, 2);
  // a curva vertical não pode virar para cima: vira para a direita
  const vert = dn100([T(500, 'cima'), { tipo: 'curva', para: 'cima' }]); eq(vert.arcos3d.length, 1); perto(F(vert).ligacoes.at(-1).p[0], 150, 0.1);
  // cada peça junta mais uma coisa ao desenho
  const passos = [[T(950)], [T(950), { tipo: 'curva', ang: 45, para: 'cima' }], [T(950), { tipo: 'curva', ang: 45, para: 'cima' }, T(600, 'segue')], [T(950), { tipo: 'curva', ang: 45, para: 'cima' }, T(600, 'segue'), { tipo: 'valvula' }]];
  const conta = r => r.pecas.length + r.arcos3d.length + r.blocos3d.length;
  eq(passos.map(p => conta(dn100(p))), [1, 2, 3, 4]);
});

// --- várias linhas no mesmo trabalho ---
const TE = { tipo: 'te', dn2: 100, dirR: 'frente', compR: 305, ramal: 'inox' };
test('uma segunda linha que nasce no ramal de um tê: fica ligada a ele, sem ligação a mais, e continua a numeração', () => {
  const r = linha([T(260), TE, T(260)], { linhas: [{ comeca: 'lig', lig: 2, fim: 'ffd', itens: [T(2210, 'segue'), { tipo: 'valvula', comp: 200 }, T(500, 'segue')] }] }), f = F(r);
  eq(f.trocos.map(t => [t.id, t.dn, t.ends]), [['A1', 'DN300', [1, 2, 3]], ['B1', 'DN100', [2, 4]], ['B2', 'DN100', [5, 6]]]);
  const l2 = f.ligacoes.find(l => l.n === 2); eq([l2.tipo, l2.nossas, l2.entre, l2.dn], ['inox-inox', 2, ['A1', 'B1'], 100]);
  eq(f.ligacoes.map(l => l.n), [1, 2, 3, 4, 5, 6]); eq(f.linhas, ['A', 'B']);
  const b1 = r.pecas.find(p => p.tro === 'B1'); eq(b1.a, [260, 0, -305]); eq(b1.b, [260, 0, -305 - 2210]); eq(b1.perfil, 'tu100x3');
  eq(f.resumo.flanges, { DN100: 5, DN300: 2 }); eq(f.resumo.juntas, { DN100: 1 }); ok(semNaN(r));
  eq(r.comprimentoTotal, 520 + 2210 + 200 + 500);
});
test('uma linha solta começa nas coordenadas dadas e leva a letra seguinte', () => {
  const r = linha([T(950)], { linhas: [{ comeca: 'coord', x: 1000, y: 200, z: -2000, dn: 65, ini: 'livre', fim: 'inox', itens: [T(500, 'cima')] }, { letra: 'h', itens: [T(300, 'dir')] }] }), f = F(r);
  eq(f.trocos.map(t => [t.id, t.dn]), [['A1', 'DN300'], ['B1', 'DN65'], ['H1', 'DN300']]);
  eq(r.pecas[1].a, [1000, 200, -2000]); eq(r.pecas[1].b, [1000, 700, -2000]); eq(f.trocos[1].ends, [{ livre: 'Ponta livre, sem flange' }, 3]);
  eq(f.ligacoes.map(l => [l.n, l.dn]), [[1, 300], [2, 300], [3, 65], [4, 300], [5, 300]]);
});
test('segunda linha mal ligada: ligação que não existe ou já ocupada dá aviso e a linha fica na origem, sem rebentar', () => {
  const a = linha([T(500)], { linhas: [{ comeca: 'lig', lig: 99, itens: [T(400, 'cima')] }] });
  ok(a.avisos.some(x => /linha B/i.test(x) && /ligação/i.test(x)), a.avisos.join(' | ')); eq(F(a).trocos.length, 2); ok(semNaN(a));
  const b = linha([T(500)], { linhas: [{ comeca: 'lig', lig: 1, itens: [T(400, 'cima')] }] }); ok(b.avisos.some(x => /linha B/i.test(x)));
  ok(linha([T(500)], { linhas: [{ itens: [{ tipo: 'foguetao' }] }] }).avisos.some(x => /Linha B, peça 1/.test(x)));
  eq(F(linha([T(500)], { linhas: 'x' })).trocos.length, 1); eq(F(linha([T(500)], { linhas: [null, { itens: [] }] })).trocos.length, 1);
});
test('uma linha que nasce num ramal e começa por uma válvula: a ligação passa a inox–ferro com kit', () => {
  const f = F(linha([T(260), TE, T(260)], { linhas: [{ comeca: 'lig', lig: 2, itens: [{ tipo: 'valvula', comp: 200 }, T(500, 'segue')] }] }));
  const l2 = f.ligacoes.find(l => l.n === 2); eq([l2.tipo, l2.kit, l2.nossas, l2.entre[1]], ['inox-FFD', true, 1, 'Válvula de seccionamento (volante)']);
  eq(f.equipamentos[0].ligs, [2, 4]);
});

// --- flanges furadas ---
test('cada flange leva a furação certa para o 3D: círculo de furação, número e diâmetro dos furos', () => {
  const r = linha([T(950)]), fl = r.pontos.filter(p => p.tipo === 'flange');
  eq(fl.length, 2); eq(fl[0].furos, { K: 400, n: 12, h: 22 }); eq([fl[0].D, fl[0].bore, fl[0].esp], [445, 323.9, 32]);
  eq(linha([T(950)], { pn: 16, dn: 500 }).pontos.find(p => p.tipo === 'flange').furos, { K: 650, n: 20, h: 33 });
});
test('pormenor da flange na ficha: o desenho tem um furo por parafuso e a legenda com as medidas', async () => {
  const { flangeSVG, fichaTroco } = await import('../js/fichas.js');
  const svg = flangeSVG({ D: 445, K: 400, n: 12, h: 22, M: 20 }, 300, 10, 323.9);
  eq(svg.split('class="furo"').length - 1, 12); ok(svg.includes('DN300 PN10') && svg.includes('12 furos Ø22') && svg.includes('K 400') && svg.includes('M20')); ok(!/NaN|undefined/.test(svg));
  const f = fichaTroco(linha([T(500), { tipo: 'reducao', dn2: 200, comp: 150 }, T(300, 'segue')]), 'A1');
  eq(f.flanges.map(x => x.dn), [300, 200]); ok(f.flanges.every(x => x.svg.startsWith('<svg')));
});
