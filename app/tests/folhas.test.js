import { test, ok } from './t.js';
import { folhaProposta, folhaPreparacao } from '../js/folhas.js';
import { calcular } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

const obra = { id: 'o', cliente: 'João <b>Silva</b>', nome: 'Moradia', morada: 'Rua A', numero: '2026/001', data: '2026-11-18', validade: 30, condicoes: '50% na adjudicação' };
const trabalho = { id: 't', tipo: 'guarda', nome: 'Guarda da varanda', medidas: { trocos: [{ comp: 3000 }] }, material: 'aco', acabamento: 'pintado', corNome: 'RAL 7016', cor: '#383e42' };
const linhas = [{ nome: 'Guarda da varanda', descricao: 'Guarda em aço, 3,00 m', acabamento: 'Pintado RAL 7016', venda: 1000 }];
const texto = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').toLowerCase();

test('proposta mostra preço sem IVA, IVA e total', () => {
  const t = texto(folhaProposta(obra, linhas, {}, PRECOS_EXEMPLO));
  ok(t.includes('1 000,00')); ok(t.includes('230,00')); ok(t.includes('1 230,00'));
});
test('proposta nunca mostra custos internos, margem nem horas', () => {
  const t = texto(folhaProposta(obra, linhas, {}, PRECOS_EXEMPLO));
  for (const p of ['margem', 'custo', 'hora']) ok(!t.includes(p), 'contém «' + p + '»');
});
test('proposta escapa o texto introduzido pelo utilizador', () => {
  ok(!folhaProposta(obra, linhas, {}, PRECOS_EXEMPLO).includes('<b>Silva</b>'));
});
test('folha de preparação tem lista de corte e não tem preços', () => {
  const res = calcular(trabalho); const plano = planoCorte(res.pecas);
  const t = texto(folhaPreparacao(obra, trabalho, res, plano, '', {}));
  ok(t.includes('lista de corte')); ok(t.includes('guarda da varanda')); ok(!t.includes('€'));
});

// --- revisão final ---
test('proposta usa o IVA de cada trabalho, não a tabela atual', () => {
  const l = [{ nome: 'A', descricao: '', acabamento: '', venda: 1000, iva: 60 }];
  const t = texto(folhaProposta(obra, l, {}, PRECOS_EXEMPLO));
  ok(t.includes('1 060,00'), 'total com IVA de 6%'); ok(t.includes('iva 6%'));
});

test('pontos a confirmar do trabalho saem na folha, um por linha, escapados; a folha tem corte A-A', () => {
  const t = { ...trabalho, confirmar: 'Tipo de suporte para as buchas\n\n  Altura <b>final</b> do pavimento ' };
  const res = calcular(t), html = folhaPreparacao(obra, t, res, planoCorte(res.pecas), '', {}), tx = texto(html);
  ok(tx.includes('antes de cortar — pontos a confirmar')); ok(tx.includes('[a confirmar] tipo de suporte para as buchas')); ok(tx.includes('[a confirmar] altura'));
  ok(!html.includes('<b>final</b>')); ok(tx.includes('corte a-a'));
  ok(!texto(folhaPreparacao(obra, trabalho, res, planoCorte(res.pecas), '', {})).includes('antes de cortar — pontos a confirmar'));
});
