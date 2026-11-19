import { test, eq, ok, perto, semNaN } from './t.js';
import { calcAbrigo } from '../js/modelos/abrigo.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo, pesoKg } from '../js/custo.js';
import { listaPosicoes, pormenorPe } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { alcadoSVG, plantaSVG } from '../js/desenho2d.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

// Abrigo AG do exemplo: 2400 × 2000, frente 2430, pendente 5 %, porta 900 × 2000, base a 150 do chão.
const a = (m = {}) => calcAbrigo({ comp: 2400, largura: 2000, altura: 2430, pendente: 5, pes: 150, ...m });
const de = (r, g) => r.pecas.filter(p => p.grupo === g);
const pn = (r, g) => r.paineis.filter(p => p.grupo === g);
const qtd = (r, ref) => (r.acessorios.find(x => x.ref === ref) || { qtd: 0 }).qtd;

test('o tipo abrigo existe e com medidas por omissão já dá peças', () => {
  ok(TIPOS.abrigo); const r = calcAbrigo({}); ok(r.pecas.length > 15); ok(semNaN(r));
});
test('4 pilares: os da frente com a altura pedida, os de trás mais baixos pela pendente', () => {
  const p = de(a(), 'pilar'); eq(p.length, 4);
  const frente = p.filter(x => x.a[2] < 1000), tras = p.filter(x => x.a[2] > 1000);
  eq(frente.length, 2); perto(frente[0].L, 2430, 3); perto(frente[0].L - tras[0].L, (2000 - 80) * 0.05, 1);
});
test('quadro de base entre pilares, com longarinas intermédias para o piso', () => {
  const r = a(), b = de(r, 'base');
  const aoComprido = b.filter(p => Math.abs(p.b[0] - p.a[0]) > 1), aoLargo = b.filter(p => Math.abs(p.b[2] - p.a[2]) > 1);
  eq(aoLargo.length, 2); perto(aoLargo[0].L, 2000 - 160, 0.5);
  ok(aoComprido.length >= 4); ok(aoComprido.some(p => Math.abs(p.L - 2240) < 0.5));
  ok(b.every(p => Math.abs(p.a[1] - 200) < 0.5), 'base a 150 do chão + meia secção de 100');
});
test('porta: ombreira, padieira, folha com aro e chapa, dobradiças e fechadura', () => {
  const r = a({ porta: true, portaL: 900, portaH: 2000 });
  eq(de(r, 'ombreira').length, 1); eq(de(r, 'padieira').length, 1); perto(de(r, 'padieira')[0].L, 900, 0.5);
  ok(de(r, 'aro').length >= 4); eq(pn(r, 'chapa').length, 1); eq(qtd(r, 'dobradica'), 3); eq(qtd(r, 'fechadura'), 1);
  const s = a({ porta: false });
  eq(de(s, 'ombreira').length, 0); eq(pn(s, 'chapa').length, 0); eq(qtd(s, 'fechadura'), 0);
});
test('porta que não cabe é recusada com aviso, sem estragar o resto', () => {
  const r = a({ portaL: 5000 }); ok(r.avisos.some(x => /porta/i.test(x))); eq(de(r, 'ombreira').length, 0); ok(de(r, 'pilar').length === 4);
});
test('piso em chapa lacrimada cobre a planta; paredes e cobertura são opcionais', () => {
  const r = a();
  perto(pn(r, 'piso').reduce((s, p) => s + p.w * p.h, 0) / 1e6, 2.4 * 2.0, 0.01); ok(pn(r, 'piso').every(p => p.h <= 1250));
  ok(pn(r, 'parede').length >= 4); ok(pn(r, 'sandwich').length >= 2);
  const m2p = pn(r, 'parede').reduce((s, p) => s + p.w * p.h, 0) / 1e6; ok(m2p > 15 && m2p < 22, 'paredes ' + m2p);
  const s = a({ piso: false, revestimento: 'nenhum', cobertura: 'nenhuma' }); eq(s.paineis.filter(p => p.grupo !== 'chapa').length, 0);
});
test('peso do aço da estrutura perto do exemplo (≈ 480 kg com piso e porta)', () => {
  const kg = pesoKg(a(), 'aco'); ok(kg > 380 && kg < 560, 'peso ' + kg);
});
test('medidas absurdas são recusadas e avisa que é para dimensionar', () => {
  for (const m of [{ comp: 90000 }, { largura: 50000 }, { altura: 20000 }, { comp: 200 }]) { const r = a(m); eq(r.pecas.length, 0); ok(r.avisos.length > 0); }
  ok(a().avisos.some(x => /dimension/i.test(x)));
});
test('vistas, custo e folha de preparação', () => {
  const r = a();
  ok(r.pecas.every(p => p.s.length === 4 && p.sl.length === 4)); ok(alcadoSVG(r).includes('>2400<')); ok(plantaSVG(r).startsWith('<svg'));
  ok(r.cotasLateral.some(c => c.texto === '2000')); ok(pormenorPe(r));
  const t = { id: 't', tipo: 'abrigo', nome: 'Abrigo', medidas: { comp: 2400, largura: 2000, altura: 2430 }, material: 'aco', acabamento: 'pintado', margem: 30, horasOficina: null, horasMontagem: 4 };
  const res = calcular(t), plano = planoCorte(res.pecas), c = custo(t, res, plano, JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.total > 800); ok(semNaN(c));
  const refs = listaPosicoes(res, 'aco').posicoes.map(p => p.ref); for (const x of ['PL1', 'B1', 'T1', 'F1', 'W1']) ok(refs.includes(x), 'falta ' + x + ' em ' + refs.join(' '));
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1', trabalhos: [t] }, t, res, plano, '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['alçado frontal', 'alçado lateral', 'piso em chapa lacrimada', 'revestimento de parede', 'a calcular']) ok(tx.includes(p), 'falta «' + p + '»');
});
