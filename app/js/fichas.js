// Ficha de um troço de tubagem flangeada: desenho só desse troço, as suas ligações, flanges e parafusaria.
import { esc } from './fmt.js';
import { alcadoSVG } from './desenho2d.js';
import { DIAMETROS } from './catalogo.js';

const COR = { 'inox-inox': '#5e9732', 'inox-FFD': '#e69500', 'ferro-ferro': '#8c8c8c' };
const NOME = { 'inox-inox': 'inox – inox', 'inox-FFD': 'inox – ferro fundido', 'ferro-ferro': 'ferro – ferro' };
const flangeInox = pn => `Flange solta EN 1092-1 tipo 02 PN${pn} + colar de soldar tipo 32`, flangeFerro = pn => `Flange EN 1092-2 PN${pn} (ferro fundido / equipamento)`;

/** Resultado reduzido a um troço, para o desenhar sozinho e bem enquadrado. */
export function subTroco(res, id) {
  const t = res && res.flangeada && res.flangeada.trocos.find(x => x.id === id);
  if (!t) return null;
  const ns = t.ends.filter(x => typeof x === 'number');
  return { pecas: res.pecas.filter(p => p.tro === id), paineis: [], pontos: [], avisos: [], vaos: [], trocosPlanta: [], ligacoes: 0, comprimentoTotal: 0, altura: 0,
    cotas: res.cotas.filter(c => c.tro === id), curvas2d: (res.curvas2d || []).filter(c => c.tro === id),
    blocos2d: (res.blocos2d || []).filter(b => b.tro === id || ns.includes(b.lig)), etiquetas: (res.etiquetas || []).filter(e => ns.includes(e.lig)), semPontos2d: true };
}

/** Dados da ficha: o troço, o desenho, as ligações (com o que está do outro lado) e o total de parafusos. */
export function fichaTroco(res, id) {
  const sub = subTroco(res, id);
  if (!sub) return null;
  const fg = res.flangeada, troco = fg.trocos.find(x => x.id === id), usos = {};
  for (const t of fg.trocos) for (const e of t.ends) if (typeof e === 'number') (usos[e] = usos[e] || []).push(t.id);
  const total = {}, ligs = [];
  for (const e of troco.ends) {
    if (typeof e !== 'number') { ligs.push({ livre: e.livre }); continue; }
    const l = fg.ligacoes.find(x => x.n === e), outro = l.entre[0] === id ? l.entre[1] : l.entre[0];
    const k = `M${l.parafuso.M} × ${l.parafuso.L}`; total[k] = (total[k] || 0) + l.parafuso.n;
    ligs.push({ ...l, outro, daqui: flangeInox(l.pn), dela: l.tipo === 'inox-inox' ? flangeInox(l.pn) : flangeFerro(l.pn), partilhada: usos[e].length > 1 });
  }
  const dns = [...new Set(ligs.filter(l => l.n).map(l => l.dn))];
  return { troco, svg: alcadoSVG(sub), ligs, total, flanges: dns.map(dn => ({ dn, svg: flangeSVG(ligs.find(l => l.dn === dn).flange, dn, fg.pn, DIAMETROS[dn].de) })) };
}

const n1 = v => (Math.round(v * 10) / 10).toString();
/** Flange vista de frente, com os furos no sítio: círculo de furação K, n furos de Ø h, a cavalo dos eixos. */
export function flangeSVG(f, dn, pn, furoCentral) {
  const R = f.D / 2, m = R * 0.12, alt = 2 * R + 2 * m + R * 0.62, tx = R * 0.17;
  let furos = '';
  for (let i = 0; i < f.n; i++) { const a = (i + 0.5) * 2 * Math.PI / f.n; furos += `<circle class="furo" cx="${n1(Math.sin(a) * f.K / 2)}" cy="${n1(-Math.cos(a) * f.K / 2)}" r="${n1(f.h / 2)}"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(-R - m)} ${n1(-R - m)} ${n1(2 * (R + m))} ${n1(alt)}" class="desenho flange"><style>.fx{fill:#e3e8ec;stroke:#111;stroke-width:${n1(R * 0.012)}}.furo,.fc{fill:#fff;stroke:#111;stroke-width:${n1(R * 0.012)}}.fk,.fe{fill:none;stroke:#c0392b;stroke-width:${n1(R * 0.008)};stroke-dasharray:${n1(R * 0.06)} ${n1(R * 0.03)}}.ft{fill:#111;font-family:Helvetica,Arial,sans-serif}</style>
<circle class="fx" r="${n1(R)}"/><circle class="fc" r="${n1(furoCentral / 2)}"/><circle class="fk" r="${n1(f.K / 2)}"/><line class="fe" x1="${n1(-R - m / 2)}" y1="0" x2="${n1(R + m / 2)}" y2="0"/><line class="fe" x1="0" y1="${n1(-R - m / 2)}" x2="0" y2="${n1(R + m / 2)}"/>${furos}
<text class="ft" y="${n1(R + m + tx)}" text-anchor="middle" font-size="${n1(tx)}" font-weight="bold">DN${dn} PN${pn} · Ø${f.D} · K ${f.K}</text><text class="ft" y="${n1(R + m + tx * 2.3)}" text-anchor="middle" font-size="${n1(tx)}">${f.n} furos Ø${f.h} · parafusos M${f.M}</text></svg>`;
}

/** Tabela das ligações de um troço (HTML), igual no ecrã e nas folhas. */
export function tabelaLigacoes(ficha, cls = 'tab') {
  const linhas = ficha.ligs.map(l => (l.livre ? `<tr><td>—</td><td colspan="5">${esc(l.livre)}</td></tr>`
    : `<tr><td><b style="color:${COR[l.tipo]}">${l.n}</b><br><small>${NOME[l.tipo]}</small></td><td>${esc(l.outro)}</td><td>DN${l.dn} PN${l.pn}<br><small>Ø${l.flange.D} · K ${l.flange.K} · ${l.flange.n} furos Ø${l.flange.h}</small></td>
<td><small>Deste lado: ${esc(l.daqui)}<br>Outro lado: ${esc(l.dela)}</small></td>
<td>${l.kit ? `<b>Kit de isolamento</b>: junta isolante + ${l.flange.n} mangas + ${2 * l.flange.n} anilhas isolantes` : 'Junta plana EPDM e=3 (água potável)'}</td>
<td><b>${l.parafuso.n} × M${l.parafuso.M} × ${l.parafuso.L}</b> A4-70<br><small>${l.parafuso.n} porcas + ${2 * l.parafuso.n} anilhas A4${l.partilhada ? ' · partilhada com outro troço: contar uma vez' : ''}</small></td></tr>`)).join('');
  const tot = Object.entries(ficha.total).map(([k, v]) => `${v} parafusos ${k}`).join(' · ') || '—';
  return `<table class="${cls}"><tr><th>Ligação</th><th>Liga a</th><th>Flange</th><th>Flanges de cada lado</th><th>Junta</th><th>Parafusaria</th></tr>${linhas}</table>
<p class="${cls === 'tab' ? 'dica' : 'a3-n'}"><b>Total neste troço:</b> ${tot} (com porcas e anilhas A4).</p>`;
}
