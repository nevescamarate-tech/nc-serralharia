import { test, eq, ok, perto, semNaN } from './t.js';
import { calcPortao } from '../js/modelos/portao.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo, pesoKg, superficieM2 } from '../js/custo.js';
import { listaPosicoes, pormenorAlmofada } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { alcadoSVG, plantaSVG } from '../js/desenho2d.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

// Portão P1 do exemplo: correr, vão 2500 × 2700, folha 2650, 3 almofadas de 881.
const p1 = (m = {}) => calcPortao({ largura: 2500, altura: 2750, tipo: 'correr', enchimento: 'almofadas', sobreposicao: 150, folgaChao: 10, pAro: 'tq50x2', pTravessa: 'tq50x2', nAlmofadas: 3, ...m });
const de = (r, g) => r.paineis.filter(p => p.grupo === g);
const qtd = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('3 almofadas numa folha de 2650 com juntas de 4 mm: 881 cada', () => {
  const r = p1(), al = de(r, 'almofada');
  eq(al.length, 3); perto(al[0].vis[0], 880.7, 0.2); eq(al[0].vis[1], 2740);
  eq(r.almofadas.n, 3); eq(r.almofadas.junta, 4); ok(semNaN(r));
});
test('a chapa de cada almofada é a planificada: face mais relevo e aba dos quatro lados', () => {
  const al = de(p1({ relevo: 20 }), 'almofada')[0];
  perto(al.w, al.vis[0] + 2 * (20 + 18), 0.2); perto(al.h, 2740 + 2 * (20 + 18), 0.2); eq(al.esp, 2);
});
test('número automático: nenhuma almofada passa de 1000 mm de largura', () => {
  for (const largura of [900, 1500, 3000, 4100, 6000]) {
    const r = calcPortao({ largura, tipo: 'batente1', enchimento: 'almofadas' }), al = de(r, 'almofada');
    ok(al.length >= 1); ok(al.every(a => a.vis[0] <= 1000.01), `largura ${largura}: almofada de ${al[0].vis[0]}`);
  }
});
test('há um montante por baixo de cada junta e travessas intermédias nas folhas altas', () => {
  const r = p1(), verticais = r.pecas.filter(p => p.grupo === 'travessa' && Math.abs(p.s[0] - p.s[2]) < 1);
  eq(verticais.length, 2);
  const al = de(r, 'almofada');
  perto(verticais[0].s[0], al[0].s[2] + 2, 0.5);
  const horizontais = r.pecas.filter(p => p.grupo === 'travessa' && Math.abs(p.s[1] - p.s[3]) < 1);
  eq(horizontais.length, 2 * 3);
  eq(calcPortao({ largura: 2000, altura: 1000, tipo: 'batente1', enchimento: 'almofadas' }).pecas.filter(p => p.grupo === 'travessa' && Math.abs(p.s[1] - p.s[3]) < 1).length, 0);
});
test('chapa de trás rebitada e isolamento são opcionais', () => {
  const r = p1();
  eq(de(r, 'tardoz').length, 3); eq(de(r, 'tardoz')[0].esp, 1.5); ok(de(r, 'xps').length >= 3); ok(qtd(r, 'rebite') > 80);
  perto(de(r, 'tardoz').reduce((s, p) => s + p.w * p.h, 0) / 1e6, 2.65 * 2.74, 0.02);
  const s = p1({ tardoz: false, isolamento: false });
  eq(de(s, 'tardoz').length, 0); eq(de(s, 'xps').length, 0); eq(qtd(s, 'rebite'), 0);
});
test('peso do aço próximo do exemplo (≈ 282 kg) e o isolamento não conta como metal', () => {
  const r = p1(), kg = pesoKg(r, 'aco');
  ok(kg > 240 && kg < 320, 'peso ' + kg);
  ok(superficieM2(r) > 2 * 2.65 * 2.74, 'superfície a tratar inclui as chapas');
  perto(pesoKg(p1({ isolamento: false }), 'aco'), kg, 0.01);
});
test('portão de batente de 2 folhas também leva almofadas em cada folha', () => {
  const r = calcPortao({ largura: 3000, tipo: 'batente2', enchimento: 'almofadas' });
  eq(de(r, 'almofada').length % 2, 0); ok(de(r, 'almofada').length >= 4);
});
test('custo: chapa, isolamento e rebites com preço de exemplo', () => {
  const t = { tipo: 'portao', medidas: { largura: 2500, altura: 2750, tipo: 'correr', enchimento: 'almofadas' }, material: 'aco', acabamento: 'pintado', margem: 30, horasOficina: null, horasMontagem: 8 };
  const res = calcular(t), c = custo(t, res, planoCorte(res.pecas), JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.paineis > 100); ok(semNaN(c));
  ok(c.linhas.some(l => /quinada/i.test(l.desc))); ok(c.linhas.some(l => /XPS/i.test(l.desc)));
});
test('desenhos: o alçado mostra as larguras das almofadas; tardoz e isolamento não aparecem', () => {
  const r = p1(), svg = alcadoSVG(r);
  ok(svg.includes('>881<')); ok(svg.includes('>2650<'));
  eq((svg.match(/class="pf"/g) || []).length, 3);
  ok(plantaSVG(r).startsWith('<svg'));
});
test('preparação: posições AL, CT e IS, e pormenor da almofada com o relevo', () => {
  const t = { id: 't', tipo: 'portao', nome: 'Portão P1', medidas: { largura: 2500, altura: 2750, tipo: 'correr', enchimento: 'almofadas', nAlmofadas: 3 }, material: 'aco', acabamento: 'pintado' };
  const res = calcular(t), pos = listaPosicoes(res, 'aco').posicoes, refs = pos.map(p => p.ref);
  for (const r of ['AL1', 'CT1', 'IS1']) ok(refs.includes(r), 'falta ' + r + ' em ' + refs.join(' '));
  ok(pos.find(p => p.ref === 'AL1').kg > 30); eq(pos.find(p => p.ref === 'IS1').designacao, 'Isolamento');
  const pm = pormenorAlmofada(res); ok(pm && pm.svg.startsWith('<svg')); ok(pm.svg.includes('>20<'));
  eq(pormenorAlmofada(calcular({ tipo: 'portao', medidas: { largura: 3000 } })), null);
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1', trabalhos: [t] }, t, res, planoCorte(res.pecas), '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['almofada quinada', 'chapa de trás', 'isolamento', 'junta entre almofadas', 'rebite']) ok(tx.includes(p), 'falta «' + p + '»');
});
