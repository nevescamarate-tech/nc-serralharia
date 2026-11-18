import { test, eq, ok, perto, semNaN } from './t.js';
import { calcGuarda } from '../js/modelos/guarda.js';

const grupo = (r, g) => r.pecas.filter(p => p.grupo === g);

test('troço de 3000: 4 prumos, 1 corrimão de 3000, 6 travessas', () => {
  const r = calcGuarda({ trocos: [{ comp: 3000 }] });
  eq(grupo(r, 'prumo').length, 4);
  eq(grupo(r, 'corrimao').length, 1);
  perto(grupo(r, 'corrimao')[0].L, 3000);
  eq(grupo(r, 'travessa').length, 6);
  eq(r.avisos, []);
});
test('vão livre entre varões nunca passa de 110', () => {
  const r = calcGuarda({ trocos: [{ comp: 3000 }] });
  ok(r.vaos.length === 3);
  for (const v of r.vaos) ok(v.folga <= 110 && v.folga > 0, 'folga ' + v.folga);
  eq(grupo(r, 'varao').length, r.vaos.reduce((s, v) => s + v.n, 0));
});
test('prumo mede a altura menos o corrimão', () => {
  const r = calcGuarda({ trocos: [{ comp: 3000 }], altura: 1100 });
  perto(grupo(r, 'prumo')[0].L, 1100 - 42.4);
});
test('troço inclinado: corrimão pela hipotenusa', () => {
  const r = calcGuarda({ trocos: [{ comp: 3000, desnivel: 1750 }] });
  perto(grupo(r, 'corrimao')[0].L, 3473, 1);
});
test('dois troços a 90°: prumo partilhado no canto e meia-esquadria', () => {
  const r = calcGuarda({ trocos: [{ comp: 2000 }, { comp: 2000, viragem: 90 }] });
  eq(grupo(r, 'prumo').length, 5);
  const c = grupo(r, 'corrimao');
  eq(c.length, 2);
  eq(c[0].ang, [0, 45]);
  eq(c[1].ang, [45, 0]);
});
test('enchimento em vidro: um painel por vão e 4 pinças cada', () => {
  const r = calcGuarda({ trocos: [{ comp: 3000 }], enchimento: 'vidro' });
  eq(r.paineis.length, 3);
  eq(r.acessorios.find(a => a.ref === 'pinca_vidro').qtd, 12);
  eq(grupo(r, 'varao').length, 0);
});
test('fixação ao topo: sapata e 4 buchas por prumo', () => {
  const r = calcGuarda({ trocos: [{ comp: 3000 }] });
  eq(r.acessorios.find(a => a.ref === 'sapata').qtd, 4);
  eq(r.acessorios.find(a => a.ref === 'bucha').qtd, 16);
});
test('sem medidas: aviso, sem peças e sem NaN', () => {
  const r = calcGuarda({});
  ok(r.avisos.length > 0); eq(r.pecas, []); ok(semNaN(r));
});
test('comprimento negativo ou texto: aviso e sem NaN', () => {
  for (const comp of [-5, 'abc', 0, null]) {
    const r = calcGuarda({ trocos: [{ comp }] });
    ok(r.avisos.length > 0); ok(semNaN(r));
  }
});
test('troço de 50: aviso e nenhuma peça de comprimento negativo', () => {
  const r = calcGuarda({ trocos: [{ comp: 50 }] });
  ok(r.avisos.length > 0);
  ok(r.pecas.every(p => p.L > 0));
});

// --- revisão final ---
test('canto a 90°: corrimão medido pela ponta mais comprida (mais meia secção por meia-esquadria)', () => {
  const c = grupo(calcGuarda({ trocos: [{ comp: 2000 }, { comp: 2000, viragem: 90 }] }), 'corrimao');
  perto(c[0].L, 2000 + 21.2, 0.2); perto(c[1].L, 2000 + 21.2, 0.2);
});
test('patamar seguido de escada em linha: meia-esquadria vertical na transição', () => {
  const c = grupo(calcGuarda({ trocos: [{ comp: 2000 }, { comp: 3000, desnivel: 1750 }] }), 'corrimao');
  perto(c[0].ang[1], 15.1, 0.2); perto(c[1].ang[0], 15.1, 0.2);
  ok(c[0].L > 2000);
});
test('valores absurdos não geram milhões de peças', () => {
  for (const m of [{ trocos: [{ comp: 1e9 }] }, { trocos: [{ comp: 3000 }], maxPrumos: 0.001 },
    { trocos: [{ comp: 3000 }], vaoMax: 0.001 }, { trocos: [{ comp: 3000 }], enchimento: 'barras', nBarras: 1e6 }]) {
    const r = calcGuarda(m); ok(r.pecas.length < 3000, 'peças: ' + r.pecas.length); ok(semNaN(r));
  }
  ok(calcGuarda({ trocos: [{ comp: 1e9 }] }).avisos.length > 0);
});
