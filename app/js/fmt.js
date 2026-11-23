// Formatação e logótipo partilhados.

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** 1234.5 → "1 234,50" */
export function dec(v, casas = 2) {
  const n = Number.isFinite(+v) ? +v : 0;
  const [i, d] = Math.abs(n).toFixed(casas).split('.');
  return (n < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? ',' + d : '');
}
export const eur = v => dec(v, 2) + ' €';
/** «Feito por X» e, se outra pessoa mexeu depois, «alterado por Y». Vazio nos trabalhos antigos. */
export function textoQuem(x) {
  const f = x && x.feitoPor, a = x && x.alteradoPor;
  return [f && 'Feito por ' + f, a && a !== f && (f ? 'alterado por ' : 'Alterado por ') + a].filter(Boolean).join(', ');
}
export function dataPT(iso) {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-PT');
}

/** Símbolo NC (arco em C com o N dentro) e, opcionalmente, a palavra «serralharia». */
export function logoSVG({ texto = true, altura = 72, cor = 'currentColor' } = {}) {
  const vb = texto ? '0 0 400 500' : '40 40 320 320';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" height="${altura}" role="img" aria-label="NC serralharia">
<g fill="none" stroke="${cor}" stroke-linecap="round" stroke-linejoin="round">
<path d="M304.8 92.6 A150 150 0 1 0 304.8 307.4" stroke-width="10" stroke-linecap="butt"/>
<path d="M140 281 V119 L259 281 V119" stroke-width="8"/>
</g>${texto ? `<text x="200" y="455" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" letter-spacing="14" fill="${cor}" opacity=".7">serralharia</text>` : ''}
</svg>`;
}
