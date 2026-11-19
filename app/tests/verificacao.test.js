import { test, eq, ok, perto, semNaN } from './t.js';
import { seccao, verificar } from '../js/verificacao.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { folhaPreparacao } from '../js/folhas.js';
import { PERFIS } from '../js/catalogo.js';

const tr = (tipo, medidas, extra = {}) => ({ id: 't', tipo, nome: 'T', medidas, material: 'aco', acabamento: 'pintado', ...extra });
const ver = t => verificar(t, calcular(t));

test('propriedades de secção conferem com valores de tabela', () => {
  const q = seccao('tq40x2', 40, 40);                       // SHS 40×40×2: I ≈ 7,34 cm⁴, Wel ≈ 3,67 cm³
  perto(q.I, 73365, 5); perto(q.Wel, 3668, 2); perto(q.Wpl, 4336, 1); ok(q.plastica);
  const c = seccao('tr20x1.5', 20, 20);                     // CHS 20×1,5
  perto(c.I, 3754, 3); perto(c.Wpl, 514.5, 0.2);
  const b = seccao('barra50x8', 50, 8); perto(b.Wpl, 8 * 2500 / 4, 0.1); perto(seccao('barra50x8', 8, 50).Wpl, 50 * 64 / 4, 0.1);
  const r = seccao('tret100x50x3', 100, 50); ok(r.I > seccao('tret100x50x3', 50, 100).I * 2, 'ao alto é mais rígido');
  eq(seccao('xpto', 1, 1), null);
});
test('guarda da Pedra Algarvia: barra Ø20×1,5 a 110, 600 de altura, 1,0 kN/m → 0,82 (como no desenho)', () => {
  const v = ver(tr('guardamuro', { comp: 2970, altura: 600 }, { verif: { guarda: 1 } }));
  eq(v.linhas.length, 1); perto(v.linhas[0].ratio, 0.82, 0.011); ok(v.linhas[0].ok); ok(v.ok);
  const forte = ver(tr('guardamuro', { comp: 2970, altura: 600 }, { verif: { guarda: 3 } }));
  ok(!forte.ok); perto(forte.linhas[0].ratio, 2.46, 0.03); ok(forte.linhas[0].sugestao.length > 3);
});
test('guarda corrente: prumo 40×40×2 a 1 m passa com 0,5 kN/m e chumba com 1,0 kN/m, sugerindo um perfil maior', () => {
  const m = { trocos: [{ comp: 3000 }] };
  const leve = ver(tr('guarda', m, { verif: { guarda: 0.5 } })), l = leve.linhas[0];
  perto(l.ratio, 1.5 * 0.5 * 986.7 * 1100 / (4336 * 235), 0.02); ok(l.ok);
  const publica = ver(tr('guarda', m, { verif: { guarda: 1 } })).linhas[0];
  ok(!publica.ok); ok(publica.ratio > 1.5); ok(/quadrado/i.test(publica.sugestao));
  const maior = Object.values(PERFIS).find(p => p.nome === publica.sugestao);
  ok(ver(tr('guarda', { ...m, pPrumo: maior.id }, { verif: { guarda: 1 } })).linhas[0].ok, 'o perfil sugerido tem de passar');
});
test('o prumo retangular é verificado pelo lado que resiste à carga (o menor, tal como fica montado)', () => {
  const v = ver(tr('guarda', { trocos: [{ comp: 2000 }], pPrumo: 'tret60x40x2' }, { verif: { guarda: 0.5 } })).linhas[0];
  const s = seccao('tret60x40x2', 40, 60); perto(v.ratio, 1.5 * 0.5 * (2000 - 60) / 2 * 1100 / (s.Wpl * 235), 0.02);
});
test('telheiro: madre, viga e pilar; mais carga dá mais aproveitamento; viga fraca chumba pela flecha ou pela resistência', () => {
  const m = { comp: 7200, largura: 4200, altura: 3000, vaoMax: 3600 };
  const a = ver(tr('telheiro', m, { verif: { cobertura: 0.5 } })), b = ver(tr('telheiro', m, { verif: { cobertura: 2 } }));
  eq(a.linhas.map(l => l.elemento), ['Madre', 'Viga', 'Pilar']);
  for (let i = 0; i < 3; i++) ok(b.linhas[i].ratio > a.linhas[i].ratio);
  ok(a.linhas[2].esbelteza > 0); ok(semNaN(a)); ok(semNaN(b));
  const viga = b.linhas[1]; ok(!viga.ok); ok(viga.sugestao.length > 3);
  ok(a.notas.some(n => /vento/i.test(n)));
});
test('escada: banzo como viga; com guarda verifica também a barra', () => {
  const s = ver(tr('escada', { desnivel: 2800 }));
  eq(s.linhas.length, 1); eq(s.linhas[0].elemento, 'Banzo'); ok(s.linhas[0].ratio > 0);
  const g = ver(tr('escada', { desnivel: 1620, largura: 1220, cobertor: 300, guarda: 'dois' }));
  eq(g.linhas.map(l => l.elemento), ['Banzo', 'Barra da guarda']); ok(g.linhas[1].ratio < 1, 'barra 50×8 a 100 aguenta 1,0 kN/m');
});
test('inox e alumínio usam a sua tensão; tipos sem verificação e trabalhos vazios devolvem null', () => {
  const aco = ver(tr('guardamuro', { comp: 2970 })).linhas[0].ratio, inox = ver(tr('guardamuro', { comp: 2970 }, { material: 'inox304' })).linhas[0].ratio;
  ok(inox > aco);
  for (const t of ['portao', 'corrimao', 'grade', 'tubagem']) eq(ver(tr(t, { largura: 3000, comp: 3000, altura: 1000, trocos: [{ comp: 2000, dir: 'dir' }] })), null);
  eq(ver(tr('guarda', { trocos: [{ comp: '' }] })), null); eq(verificar({ tipo: 'guarda' }, null), null);
});
test('nenhuma combinação dos tipos verificados dá NaN', () => {
  for (const tipo of Object.keys(TIPOS)) for (const material of ['aco', 'inox316', 'aluminio']) {
    const v = ver(tr(tipo, { comp: 5000, largura: 3000, altura: 1200, desnivel: 2000, trocos: [{ comp: 4000 }] }, { material, verif: { guarda: 'x', cobertura: -1 } }));
    ok(v === null || (semNaN(v) && v.linhas.every(l => l.ratio >= 0)), tipo + ' ' + material);
  }
});
test('a folha de preparação mostra a verificação com o aviso de que é indicativa', () => {
  const t = tr('guardamuro', { comp: 2970, altura: 600 }, { verif: { guarda: 1 } }), res = calcular(t);
  const tx = folhaPreparacao({ id: 'o', nome: 'Obra', numero: '1', trabalhos: [t] }, t, res, planoCorte(res.pecas), '', {}).replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['verificação simples', '0,82', '1 kn/m', 'pré-dimensionamento indicativo']) ok(tx.includes(p), 'falta «' + p + '»');
});
