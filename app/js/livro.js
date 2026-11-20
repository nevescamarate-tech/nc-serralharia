// Livro de custo para Excel: folhas Resumo, Custo e Posições de um trabalho.
import { capitulos } from './custo.js';
import { listaPosicoes } from './preparacao.js';
import { TIPOS } from './calc.js';

const a2 = v => Math.round(v * 100) / 100;

export function livroCusto(obra, trabalho, res, c) {
  const caps = capitulos(c), B = v => ({ v, b: true });
  const titulo = `${trabalho.nome || (TIPOS[trabalho.tipo] || {}).nome || 'Trabalho'} — ${obra.nome || 'obra'}`;
  const metros = (res.comprimentoTotal || 0) / 1000;
  const resumo = [[B(titulo)], [`Obra n.º ${obra.numero || ''} · cliente: ${obra.cliente || ''} · preços sem IVA`], [],
    [B('Capítulo'), B('Custo (€)'), B('% do total')],
    ...caps.map(k => [`${k.n}. ${k.nome}`, a2(k.total), a2(k.pct)]),
    [B('TOTAL CUSTO DIRETO (sem margem)'), B(a2(c.total)), B(100)], [],
    [B('Fecho')], [`Margem (${a2(c.margem)} % sobre a venda)`, a2(c.venda - c.total)], [B('Venda sem IVA'), B(a2(c.venda))], ['IVA', a2(c.iva)], [B('Venda com IVA'), B(a2(c.vendaIva))], [],
    [B('Indicadores')], ['Peso do metal (kg)', a2(c.pesoKg)], ['Superfície a tratar (m²)', a2(c.superficieM2)], ['Horas de oficina', a2(c.oficinaH)],
    ...(metros > 0 ? [['Comprimento (m)', a2(metros)], ['Custo por metro (€/m)', a2(c.total / metros)], ['Venda por metro (€/m)', a2(c.venda / metros)]] : []),
    ...(c.pesoKg > 0 ? [['Custo por kg de metal (€/kg)', a2(c.total / c.pesoKg)]] : []),
    ...(trabalho.precos && trabalho.precos.exemplo ? [[], ['Atenção: calculado com os preços de exemplo da app.']] : [])];
  const custo = [[B('Cap.'), B('Descrição'), B('Un'), B('Quantidade'), B('Preço unit.'), B('Total')]];
  for (const k of caps) {
    custo.push([B(k.n), B(k.nome.toUpperCase()), null, null, null, B(a2(k.total))]);
    for (const l of k.linhas) custo.push([null, l.desc, l.un, a2(l.qtd), a2(l.pu), a2(l.total)]);
  }
  custo.push([null, B('TOTAL CUSTO DIRETO'), null, null, null, B(a2(c.total))]);
  const pos = [[B('Pos.'), B('Designação'), B('Perfil / chapa'), B('Comp. / dim. (mm)'), B('Qtd.'), B('kg/un'), B('kg'), B('Corte')],
    ...listaPosicoes(res, trabalho.material).posicoes.map(p => [p.ref, p.designacao, p.perfil, p.tipo === 'perfil' ? p.L : p.dim, p.qtd, p.kgUn, p.kg, p.corte])];
  return [{ nome: 'Resumo', larguras: [44, 14, 12], linhas: resumo }, { nome: 'Custo', larguras: [6, 46, 6, 12, 12, 12], linhas: custo },
    { nome: 'Posições', larguras: [7, 22, 30, 16, 7, 9, 9, 14], linhas: pos }];
}
