import { dims } from '../catalogo.js';

/** Número finito e positivo, senão o valor por omissão. */
export function num(v, def) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : def;
}
/** Número finito (pode ser negativo ou zero), senão 0. */
export function numLivre(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
/** Número de vãos iguais para que nenhum passe de `max`. */
export function reparte(L, max) {
  if (!(L > 0) || !(max > 0)) return 1;
  return Math.max(1, Math.ceil(L / max - 1e-9));
}
export const hip = (a, b) => Math.sqrt(a * a + b * b);
export const arred = (v, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas;

export function vazio(avisos = []) {
  return { pecas: [], paineis: [], acessorios: [], pontos: [], ligacoes: 0, avisos, cotas: [], vaos: [],
    trocosPlanta: [], comprimentoTotal: 0, altura: 0 };
}

/**
 * Peça linear. a e b são os extremos do eixo [x,y,z] em mm; s = [s1,y1,s2,y2] no alçado.
 * t = espessura vista no alçado, p = profundidade. L pode ser imposto (ponta mais comprida).
 */
export function peca(grupo, perfil, a, b, s, o = {}) {
  const d = dims(perfil);
  const L = o.L ?? Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
  return { grupo, perfil, L: arred(L), ang: o.ang || [0, 0], a, b, s, t: o.t ?? d.a, p: o.p ?? d.b, redondo: d.redondo };
}

/** Acumulador de acessórios. */
export function sacoAcessorios() {
  const m = new Map();
  return {
    junta(ref, qtd = 1) { if (qtd > 0) m.set(ref, (m.get(ref) || 0) + qtd); },
    lista() { return [...m].map(([ref, qtd]) => ({ ref, qtd: arred(qtd, 2) })); },
  };
}

/** Quantos varões de espessura d cabem num vão livre para a folga não passar de vaoMax. */
export function repartirVaroes(livre, d, vaoMax) {
  const n = Math.max(0, Math.ceil((livre + d) / (vaoMax + d) - 1e-9) - 1);
  return { n, folga: (livre - n * d) / (n + 1) };
}
