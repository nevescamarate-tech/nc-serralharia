// Outras soluções para as mesmas medidas: variantes de enchimento, estrutura e material, cada uma com o seu preço.
import { calcular } from './calc.js';
import { planoCorte } from './corte.js';
import { custo } from './custo.js';
import { verificar } from './verificacao.js';
import { MATERIAIS, acabamentoDe } from './catalogo.js';

const MAT_CORRENTES = [['aco', 'pintado'], ['aco', 'galv_lacado'], ['inox304', 'escovado']];
const MAT_EXTERIOR = [['aco', 'galvanizado'], ['aco', 'galv_lacado']];
// Por tipo: o campo das medidas que muda a solução, as suas opções, e os materiais que fazem sentido comparar.
const EIXOS = {
  guarda: { campo: 'enchimento', opcoes: { varoes: 'varões verticais', barras: 'barras horizontais', vidro: 'vidro laminado', chapa: 'chapa' }, materiais: MAT_CORRENTES },
  gradeamento: { campo: 'enchimento', opcoes: { varoes: 'varões verticais', barras: 'barras horizontais' }, materiais: MAT_CORRENTES },
  portao: { campo: 'enchimento', opcoes: { varoes: 'varões', chapa: 'chapa lisa', laminas: 'lâminas', almofadas: 'almofadas quinadas' }, materiais: [['aco', 'pintado'], ['aco', 'galv_lacado']] },
  telheiro: { campo: 'cobertura', opcoes: { sandwich: 'painel sandwich', trapezoidal: 'chapa trapezoidal', ripado: 'ripado' }, materiais: MAT_EXTERIOR },
  escada: { campo: 'degrau', opcoes: { lacrimada: 'degraus em chapa lacrimada', gradil: 'degraus em gradil' }, materiais: MAT_EXTERIOR },
  corrimao: { materiais: MAT_CORRENTES }, grade: { materiais: [['aco', 'pintado'], ['aco', 'galv_lacado']] }, guardamuro: { materiais: MAT_CORRENTES }, livre: { materiais: MAT_CORRENTES },
  tubagem: { materiais: [['inox304', 'nenhum'], ['inox304', 'decapado'], ['inox316', 'decapado']] },
  flangeada: { materiais: [['inox304', 'nenhum'], ['inox304', 'decapado'], ['inox316', 'decapado']] },
};
const nomeMat = (m, a) => `${MATERIAIS[m].nome.replace(' (ferro)', '')} ${acabamentoDe(m, a).nome.toLowerCase()}`;

/** Lista de variantes do trabalho: { rotulo, medidas, material, acabamento, atual }. */
export function variantes(trabalho) {
  const eixo = EIXOS[trabalho.tipo];
  if (!eixo) return [];
  const m = trabalho.medidas || {}, atualOp = eixo.campo ? m[eixo.campo] : null, lista = [];
  const ops = eixo.campo ? Object.entries(eixo.opcoes) : [[null, '']];
  // uma opção que não está na lista (por exemplo «sem enchimento») entra como a solução atual
  if (eixo.campo && atualOp != null && !Object.prototype.hasOwnProperty.call(eixo.opcoes, atualOp)) ops.unshift([atualOp, 'solução atual']);
  const mats = eixo.materiais.some(([a, b]) => a === trabalho.material && b === trabalho.acabamento) ? eixo.materiais : [[trabalho.material, trabalho.acabamento], ...eixo.materiais];
  for (const [op, nomeOp] of ops) for (const [mat, ac] of mats) {
    if (!MATERIAIS[mat] || !MATERIAIS[mat].acabamentos.some(x => x.id === ac)) continue;
    const atual = mat === trabalho.material && ac === trabalho.acabamento && (!eixo.campo || op === (atualOp ?? Object.keys(eixo.opcoes)[0]));
    lista.push({ rotulo: [nomeOp, nomeMat(mat, ac)].filter(Boolean).join(' · '), medidas: eixo.campo ? { ...m, [eixo.campo]: op } : { ...m }, material: mat, acabamento: ac, atual });
  }
  return lista;
}

/** Calcula cada variante: preço de venda, peso e se passa na verificação simples. Ordenadas da mais barata para a mais cara. */
export function compararSolucoes(trabalho) {
  const out = [];
  for (const v of variantes(trabalho)) {
    const t = { ...trabalho, medidas: v.medidas, material: v.material, acabamento: v.acabamento };
    const res = calcular(t);
    if (!res.pecas.length && !res.paineis.length) continue;
    const pr = t.precos || {}, c = custo(t, res, planoCorte(res.pecas, { vara: pr.vara, serra: pr.serra }), pr), vf = verificar(t, res);
    out.push({ ...v, venda: c.venda, custo: c.total, kg: c.pesoKg, semPreco: c.semPreco.length > 0, passa: vf ? vf.ok : null });
  }
  return out.sort((a, b) => a.venda - b.venda);
}
