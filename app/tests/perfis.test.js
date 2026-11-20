// Escolha do tipo de material (tubo redondo, quadrado, barra chata, varão maciço…) e da medida, à vista no formulário.
import { test, eq, ok, semNaN } from './t.js';
import { CAMPOS, desenharFormulario } from '../js/formularios.js';
import { PERFIS, perfilProximo, dims } from '../js/catalogo.js';
import { calcGuarda } from '../js/modelos/guarda.js';
import { calcCorrimao } from '../js/modelos/corrimao.js';
import { calcGradeamento } from '../js/modelos/gradeamento.js';
import { calcGuardaMuro } from '../js/modelos/guardamuro.js';

const campo = (tipo, id) => CAMPOS[tipo].find(c => c.id === id);
const QUATRO = ['tr', 'tq', 'barra', 'varao'];   // tubo redondo, tubo quadrado, barra chata, varão maciço
const ids = forma => Object.values(PERFIS).filter(p => p.forma === forma).map(p => p.id);
const de = (r, grupo) => r.pecas.filter(p => p.grupo === grupo);

test('prumos, corrimões e barras escolhem-se à vista e em qualquer dos quatro tipos de material', () => {
  const pares = [['guarda', 'pPrumo'], ['guarda', 'pCorrimao'], ['guarda', 'pVarao'], ['corrimao', 'tubo'], ['corrimao', 'pPrumo'],
    ['gradeamento', 'pPrumo'], ['gradeamento', 'pVarao'], ['grade', 'pBarra'], ['guardamuro', 'pBarra'], ['guardamuro', 'pCorrimao'], ['portao', 'pVarao'], ['escada', 'pGuarda']];
  for (const [tipo, id] of pares) {
    const c = campo(tipo, id); ok(c, `${tipo}.${id}`); ok(!c.av, `${tipo}.${id} está escondido`);
    for (const f of QUATRO) ok(c.formas.includes(f), `${tipo}.${id} não aceita ${f}`);
  }
});
test('há varão maciço nos diâmetros dos tubos redondos (20 a 50) e mais barras chatas', () => {
  for (const d of [8, 10, 12, 14, 16, 20, 25, 30, 40, 50]) ok(PERFIS['varao' + d], 'varao' + d);
  for (const id of ['barra20x5', 'barra30x5', 'barra40x10', 'barra50x10', 'barra60x8']) ok(PERFIS[id], id);
  ok(ids('tq').length >= 10); ok(PERFIS['tr16x1.5']);
});
test('mudar de tipo procura a medida mais parecida: tubo Ø42 passa a varão maciço Ø40', () => {
  eq(perfilProximo('tr42x2', 'varao'), 'varao40'); eq(perfilProximo('varao12', 'vq'), 'vq12');
  eq(PERFIS[perfilProximo('tq40x2', 'tr')].forma, 'tr'); eq(PERFIS[perfilProximo('tq40x2', 'barra')].forma, 'barra');
  eq(perfilProximo('tq40x2', 'tq'), 'tq40x2'); eq(PERFIS[perfilProximo('nao-existe', 'tr')].forma, 'tr');
});
test('o formulário mostra «tipo» e «medida»; trocar o tipo troca a medida e avisa', () => {
  const el = document.createElement('div'), m = { trocos: [{ comp: 2000 }], altura: 1100, enchimento: 'varoes', pPrumo: 'tq40x2', pCorrimao: 'tr42x2', pVarao: 'varao12' };
  let avisos = 0; desenharFormulario(el, 'guarda', m, () => avisos++);
  const tipo = el.querySelector('select[data-forma="pCorrimao"]'), medida = () => el.querySelector('select[data-id="pCorrimao"]');
  ok(tipo, 'falta a escolha do tipo'); eq(tipo.value, 'tr');
  ok([...medida().options].every(o => PERFIS[o.value].forma === 'tr'), 'a medida só lista o tipo escolhido');
  ok(!tipo.closest('details'), 'o tipo não pode estar dentro de «Perfis e regras»');
  tipo.value = 'varao'; tipo.dispatchEvent(new Event('change', { bubbles: true }));
  eq(m.pCorrimao, 'varao40'); eq(avisos, 1);
  eq(el.querySelector('select[data-forma="pCorrimao"]').value, 'varao'); eq(medida().value, 'varao40');
  ok([...medida().options].every(o => PERFIS[o.value].forma === 'varao'));
});
test('guarda calcula com qualquer tipo de material no prumo, no corrimão e nas barras', () => {
  for (const f of ['tr', 'tq', 'tret', 'barra', 'varao', 'vq']) for (const ench of ['varoes', 'barras']) {
    const id = ids(f)[ids(f).length - 1], r = calcGuarda({ trocos: [{ comp: 3000 }, { comp: 1500, viragem: 90 }], altura: 1100, enchimento: ench, pPrumo: id, pCorrimao: id, pVarao: ids(f)[0] });
    ok(r.pecas.length > 4, `${f} ${ench}`); ok(semNaN(r), `${f} ${ench} NaN`);
    eq(de(r, 'prumo')[0].perfil, id); eq(de(r, 'corrimao')[0].perfil, id);
  }
});
test('corrimão em barra chata fica deitado: no alçado vê-se a espessura', () => {
  const g = calcGuarda({ trocos: [{ comp: 2000 }], altura: 1100, pCorrimao: 'barra50x8' }), c = de(g, 'corrimao')[0];
  eq(c.t, 8); eq(c.p, 50); eq(Math.round(de(g, 'prumo')[0].L), 1100 - 8);
  const k = calcCorrimao({ comp: 3000, altura: 900, tubo: 'barra50x8', montagem: 'prumos' }), ck = de(k, 'corrimao')[0];
  eq(ck.t, 8); eq(ck.p, 50); eq(Math.round(de(k, 'prumo')[0].L), 900 - 8);
});
test('corrimão, gradeamento e guarda de muro calculam com os quatro tipos', () => {
  for (const f of QUATRO) { const id = ids(f)[ids(f).length - 1], fino = ids(f)[0];
    for (const mont of ['parede', 'prumos']) { const r = calcCorrimao({ comp: 4000, desnivel: 800, altura: 900, tubo: id, pPrumo: id, montagem: mont }); ok(r.pecas.length > 0 && semNaN(r), `corrimão ${f}`); eq(de(r, 'corrimao')[0].perfil, id); }
    const g = calcGradeamento({ comp: 6000, altura: 1200, pPrumo: id, pVarao: fino }); ok(g.pecas.length > 4 && semNaN(g), `gradeamento ${f}`); eq(de(g, 'prumo')[0].perfil, id);
    const gm = calcGuardaMuro({ comp: 6000, altura: 600, pCorrimao: id, pBarra: fino }); ok(gm.pecas.length > 4 && semNaN(gm), `guarda de muro ${f}`); eq(de(gm, 'varao')[0].perfil, fino);
  }
  ok(dims('varao40').redondo);
});
