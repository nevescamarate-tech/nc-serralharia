import { test, eq, ok, perto } from './t.js';
import { lerDXF, trocosDeMedicao, eDWG } from '../js/dxf.js';

// Monta um DXF a partir de pares [código, valor].
const dxf = (...pares) => pares.map(([c, v]) => `  ${c}\n${v}`).join('\n') + '\n  0\nEOF\n';
const SEC = n => [[0, 'SECTION'], [2, n]], FIM = [[0, 'ENDSEC']];
const ents = (...e) => dxf(...SEC('ENTITIES'), ...e, ...FIM);
const linha = (x1, y1, x2, y2, cam = '0') => [[0, 'LINE'], [8, cam], [10, x1], [20, y1], [11, x2], [21, y2]];

test('lê uma linha com a sua camada', () => {
  const d = lerDXF(ents(...linha(0, 0, 3000, 0, 'GUARDAS')));
  eq(d.erro, undefined); eq(d.entidades.length, 1);
  const e = d.entidades[0];
  eq([e.tipo, e.camada, e.x1, e.y1, e.x2, e.y2], ['linha', 'GUARDAS', 0, 0, 3000, 0]);
  ok(d.camadas.some(c => c.nome === 'GUARDAS'));
});
test('lê uma polilinha fechada com 4 vértices', () => {
  const d = lerDXF(ents([0, 'LWPOLYLINE'], [8, 'A'], [90, 4], [70, 1], [10, 0], [20, 0], [10, 10], [20, 0], [10, 10], [20, 5], [10, 0], [20, 5]));
  const e = d.entidades[0];
  eq(e.tipo, 'poli'); eq(e.pts.length, 4); eq(e.fechada, true); eq(e.pts[2], [10, 5]);
});
test('lê POLYLINE antiga com VERTEX', () => {
  const d = lerDXF(ents([0, 'POLYLINE'], [8, 'A'], [70, 0], [0, 'VERTEX'], [10, 1], [20, 2], [0, 'VERTEX'], [10, 3], [20, 4], [0, 'SEQEND']));
  eq(d.entidades[0].pts, [[1, 2], [3, 4]]);
});
test('lê círculo, arco e texto', () => {
  const d = lerDXF(ents([0, 'CIRCLE'], [8, '0'], [10, 5], [20, 5], [40, 2], [0, 'ARC'], [8, '0'], [10, 0], [20, 0], [40, 10], [50, 0], [51, 90],
    [0, 'TEXT'], [8, '0'], [10, 1], [20, 1], [40, 2.5], [1, 'Guarda G1']));
  eq(d.entidades.map(e => e.tipo), ['circulo', 'arco', 'texto']);
  eq(d.entidades[2].t, 'Guarda G1'); eq(d.entidades[1].a2, 90);
});
test('expande blocos inseridos com posição, escala e rotação', () => {
  const txt = dxf(...SEC('BLOCKS'), [0, 'BLOCK'], [2, 'B1'], [10, 0], [20, 0], ...linha(0, 0, 10, 0), [0, 'ENDBLK'], ...FIM,
    ...SEC('ENTITIES'), [0, 'INSERT'], [8, 'X'], [2, 'B1'], [10, 100], [20, 0], [41, 2], [42, 2], [50, 90], ...FIM);
  const e = lerDXF(txt).entidades[0];
  eq(e.tipo, 'linha'); perto(e.x1, 100, 0.001); perto(e.y1, 0, 0.001); perto(e.x2, 100, 0.001); perto(e.y2, 20, 0.001);
});
test('bloco que se insere a si próprio não entra em ciclo', () => {
  const txt = dxf(...SEC('BLOCKS'), [0, 'BLOCK'], [2, 'B1'], [10, 0], [20, 0], [0, 'INSERT'], [2, 'B1'], [10, 1], [20, 0], ...linha(0, 0, 1, 0), [0, 'ENDBLK'], ...FIM,
    ...SEC('ENTITIES'), [0, 'INSERT'], [2, 'B1'], [10, 0], [20, 0], ...FIM);
  ok(lerDXF(txt).entidades.length < 100);
});
test('unidades do desenho: metros dá fator 1000 para mm', () => {
  const txt = dxf(...SEC('HEADER'), [9, '$INSUNITS'], [70, 6], ...FIM, ...SEC('ENTITIES'), ...linha(0, 0, 3, 0), ...FIM);
  eq(lerDXF(txt).fatorMM, 1000);
  eq(lerDXF(ents(...linha(0, 0, 3, 0))).fatorMM, null);
});
test('limites do desenho', () => {
  eq(lerDXF(ents(...linha(-5, 2, 10, 8))).limites, { x0: -5, y0: 2, x1: 10, y1: 8 });
});
test('ignora entidades desconhecidas e do espaço de papel', () => {
  const d = lerDXF(ents([0, 'HATCH'], [8, 'A'], [10, 1], ...linha(0, 0, 1, 1), [67, 1], ...linha(0, 0, 2, 2)));
  eq(d.entidades.length, 1); eq(d.entidades[0].x2, 2);
});
test('texto que não é DXF, vazio ou sem entidades: devolve erro, sem exceção', () => {
  for (const t of ['', 'olá mundo', 'AC1027\u0000\u0001binário', dxf(...SEC('ENTITIES'), ...FIM), null]) ok(lerDXF(t).erro, 'sem erro para: ' + String(t).slice(0, 12));
});
test('reconhece um ficheiro DWG pelos primeiros bytes ou pelo nome', () => {
  ok(eDWG('planta.DWG', new Uint8Array([1, 2, 3])));
  ok(eDWG('sem-extensao', new TextEncoder().encode('AC1032\u0000\u0000')));
  ok(!eDWG('planta.dxf', new TextEncoder().encode('  0\nSECTION')));
});
test('medição no desenho vira troços da guarda (viragem + para a direita)', () => {
  const t = trocosDeMedicao([[0, 0], [2000, 0], [2000, 1500], [3000, 1500]], 1);
  eq(t.length, 3);
  eq([t[0].comp, t[0].viragem], [2000, 0]);
  eq([t[1].comp, t[1].viragem], [1500, -90]);   // no desenho, virar para +Y é virar à esquerda
  eq([t[2].comp, t[2].viragem], [1000, 90]);
});
test('medição em metros é convertida para mm e arredondada', () => {
  eq(trocosDeMedicao([[0, 0], [2.5004, 0]], 1000)[0].comp, 2500);
  eq(trocosDeMedicao([[0, 0]], 1), []);
});
