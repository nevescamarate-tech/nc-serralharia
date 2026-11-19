import { test, eq, ok, perto, semNaN } from './t.js';
import { calcEscada } from '../js/modelos/escada.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { listaPosicoes, pormenorDegrau } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { alcadoSVG, plantaSVG } from '../js/desenho2d.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

const e = (m = {}) => calcEscada({ desnivel: 2800, largura: 900, ...m });
const qtd = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('o tipo escada existe e sem desnível pede-o', () => {
  ok(TIPOS.escada); eq(calcEscada({}).pecas.length, 0); ok(calcEscada({}).avisos.some(a => /desnível/i.test(a)));
});
test('desnível 2800 com espelho máximo 180: 16 espelhos de 175 e 15 degraus', () => {
  const r = e();
  eq(r.escada.n, 16); perto(r.escada.espelho, 175, 0.01); eq(r.paineis.length, 15);
  perto(r.comprimentoTotal, 15 * 280, 0.5); ok(semNaN(r));
});
test('os espelhos são todos iguais e nunca passam do máximo', () => {
  for (const d of [500, 1000, 1790, 1810, 2800, 3333, 4500]) {
    const r = e({ desnivel: d });
    ok(r.escada.espelho <= 180.001, `desnível ${d}: espelho ${r.escada.espelho}`);
    perto(r.escada.espelho * r.escada.n, d, 0.01);
  }
});
test('dois banzos com o comprimento inclinado, corte de nível em baixo e a prumo em cima', () => {
  const r = e(), bz = r.pecas.filter(p => p.grupo === 'banzo');
  eq(bz.length, 2);
  const ang = Math.atan(175 / 280) * 180 / Math.PI;
  perto(bz[0].ang[1], ang, 0.2); perto(bz[0].ang[0], 90 - ang, 0.2);
  ok(bz[0].L > Math.hypot(15 * 280, 15 * 175), 'ponta mais comprida ≥ eixo');
  perto(Math.abs(bz[1].a[2] - bz[0].a[2]), 900 + 50, 1);
});
test('cada degrau é uma chapa quinada com a largura útil; a planificada soma as duas abas', () => {
  const d = e().paineis[0];
  eq(d.grupo, 'lacrimada'); eq(d.w, 900); eq(d.h, 280 + 2 * 30); eq(d.vis[0], 900);
});
test('avisa quando o passo não é confortável, quando falta patamar e que a estrutura é para calcular', () => {
  ok(!e().avisos.some(a => /conforto/i.test(a)), '2×175+280 = 630 está bem');
  ok(e({ cobertor: 220 }).avisos.some(a => /conforto/i.test(a)));
  ok(e({ desnivel: 4500 }).avisos.some(a => /patamar/i.test(a)));
  ok(e().avisos.some(a => /dimension/i.test(a)));
});
test('medidas absurdas são recusadas', () => {
  for (const m of [{ desnivel: 90000 }, { desnivel: 100 }, { largura: 9000 }, { largura: 100 }]) { const r = e(m); eq(r.pecas.length, 0); ok(r.avisos.length > 0); }
});
test('chapas de apoio e buchas, custo sem faltas de preço e desenhos com cotas', () => {
  const r = e(); eq(qtd(r, 'placa_base'), 4); eq(qtd(r, 'bucha_quimica'), 8);
  const t = { id: 't', tipo: 'escada', nome: 'Escada', medidas: { desnivel: 2800 }, material: 'aco', acabamento: 'galvanizado', margem: 30, horasOficina: null, horasMontagem: 8 };
  const res = calcular(t), plano = planoCorte(res.pecas), c = custo(t, res, plano, JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.paineis > 50); ok(semNaN(c));
  const svg = alcadoSVG(res); ok(svg.includes('>2800<')); ok(svg.includes('>4200<')); ok(plantaSVG(res).startsWith('<svg'));
  const refs = listaPosicoes(res, 'aco').posicoes.map(p => p.ref); ok(refs.includes('BZ1')); ok(refs.includes('D1'));
  const pm = pormenorDegrau(res); ok(pm.svg.includes('>175<')); ok(pm.svg.includes('>280<'));
  eq(pormenorDegrau(calcular({ tipo: 'guarda', medidas: { trocos: [{ comp: 2000 }] } })), null);
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1', trabalhos: [t] }, t, res, plano, '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['banzo', 'degrau', 'chapa lacrimada', '16 espelhos', 'a calcular']) ok(tx.includes(p), 'falta «' + p + '»');
});
