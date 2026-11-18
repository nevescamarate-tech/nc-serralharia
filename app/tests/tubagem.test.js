import { test, eq, ok, perto, semNaN } from './t.js';
import { calcTubagem, DIAMETROS } from '../js/modelos/tubagem.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo } from '../js/custo.js';
import { kgm, PRECOS_EXEMPLO } from '../js/catalogo.js';
import { alcadoSVG } from '../js/desenho2d.js';
import { classificar, medidasDeLinha } from '../js/articulado.js';

const tubos = r => r.pecas.filter(p => p.grupo === 'tubo');
const ac = (r, ref) => (r.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;
const T = (comp, dir = 'dir', tes = 0) => ({ comp, dir, tes });

test('tabela de diâmetros de DN15 a DN300 com diâmetro exterior', () => {
  eq(DIAMETROS[50].de, 60.3); eq(DIAMETROS[100].de, 114.3); ok(DIAMETROS[15] && DIAMETROS[300]);
});
test('peso do tubo DN50 de 2 mm em inox', () => perto(kgm('tu50x2', 'inox304'), 2.89, 0.03));
test('troço reto de 3000: um tubo de 3000, sem curvas nem soldaduras, 3 abraçadeiras', () => {
  const r = calcTubagem({ dn: 50, trocos: [T(3000)] });
  eq(tubos(r).length, 1); perto(tubos(r)[0].L, 3000); eq(ac(r, 'curva_inox'), 0); eq(r.ligacoes, 0); eq(ac(r, 'abracadeira_inox'), 3);
  eq(r.avisos, []);
});
test('dois troços em esquadria: 1 curva, tubos descontados do raio da curva, 2 soldaduras', () => {
  const r = calcTubagem({ dn: 50, trocos: [T(2000, 'dir'), T(1500, 'cima')] });
  eq(ac(r, 'curva_inox'), 1); eq(r.ligacoes, 2);
  eq(tubos(r).map(p => p.L), [1925, 1425]);   // raio longo = 1,5 × DN = 75
});
test('subir desenha para cima; para a frente afasta-se de quem olha', () => {
  const r = calcTubagem({ dn: 50, trocos: [T(1000, 'cima'), T(1000, 'frente')] });
  ok(tubos(r)[0].b[1] > tubos(r)[0].a[1]); ok(tubos(r)[1].b[2] < tubos(r)[1].a[2]);
});
test('flange no início e tampão no fim: 1 de cada e mais 2 soldaduras', () => {
  const r = calcTubagem({ dn: 50, trocos: [T(3000)], ini: 'flange', fim: 'tampao' });
  eq(ac(r, 'flange_inox'), 1); eq(ac(r, 'tampao_inox'), 1); eq(r.ligacoes, 2);
});
test('tês num troço: contam como acessório e 2 soldaduras cada', () => {
  const r = calcTubagem({ dn: 50, trocos: [T(3000, 'dir', 2)] });
  eq(ac(r, 'te_inox'), 2); eq(r.ligacoes, 4);
});
test('dois troços seguidos na mesma direção: sem curva, 1 soldadura de união', () => {
  const r = calcTubagem({ dn: 50, trocos: [T(2000, 'dir'), T(1000, 'dir')] });
  eq(ac(r, 'curva_inox'), 0); eq(r.ligacoes, 1); eq(tubos(r).map(p => p.L), [2000, 1000]);
});
test('voltar para trás sobre o mesmo eixo: aviso', () => {
  ok(calcTubagem({ dn: 50, trocos: [T(2000, 'dir'), T(1000, 'esq')] }).avisos.length > 0);
});
test('troço mais curto do que as curvas: aviso e nenhuma peça negativa', () => {
  const r = calcTubagem({ dn: 100, trocos: [T(1000, 'dir'), T(200, 'cima'), T(1000, 'esq')] });
  ok(r.avisos.length > 0); ok(r.pecas.every(p => p.L > 0)); ok(semNaN(r));
});
test('tubo com mais de 6 m: aviso de emenda e mais uma soldadura', () => {
  const r = calcTubagem({ dn: 50, trocos: [T(8000)] });
  eq(r.ligacoes, 1); ok(planoCorte(r.pecas).avisos.some(a => /emenda/i.test(a)));
});
test('acessórios levam o diâmetro e o fator de preço (DN/50)', () => {
  const a = calcTubagem({ dn: 100, trocos: [T(2000, 'dir'), T(1500, 'cima')] }).acessorios.find(x => x.ref === 'curva_inox');
  eq(a.fator, 2); eq(a.sufixo, 'DN100');
});
test('custo: o preço da curva escala com o diâmetro', () => {
  const trabalho = { tipo: 'tubagem', medidas: { dn: 100, trocos: [T(2000, 'dir'), T(1500, 'cima')] }, material: 'inox304', acabamento: 'nenhum', margem: 30, horasOficina: null, horasMontagem: 0 };
  const res = calcular(trabalho), c = custo(trabalho, res, planoCorte(res.pecas), JSON.parse(JSON.stringify(PRECOS_EXEMPLO)));
  const l = c.linhas.find(x => /curva/i.test(x.desc));
  perto(l.pu, PRECOS_EXEMPLO.acessorios.curva_inox * 2, 0.001); ok(/DN100/.test(l.desc)); ok(semNaN(c)); eq(c.semPreco, []);
  ok(c.oficinaH > 0);
});
test('sem medidas, negativas ou absurdas: aviso, sem NaN, poucas peças', () => {
  for (const m of [{}, { trocos: [] }, { trocos: [T(-5)] }, { trocos: [T('abc')] }, { trocos: [T(1e9)] }, { dn: 50, trocos: [T(3000)], maxSuportes: 0.001 }]) {
    const r = calcTubagem(m); ok(semNaN(r)); ok(r.pecas.length < 500);
  }
  ok(calcTubagem({}).avisos.length > 0); ok(calcTubagem({ trocos: [T(1e9)] }).avisos.length > 0);
});
test('diâmetro ou espessura desconhecidos usam DN50 × 2', () => {
  eq(calcTubagem({ dn: 'x', esp: 'y', trocos: [T(1000)] }).pecas[0].perfil, 'tu50x2');
});
test('isométrico tem a cota de cada troço', () => {
  const svg = alcadoSVG(calcTubagem({ dn: 50, trocos: [T(2000, 'dir'), T(1500, 'cima')] }));
  ok(svg.includes('>2000<')); ok(svg.includes('>1500<')); ok(!svg.includes('NaN'));
});
test('articulado: tubagem é reconhecida e a linha em metros dá o comprimento', () => {
  eq(classificar('Tubagem em aço inox AISI 316 DN50'), 'tubagem');
  eq(classificar('Condutas em inox para extração'), 'tubagem');
  eq(medidasDeLinha({ un: 'm', qtd: 24 }, 'tubagem').trocos[0].comp, 24000);
});
