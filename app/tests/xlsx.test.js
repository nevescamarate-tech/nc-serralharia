import { test, eq, ok, perto } from './t.js';
import { criarXLSX } from '../js/xlsx.js';
import { lerXLSX } from '../js/articulado.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo, capitulos } from '../js/custo.js';
import { livroCusto } from '../js/livro.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

const precos = (extra = {}) => ({ ...JSON.parse(JSON.stringify(PRECOS_EXEMPLO)), ...extra });
function caso(pr = precos(), extra = {}) {
  const trabalho = { tipo: 'guarda', nome: 'Guarda', medidas: { trocos: [{ comp: 3000 }] }, material: 'aco', acabamento: 'pintado', margem: 30, horasOficina: null, horasMontagem: 4, precos: pr, ...extra };
  const res = calcular(trabalho), plano = planoCorte(res.pecas);
  return { trabalho, res, plano, c: custo(trabalho, res, plano, pr) };
}
const ler = b => lerXLSX(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));

test('Excel: o que se escreve lê-se igual (textos, números, acentos e várias folhas)', async () => {
  const bytes = criarXLSX([{ nome: 'Resumo', linhas: [['Capítulo', 'Custo (€)'], ['Materiais & <aço>', 123.45], [{ v: 'Total', b: true }, { v: 1000, b: true }]] }, { nome: 'Posições', linhas: [['P1', 2, null, 'ção']] }]);
  ok(bytes instanceof Uint8Array && bytes.length > 500);
  const r = await ler(bytes);
  ok(!r.erro, r.erro); eq(r.folhas.map(f => f.nome), ['Resumo', 'Posições']);
  eq(r.folhas[0].linhas[1][0], 'Materiais & <aço>'); eq(r.folhas[0].linhas[1][1], 123.45); eq(r.folhas[0].linhas[2][1], 1000);
  eq(r.folhas[1].linhas[0][0], 'P1'); eq(r.folhas[1].linhas[0][3], 'ção');
});
test('Excel: nomes de folha inválidos ou compridos são limpos', async () => {
  const r = await ler(criarXLSX([{ nome: 'a/b:c*?[x] ' + 'z'.repeat(40), linhas: [['x']] }]));
  ok(r.folhas[0].nome.length <= 31); ok(!/[\/:*?\[\]]/.test(r.folhas[0].nome));
});

test('capítulos: somam o custo total e as percentagens somam 100', () => {
  const { c } = caso(), caps = capitulos(c);
  ok(caps.length >= 5); perto(caps.reduce((s, x) => s + x.total, 0), c.total, 0.01);
  perto(caps.reduce((s, x) => s + x.pct, 0), 100, 0.5);
  eq(caps[0].nome, 'Materiais'); ok(caps.every(x => x.linhas.length > 0 && x.total > 0));
  eq(caps.map(x => x.n), caps.map((x, i) => i + 1));
});
test('consumíveis: percentagem sobre os materiais, e zero quando a tabela do trabalho não a tem', () => {
  const com = caso(precos({ consumiveis: 5 })).c;
  perto(com.consumiveis, (com.material + com.paineis) * 0.05, 0.01);
  const pr = precos(); delete pr.consumiveis;
  const sem = caso(pr).c;
  eq(sem.consumiveis, 0); perto(com.total - sem.total, com.consumiveis, 0.01);
  ok(!capitulos(sem).some(x => /consum/i.test(x.nome)));
});
test('livro de custo: folhas Resumo, Custo e Posições, com o total igual ao do ecrã', async () => {
  const { trabalho, res, c } = caso();
  const livro = livroCusto({ nome: 'Moradia', numero: '2026/001', cliente: 'C' }, trabalho, res, c);
  eq(livro.map(f => f.nome), ['Resumo', 'Custo', 'Posições']);
  const r = await ler(criarXLSX(livro));
  const linha = r.folhas[0].linhas.find(l => /total custo direto/i.test(String(l[0])));
  ok(linha, 'falta o total'); perto(linha[1], c.total, 0.01);
  const venda = r.folhas[0].linhas.find(l => /venda sem iva/i.test(String(l[0]))); perto(venda[1], c.venda, 0.01);
  ok(r.folhas[2].linhas.some(l => l[0] === 'P1'));
});
