import { test, eq, ok, perto, semNaN } from './t.js';
import { calcLivre, DEF_LIVRE, TIPOS_CHAPA } from '../js/modelos/livre.js';
import { calcular, TIPOS } from '../js/calc.js';
import { planoCorte } from '../js/corte.js';
import { custo, capitulos } from '../js/custo.js';
import { listaPosicoes, aprovisionamento } from '../js/preparacao.js';
import { folhaPreparacao } from '../js/folhas.js';
import { PRECOS_EXEMPLO } from '../js/catalogo.js';

// Suporte de máquina: 4 pernas, 2 travessas em meia-esquadria, tampo em chapa, sapatas e rodas compradas à parte.
const suporte = (m = {}) => ({
  pecas: [{ nome: 'Pernas', perfil: 'tq60x3', comp: 850, qtd: 4, c1: 90, c2: 90 }, { nome: 'Travessas', perfil: 'tret60x40x2', comp: '1200', qtd: '2', c1: 45, c2: 45 }],
  chapas: [{ nome: 'Tampo', tipo: 'chapa', esp: 5, larg: 1300, alt: 700, qtd: 1 }],
  ferragens: [{ ref: 'placa_base', qtd: 4 }], outros: [{ nome: 'Rodas com travão', qtd: 4, preco: 12 }], ...m });
const trab = (m = {}) => ({ id: 't', tipo: 'livre', nome: 'Suporte', medidas: suporte(m), material: 'aco', acabamento: 'pintado', margem: 30, horasOficina: null, horasMontagem: 2 });
const precos = () => JSON.parse(JSON.stringify(PRECOS_EXEMPLO));

test('o trabalho livre existe na lista de tipos e, vazio, pede a primeira peça', () => {
  ok(TIPOS.livre && !TIPOS.livre.oculto); ok(/livre/i.test(TIPOS.livre.nome));
  const r = calcLivre({}); eq(r.pecas.length, 0); ok(r.avisos.length > 0);
  eq(calcular({ tipo: 'livre', medidas: JSON.parse(JSON.stringify(DEF_LIVRE)) }).pecas.length, 0);
});
test('cada linha dá as suas peças: quantidade, comprimento e cortes como foram escritos', () => {
  const r = calcLivre(suporte());
  eq(r.pecas.length, 6);
  const pernas = r.pecas.filter(p => p.nome === 'Pernas'), trav = r.pecas.filter(p => p.nome === 'Travessas');
  eq(pernas.length, 4); eq(pernas[0].L, 850); eq(pernas[0].perfil, 'tq60x3'); eq(pernas[0].ang, [0, 0]);
  eq(trav.length, 2); eq(trav[0].L, 1200); eq(trav[0].ang, [45, 45]);
  eq(r.paineis.length, 1); eq([r.paineis[0].grupo, r.paineis[0].esp, r.paineis[0].w, r.paineis[0].h], ['chapa', 5, 1300, 700]);
  eq(r.acessorios, [{ ref: 'placa_base', qtd: 4 }]); eq(r.extras, [{ nome: 'Rodas com travão', qtd: 4, pu: 12 }]);
  ok(r.livre); ok(semNaN(r)); eq(r.avisos, []);
});
test('posições: com o nome que o serralheiro deu, pela ordem em que escreveu, e cortes legíveis', () => {
  const { posicoes } = listaPosicoes(calcLivre(suporte()), 'aco');
  eq(posicoes.map(p => [p.ref, p.designacao, p.qtd, p.dim, p.corte]), [['P1', 'Pernas', 4, '850', '90°/90°'], ['P2', 'Travessas', 2, '1200', '45°/45°'], ['CH1', 'Tampo', 1, '1300 × 700', '—']]);
  ok(posicoes[0].kg > 0 && posicoes[2].kg > 0);
  // linhas sem nome ficam «Peça» e «Chapa»; a ordem é a das linhas, não a dos comprimentos
  const s = listaPosicoes(calcLivre({ pecas: [{ perfil: 'tq40x2', comp: 300, qtd: 1 }, { perfil: 'tq40x2', comp: 900, qtd: 1 }], chapas: [{ tipo: 'lacrimada', esp: 3, larg: 500, alt: 400, qtd: 2 }] }), 'aco').posicoes;
  eq(s.map(p => [p.ref, p.designacao, p.dim]), [['P1', 'Peça', '300'], ['P2', 'Peça', '900'], ['CH1', 'Chapa', '500 × 400']]);
});
test('lista de corte: todas as peças entram nas varas e cada corte leva a sua posição', () => {
  const r = calcLivre(suporte()), plano = planoCorte(r.pecas), ap = aprovisionamento(r, plano, 'aco');
  eq(plano.porPerfil.reduce((s, g) => s + g.varas.reduce((a, v) => a + v.cortes.length, 0), 0), 6);
  const refs = ap.varas.flatMap(v => v.padroes.flatMap(p => p.cortes.map(c => c.ref)));
  ok(refs.length > 0 && !refs.includes('?'), 'cortes sem posição: ' + refs.join(' '));
  ok(ap.compra.some(c => /placa de base/i.test(c.nome) && c.qtd === 4)); ok(ap.compra.some(c => c.nome === 'Rodas com travão' && c.qtd === 4));
  eq(ap.chapas.length, 1);
});
test('custo: perfis, chapa, ferragens da lista e os outros artigos com o preço que se escreveu', () => {
  const t = trab(), r = calcular(t), c = custo(t, r, planoCorte(r.pecas), precos());
  eq(c.semPreco, []); ok(semNaN(c)); ok(c.material > 0 && c.paineis > 0);
  const rodas = c.linhas.find(l => l.desc === 'Rodas com travão'); eq([rodas.qtd, rodas.pu, rodas.total, rodas.cap], [4, 12, 48, 'ferragens']);
  perto(c.acessorios, 4 * PRECOS_EXEMPLO.acessorios.placa_base + 48, 0.01);
  perto(c.linhas.reduce((s, l) => s + l.total, 0), c.total, 0.01); ok(capitulos(c).some(k => k.id === 'ferragens'));
  ok(c.oficinaH > 0, 'há uma estimativa de horas de oficina');
});
test('um artigo sem preço fica avisado como «sem preço» em vez de entrar a zero sem ninguém ver', () => {
  const t = trab({ outros: [{ nome: 'Motor', qtd: 1, preco: '' }] }), r = calcular(t), c = custo(t, r, planoCorte(r.pecas), precos());
  eq(c.semPreco, ['Motor']);
});
test('linhas más não rebentam: perfil desconhecido, medidas absurdas e quantidades exageradas ficam de fora ou limitadas, com aviso', () => {
  const r = calcLivre({ pecas: [{ nome: 'A', perfil: 'xpto', comp: 500, qtd: 1 }, { nome: 'B', perfil: 'tq40x2', comp: -5, qtd: 1 }, { nome: 'C', perfil: 'tq40x2', comp: 9e7, qtd: 1 },
    { nome: 'D', perfil: 'tq40x2', comp: 500, qtd: 1e6, c1: 200, c2: -3 }, { nome: 'E', perfil: 'tq40x2', comp: '', qtd: 1 }],
    chapas: [{ tipo: 'foguetao', esp: 3, larg: 100, alt: 100, qtd: 1 }, { tipo: 'chapa', esp: 3, larg: 0, alt: 100, qtd: 1 }], ferragens: [{ ref: 'nada', qtd: 2 }, { ref: 'tampa', qtd: 0 }], outros: [{ nome: '', qtd: 2, preco: 3 }] });
  ok(r.pecas.length > 0 && r.pecas.length < 5000); ok(r.pecas.every(p => p.nome === 'D' && p.L === 500)); eq(r.pecas[0].ang, [0, 0]);
  eq(r.paineis, []); eq(r.acessorios, []); eq(r.extras, []);
  ok(r.avisos.some(a => /linha 1/i.test(a)) && r.avisos.some(a => /linha 3/i.test(a)), r.avisos.join(' | ')); ok(!r.avisos.some(a => /linha 5/i.test(a)), 'linha por preencher não é erro');
  ok(semNaN(r)); eq(calcLivre({ pecas: 'x', chapas: null, ferragens: 3 }).pecas.length, 0);
});
test('os tipos de chapa do formulário são todos painéis que a app sabe pesar e orçar', () => {
  ok(Object.keys(TIPOS_CHAPA).length >= 4);
  for (const tipo of Object.keys(TIPOS_CHAPA)) {
    const t = trab({ chapas: [{ nome: 'X', tipo, esp: 3, larg: 1000, alt: 1000, qtd: 2 }] }), r = calcular(t), c = custo(t, r, planoCorte(r.pecas), precos());
    eq(r.paineis.length, 2); eq(c.semPreco, [], tipo); ok(c.paineis > 0, tipo);
  }
});
test('folhas: sem desenho automático; a fotografia do rascunho ocupa a folha das vistas', () => {
  const t = trab(), r = calcular(t), plano = planoCorte(r.pecas), obra = { id: 'o', nome: 'Obra', numero: '7', trabalhos: [t] };
  const semFoto = folhaPreparacao(obra, t, r, plano, '', {}), tx = semFoto.replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const p of ['pernas', 'travessas', 'tampo', 'rodas com travão', 'rascunho', 'junte a fotografia']) ok(tx.includes(p), 'falta «' + p + '»');
  ok(!tx.includes('alçado') && !tx.includes('planta'), 'não pode prometer desenhos que não existem'); ok(!/NaN|undefined/.test(semFoto));
  const comFoto = folhaPreparacao(obra, t, r, plano, '', {}, [{ src: 'data:image/jpeg;base64,AAAA', legenda: 'Esboço com medidas' }, { src: 'data:image/jpeg;base64,BBBB', legenda: '' }]);
  ok(comFoto.includes('data:image/jpeg;base64,AAAA') && comFoto.includes('Esboço com medidas')); ok(!/junte a fotografia/i.test(comFoto));
  eq(comFoto.split('data:image/jpeg;base64,AAAA').length - 1, 1, 'a mesma fotografia não se repete nas folhas');
  ok(comFoto.includes('7-L1'), 'número do desenho com a letra do trabalho livre');
});
