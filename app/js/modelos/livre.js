// Trabalho livre: a lista de peças é escrita à mão (ou vem do Claude). Sem desenho automático:
// a app faz o corte, o aprovisionamento, o peso, o custo e as folhas a partir da lista.
import { PERFIS, ACESSORIOS } from '../catalogo.js';
import { num, numLivre, vazio, peca, sacoAcessorios } from './util.js';

export const DEF_LIVRE = { pecas: [{ nome: '', perfil: 'tq40x2', comp: '', qtd: 1, c1: 90, c2: 90 }], chapas: [], ferragens: [], outros: [] };
/** Chapas e painéis que se podem pôr num trabalho livre (grupos que o catálogo sabe pesar e orçar). */
export const TIPOS_CHAPA = { chapa: 'Chapa lisa', lacrimada: 'Chapa lacrimada', gradil: 'Gradil eletrossoldado', vidro: 'Vidro laminado', trapezoidal: 'Chapa trapezoidal', sandwich: 'Painel sandwich', xps: 'Isolamento XPS' };
const MAX_LINHAS = 60, MAX_QTD = 500, MAX_PECAS = 4000;

const lista = v => (Array.isArray(v) ? v.slice(0, MAX_LINHAS) : []);
const texto = v => String(v ?? '').trim().slice(0, 60);
const vazia = v => v === '' || v === null || v === undefined;
const quantas = v => Math.min(MAX_QTD, Math.max(0, Math.round(numLivre(vazia(v) ? 1 : v))));
// Corte escrito como nas folhas: 90 = esquadria, 45 = meia-esquadria. Guarda-se o desvio à esquadria.
const corte = v => { const g = numLivre(vazia(v) ? 90 : v); return g >= 10 && g <= 90 ? 90 - g : 0; };

export function calcLivre(medidas = {}) {
  const m = medidas || {}, r = vazio(), ac = sacoAcessorios();
  r.extras = [];
  lista(m.pecas).forEach((l, i) => {
    if (!l || vazia(l.comp)) return;                                   // linha ainda por preencher
    const comp = num(l.comp, 0), n = quantas(l.qtd), nome = texto(l.nome);
    if (!PERFIS[l.perfil]) { r.avisos.push(`Peças, linha ${i + 1}: perfil desconhecido.`); return; }
    if (!comp || comp > 100000) { r.avisos.push(`Peças, linha ${i + 1}: comprimento inválido (em mm).`); return; }
    if (!n) return;
    if (r.pecas.length + n > MAX_PECAS) { r.avisos.push(`Peças, linha ${i + 1}: peças a mais; confirme as quantidades.`); return; }
    const y = -i * 200, ang = [corte(l.c1), corte(l.c2)];
    for (let k = 0; k < n; k++) r.pecas.push({ ...peca('l' + (i + 1), l.perfil, [0, y, 0], [comp, y, 0], [0, y, comp, y], { L: comp, ang }), nome: nome || 'Peça', letra: 'P', ordem: i + 1 });
  });
  lista(m.chapas).forEach((l, i) => {
    if (!l || (vazia(l.larg) && vazia(l.alt))) return;
    const w = num(l.larg, 0), h = num(l.alt, 0), esp = num(l.esp, 0), n = quantas(l.qtd);
    if (!TIPOS_CHAPA[l.tipo]) { r.avisos.push(`Chapas, linha ${i + 1}: tipo de chapa desconhecido.`); return; }
    if (!w || !h || w > 20000 || h > 20000 || !esp || esp > 200) { r.avisos.push(`Chapas, linha ${i + 1}: medidas inválidas (em mm).`); return; }
    for (let k = 0; k < Math.min(n, 200); k++) r.paineis.push({ grupo: l.tipo, esp, w, h, o: [0, 0, 0], u: [1, 0, 0], dy: 0, s: [0, 0], sem2d: true, sem3d: true, nome: texto(l.nome) || 'Chapa', letra: 'CH', ordem: 1000 + i });
  });
  for (const l of lista(m.ferragens)) { const n = Math.max(0, numLivre(l && l.qtd)); if (l && ACESSORIOS[l.ref] && n > 0 && n < 1e5) ac.junta(l.ref, n); }
  for (const l of lista(m.outros)) {
    const nome = texto(l && l.nome), n = Math.max(0, numLivre(l && l.qtd));
    if (nome && n > 0 && n < 1e5) r.extras.push({ nome, qtd: n, pu: Math.max(0, numLivre(l.preco)) });
  }
  r.acessorios = ac.lista();
  if (!r.pecas.length && !r.paineis.length) { r.acessorios = []; r.extras = []; if (!r.avisos.length) r.avisos.push('Escreva a primeira peça: perfil, comprimento e quantidade.'); return r; }
  r.ligacoes = Math.round(1.5 * r.pecas.length);                        // sem desenho não se sabem as ligações: estimativa por alto
  r.livre = { linhas: new Set(r.pecas.map(p => p.grupo)).size };
  return r;
}
