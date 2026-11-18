import { test, eq, ok, perto, semNaN } from './t.js';
import { calcCorrimao } from '../js/modelos/corrimao.js';

const ac = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('corrimão de parede de 3000: tubo de 3000 e 4 suportes', () => {
  const r = calcCorrimao({ comp: 3000 });
  eq(r.pecas.length, 1); perto(r.pecas[0].L, 3000);
  eq(ac(r, 'suporte_parede'), 4);
  eq(ac(r, 'tampa'), 2);
});
test('extremidades em curva: tubo com mais 80 por ponta e 2 curvas', () => {
  const r = calcCorrimao({ comp: 3000, extremidade: 'curva' });
  perto(r.pecas[0].L, 3160);
  eq(ac(r, 'curva90'), 2); eq(ac(r, 'tampa'), 0);
});
test('inclinado: tubo pela hipotenusa', () => {
  perto(calcCorrimao({ comp: 3000, desnivel: 1750 }).pecas[0].L, 3473, 1);
});
test('sobre prumos: prumos em vez de suportes', () => {
  const r = calcCorrimao({ comp: 3000, montagem: 'prumos' });
  eq(r.pecas.filter(p => p.grupo === 'prumo').length, 4);
  eq(ac(r, 'suporte_parede'), 0); eq(ac(r, 'sapata'), 4);
});
test('sem medidas ou negativas: aviso e sem NaN', () => {
  for (const m of [{}, { comp: -1 }, { comp: 'x' }]) {
    const r = calcCorrimao(m); ok(r.avisos.length > 0); ok(semNaN(r)); eq(r.pecas, []);
  }
});

// --- revisão final ---
test('valores absurdos: aviso ou número de suportes limitado', () => {
  ok(calcCorrimao({ comp: 1e9 }).avisos.length > 0);
  ok(calcCorrimao({ comp: 3000, maxSuportes: 0.001 }).acessorios.find(a => a.ref === 'suporte_parede').qtd < 100);
});
test('sobre prumos: a altura é ao topo do tubo, como na guarda', () => {
  const r = calcCorrimao({ comp: 3000, altura: 900, montagem: 'prumos' });
  perto(r.pecas.find(p => p.grupo === 'prumo').L, 900 - 42.4);
});
