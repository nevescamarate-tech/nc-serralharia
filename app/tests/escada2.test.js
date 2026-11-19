import { test, eq, ok, perto, semNaN } from './t.js';
import { calcEscada } from '../js/modelos/escada.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { listaPosicoes, quadroResumo } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

// EM02: desnível 1620 (9 × 180), cobertor 300, largura 1220, patamar, gradil, guardas de barras 50×8 a 100.
const em = (m = {}) => calcEscada({ desnivel: 1620, largura: 1220, cobertor: 300, degrau: 'gradil', patamar: 1220, guarda: 'dois', ...m });
const de = (r, g) => r.pecas.filter(p => p.grupo === g);
const qtd = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('EM02: 9 espelhos de 180, 8 degraus em gradil de 1220 × 300 e avanço de 2400', () => {
  const r = em(), d = r.paineis.filter(p => p.grupo === 'gradil' && !p.plano);
  eq(r.escada.n, 9); perto(r.escada.espelho, 180, 0.001); eq(d.length, 8); eq(d[0].w, 1220); eq(d[0].h, 300);
  perto(r.comprimentoTotal, 2400 + 1220, 0.5); ok(semNaN(r));
});
test('patamar: 2 longarinas, travessas a 800 no máximo, piso e 2 pilares com placa de base', () => {
  const r = em();
  eq(de(r, 'longarina').length, 2); perto(de(r, 'longarina')[0].L, 1220, 0.1);
  ok(de(r, 'travessa').length >= 3); perto(de(r, 'travessa')[0].L, 1220, 0.1);
  eq(r.paineis.filter(p => p.plano).length, 1); eq(de(r, 'pilar').length, 2); eq(qtd(r, 'perno'), 8); eq(qtd(r, 'placa_base'), 6);
  ok(r.avisos.some(a => /patamar/i.test(a)));
  const s = em({ patamar: 0 }); eq(de(s, 'longarina').length, 0); eq(de(s, 'pilar').length, 0); eq(qtd(s, 'placa_base'), 4);
});
test('guardas dos dois lados: barras a 100 entre eixos, altura 1100 acima dos focinhos, travessa de topo inclinada', () => {
  const r = em(), b = de(r, 'varao'), t = de(r, 'corrimao');
  eq(t.length, 4);                                         // lanço + patamar, de cada lado
  const lanco = b.filter(p => p.a[2] < 0 && p.s[0] < 2400), xs = lanco.map(p => p.s[0]);
  eq(lanco.length, 24); perto(xs[1] - xs[0], 100, 0.01);
  perto(lanco[0].L, 1100 + 90, 0.5);                       // do eixo do banzo (meio espelho abaixo do focinho) ao topo
  eq(de(em({ guarda: 'um' }), 'corrimao').length, 2); eq(de(em({ guarda: 'nenhuma' }), 'varao').length, 0);
  ok(r.avisos.some(a => /preensível/i.test(a)));
});
test('custo, posições, resumo e folha da escada completa', () => {
  const t = { id: 't', tipo: 'escada', nome: 'EM02', medidas: { desnivel: 1620, largura: 1220, cobertor: 300, degrau: 'gradil', patamar: 1220, guarda: 'dois' }, material: 'aco', acabamento: 'galvanizado', margem: 30, horasOficina: null, horasMontagem: 16 };
  const res = calcular(t), plano = planoCorte(res.pecas), c = custo(t, res, plano, JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  eq(c.semPreco, []); ok(c.linhas.some(l => /gradil/i.test(l.desc))); ok(semNaN(c));
  const refs = listaPosicoes(res, 'aco').posicoes.map(p => p.ref); for (const x of ['BZ1', 'LG1', 'GR1', 'PL1', 'V1', 'C1']) ok(refs.includes(x), 'falta ' + x + ' em ' + refs.join(' '));
  ok(quadroResumo(t, res).some(l => l[0] === 'Espelhos' && l[1].includes('9')));
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1694', trabalhos: [t] }, t, res, plano, '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['gradil eletrossoldado', 'longarina do patamar', 'quadro resumo', 'degrau tipo']) ok(tx.includes(p), 'falta «' + p + '»');
});

test('patamar em L (EM02): 1220 × 2370, travessas e piso a toda a largura, pilares nas duas margens', () => {
  const r = em({ patamarLargura: 2370, patamarLado: 'esq' });
  ok(r.escada.emL); eq(r.escada.patamarLargura, 2370);
  ok(de(r, 'travessa').every(p => Math.abs(p.L - 2370) < 0.1));
  const piso = r.paineis.find(p => p.plano); eq(piso.w, 1220); eq(piso.h, 2370);
  const zs = de(r, 'pilar').map(p => Math.round(p.a[2])).sort((a, b) => a - b); perto(zs[1] - zs[0], 2370 + 50, 1);
  ok(zs[0] < 0, 'alarga para a esquerda de quem sobe (z negativo)');
  ok(semNaN(r));
});
test('patamar em L: guarda no topo a toda a largura e na frente da parte que sobra; patamar direito fica aberto no topo', () => {
  const r = em({ patamarLargura: 2370, patamarLado: 'esq' }), atr = de(r, 'corrimao').filter(p => Math.abs(p.b[2] - p.a[2]) > 1).map(p => Math.round(p.L)).sort((a, b) => a - b);
  eq(atr, [1150, 2370]);
  eq(de(em(), 'corrimao').filter(p => Math.abs(p.b[2] - p.a[2]) > 1).length, 0);
  const dir = em({ patamarLargura: 2370, patamarLado: 'dir' }); ok(de(dir, 'pilar').some(p => p.a[2] > 2000));
});
test('viga central: uma só viga a meio, um suporte por degrau, e a verificação carrega-a com a largura toda', async () => {
  const { verificar } = await import('../js/verificacao.js');
  const r = em({ estrutura: 'central', patamar: 0, guarda: 'nenhuma' }), bz = de(r, 'banzo');
  eq(bz.length, 1); perto(bz[0].a[2], 610, 0.1); eq(de(r, 'suporte').length, 8); eq(qtd(r, 'placa_base'), 2);
  ok(Math.max(bz[0].a[1], bz[0].b[1]) < 1620, 'a viga fica por baixo dos degraus');
  const t = m => ({ tipo: 'escada', medidas: { desnivel: 1620, largura: 1220, cobertor: 300, ...m }, material: 'aco' });
  const vc = verificar(t({ estrutura: 'central' }), calcEscada(t({ estrutura: 'central' }).medidas)), vb = verificar(t({}), calcEscada(t({}).medidas));
  eq(vc.linhas[0].elemento, 'Viga central'); perto(vc.linhas[0].ratio / vb.linhas[0].ratio, 2, 0.05);
  ok(r.avisos.some(a => /viga central/i.test(a)));
});
