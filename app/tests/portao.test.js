import { test, eq, ok, perto, semNaN } from './t.js';
import { calcPortao } from '../js/modelos/portao.js';

const grupo = (r, g) => r.pecas.filter(p => p.grupo === g);
const ac = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;

test('batente de 2 folhas 3000x1800: folhas de 1477,5 e aro a 45°', () => {
  const r = calcPortao({ largura: 3000, altura: 1800, tipo: 'batente2' });
  const aro = grupo(r, 'aro');
  eq(aro.length, 8);
  ok(aro.every(p => p.ang[0] === 45 && p.ang[1] === 45));
  eq(aro.filter(p => Math.abs(p.L - 1477.5) < 1).length, 4);
  eq(aro.filter(p => Math.abs(p.L - 1750) < 1).length, 4);
  eq(ac(r, 'dobradica'), 4); eq(ac(r, 'fechadura'), 1);
});
test('batente de 1 folha: largura do vão menos as duas folgas', () => {
  const r = calcPortao({ largura: 1000, altura: 1800, tipo: 'batente1' });
  eq(grupo(r, 'aro').filter(p => Math.abs(p.L - 970) < 1).length, 2);
  eq(ac(r, 'dobradica'), 2);
});
test('folha com mais de 2000 de altura leva 3 dobradiças', () => {
  eq(ac(calcPortao({ largura: 1000, altura: 2200, tipo: 'batente1' }), 'dobradica'), 3);
});
test('de correr 4000: folha de 4200, carril de 8,2 m, 2 rodas', () => {
  const r = calcPortao({ largura: 4000, altura: 1800, tipo: 'correr' });
  eq(grupo(r, 'aro').filter(p => Math.abs(p.L - 4200) < 1).length, 2);
  perto(ac(r, 'carril'), 8.2, 0.01); eq(ac(r, 'roda'), 2); eq(ac(r, 'dobradica'), 0);
  eq(ac(r, 'cremalheira'), 0);
});
test('de correr com motor: cremalheira com o comprimento da folha', () => {
  const r = calcPortao({ largura: 4000, tipo: 'correr', motor: true });
  perto(ac(r, 'cremalheira'), 4.2, 0.01); eq(ac(r, 'motor_prep'), 1);
});
test('enchimento de varões respeita o vão livre máximo', () => {
  const r = calcPortao({ largura: 1000, altura: 1800, tipo: 'batente1' });
  ok(grupo(r, 'varao').length > 0);
  ok(r.vaos.every(v => v.folga <= 110 && v.folga > 0));
});
test('enchimento em chapa: um painel por folha, sem varões', () => {
  const r = calcPortao({ largura: 3000, tipo: 'batente2', enchimento: 'chapa' });
  eq(r.paineis.length, 2); eq(grupo(r, 'varao').length, 0);
});
test('pilares novos: 2 pilares com 600 para chumbar', () => {
  const r = calcPortao({ largura: 3000, altura: 1800, tipo: 'batente2', pilares: true });
  const p = grupo(r, 'pilar'); eq(p.length, 2); perto(p[0].L, 2400);
});
test('sem medidas: aviso, sem peças, sem NaN', () => {
  for (const m of [{}, { largura: -3 }, { largura: 'x' }]) {
    const r = calcPortao(m); ok(r.avisos.length > 0); eq(r.pecas, []); ok(semNaN(r));
  }
});
test('vão de 60: aviso e nenhuma peça negativa', () => {
  const r = calcPortao({ largura: 60, tipo: 'batente1' });
  ok(r.avisos.length > 0); ok(r.pecas.every(p => p.L > 0)); ok(semNaN(r));
});

// --- revisão final ---
test('carril cobre o curso todo da folha: 2 × vão + sobreposição', () => {
  perto(ac(calcPortao({ largura: 4000, tipo: 'correr' }), 'carril'), 8.2, 0.01);
});
test('valores absurdos: aviso ou número de peças limitado', () => {
  ok(calcPortao({ largura: 1e9 }).avisos.length > 0);
  ok(calcPortao({ largura: 1, tipo: 'correr' }).avisos.length > 0);
  ok(calcPortao({ largura: 3000, vaoMax: 0.001 }).pecas.length < 3000);
});
