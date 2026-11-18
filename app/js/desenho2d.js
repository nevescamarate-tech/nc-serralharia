// Desenho de preparação em SVG: alçado desenvolvido e planta, com cotas em mm.

const f = v => (Math.round(v * 10) / 10).toString();
const VAZIO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" class="desenho"><text x="200" y="64" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#888">Sem medidas</text></svg>`;

/** Retângulo de espessura t em volta do segmento (x1,y1)-(x2,y2). */
function faixa(x1, y1, x2, y2, t) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L * t / 2, ny = dx / L * t / 2;
  return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]];
}
function limites(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}
const pol = (pts, cls) => `<polygon class="${cls}" points="${pts.map(([x, y]) => f(x) + ',' + f(-y)).join(' ')}"/>`;

function cotaH(x1, x2, y, texto, U) {
  const tk = U * 0.5;
  return `<g class="cota"><line x1="${f(x1)}" y1="${f(-y)}" x2="${f(x2)}" y2="${f(-y)}"/>` +
    `<line x1="${f(x1)}" y1="${f(-y - tk)}" x2="${f(x1)}" y2="${f(-y + tk)}"/><line x1="${f(x2)}" y1="${f(-y - tk)}" x2="${f(x2)}" y2="${f(-y + tk)}"/>` +
    `<text x="${f((x1 + x2) / 2)}" y="${f(-y - U * 0.45)}" text-anchor="middle" font-size="${f(U * 1.25)}">${texto}</text></g>`;
}
function cotaV(x, y1, y2, texto, U) {
  const tk = U * 0.5, ym = -(y1 + y2) / 2;
  return `<g class="cota"><line x1="${f(x)}" y1="${f(-y1)}" x2="${f(x)}" y2="${f(-y2)}"/>` +
    `<line x1="${f(x - tk)}" y1="${f(-y1)}" x2="${f(x + tk)}" y2="${f(-y1)}"/><line x1="${f(x - tk)}" y1="${f(-y2)}" x2="${f(x + tk)}" y2="${f(-y2)}"/>` +
    `<text x="${f(x - U * 0.45)}" y="${f(ym)}" text-anchor="middle" font-size="${f(U * 1.25)}" transform="rotate(-90 ${f(x - U * 0.45)} ${f(ym)})">${texto}</text></g>`;
}
function embrulho(b, U, corpo) {
  const m = U * 1.5, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
  const sw = f(U * 0.07);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(b.x0 - m)} ${f(-b.y1 - m)} ${f(w)} ${f(h)}" class="desenho" preserveAspectRatio="xMidYMid meet">` +
    `<style>.pc{fill:#fff;stroke:#111;stroke-width:${sw}}.pn{fill:#e9eef2;stroke:#111;stroke-width:${sw}}.vd{fill:#d6ecf5;stroke:#4a7d91;stroke-width:${sw}}` +
    `.cota line{stroke:#c0392b;stroke-width:${f(U * 0.05)}}.cota text{fill:#c0392b;font-family:Helvetica,Arial,sans-serif}` +
    `.chao{stroke:#888;stroke-width:${f(U * 0.06)};stroke-dasharray:${f(U * 0.6)} ${f(U * 0.3)}}.pt{fill:#111}</style>${corpo}</svg>`;
}

/** Alçado desenvolvido (os troços aparecem seguidos, como se a guarda fosse esticada). */
export function alcadoSVG(res) {
  if (!res || (!res.pecas.length && !res.paineis.length)) return VAZIO;
  const formas = [], pts = [];
  for (const p of res.paineis) {
    const [x1, y1, x2, y2] = p.s, dy = p.dy || 0;
    const q = [[x1, y1], [x2, y1 + dy], [x2, y2 + dy], [x1, y2]];
    formas.push(pol(q, p.grupo === 'vidro' ? 'vd' : 'pn')); pts.push(...q);
  }
  for (const p of res.pecas) {
    const q = faixa(p.s[0], p.s[1], p.s[2], p.s[3], p.t);
    formas.push(pol(q, 'pc')); pts.push(...q);
  }
  const b = limites(pts);
  const U = Math.max(b.x1 - b.x0, b.y1 - b.y0, 400) / 40;
  for (const pt of res.pontos || []) formas.push(`<circle class="pt" cx="${f(pt.s[0])}" cy="${f(-pt.s[1])}" r="${f(U * 0.22)}"/>`);
  const yBase = Math.min(b.y0, 0);
  formas.push(`<line class="chao" x1="${f(b.x0 - U)}" y1="0" x2="${f(b.x1 + U)}" y2="0"/>`);
  let baixo = yBase, esq = b.x0;
  for (const c of res.cotas || []) {
    if (c.tipo === 'h') { const y = yBase - U * 2.2 * c.nivel; formas.push(cotaH(c.s1, c.s2, y, c.texto, U)); baixo = Math.min(baixo, y - U); }
    else { const x = b.x0 - U * 2.2; formas.push(cotaV(x, c.y1, c.y2, c.texto, U)); esq = Math.min(esq, x - U * 1.6); }
  }
  return embrulho({ x0: esq, y0: baixo, x1: b.x1, y1: b.y1 }, U, formas.join(''));
}

/** Planta (vista de cima). */
export function plantaSVG(res) {
  if (!res || (!res.pecas.length && !res.paineis.length)) return VAZIO;
  const formas = [], pts = [];
  for (const p of res.paineis) {
    const x2 = p.o[0] + p.u[0] * p.w, z2 = p.o[2] + p.u[2] * p.w;
    const q = faixa(p.o[0], -p.o[2], x2, -z2, Math.max(p.esp, 6));
    formas.push(pol(q, p.grupo === 'vidro' ? 'vd' : 'pn')); pts.push(...q);
  }
  for (const p of res.pecas) {
    const vertical = Math.hypot(p.b[0] - p.a[0], p.b[2] - p.a[2]) < 1;
    const q = vertical
      ? [[p.a[0] - p.t / 2, -p.a[2] - p.p / 2], [p.a[0] + p.t / 2, -p.a[2] - p.p / 2], [p.a[0] + p.t / 2, -p.a[2] + p.p / 2], [p.a[0] - p.t / 2, -p.a[2] + p.p / 2]]
      : faixa(p.a[0], -p.a[2], p.b[0], -p.b[2], p.p);
    formas.push(pol(q, 'pc')); pts.push(...q);
  }
  const b = limites(pts);
  const U = Math.max(b.x1 - b.x0, b.y1 - b.y0, 400) / 40;
  let lim = { ...b };
  for (const t of res.trocosPlanta || []) {
    const [ax, az] = t.a, [bx, bz] = t.b, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    // cota paralela ao troço, afastada para o lado de fora
    const ox = dz / L * U * 3, oy = dx / L * U * 3;
    const x1 = ax + ox, y1 = -az - oy, x2 = bx + ox, y2 = -bz - oy;
    const ang = Math.atan2(-(y2 - y1), x2 - x1) * 180 / Math.PI, rot = ang > 90 || ang < -90 ? ang + 180 : ang;
    const mx = (x1 + x2) / 2, my = -(y1 + y2) / 2;
    formas.push(`<g class="cota"><line x1="${f(x1)}" y1="${f(-y1)}" x2="${f(x2)}" y2="${f(-y2)}"/>` +
      `<text x="${f(mx)}" y="${f(my - U * 0.45)}" text-anchor="middle" font-size="${f(U * 1.25)}" transform="rotate(${f(rot)} ${f(mx)} ${f(my)})">${t.texto}</text></g>`);
    const l2 = limites([[x1, y1], [x2, y2]]);
    lim = { x0: Math.min(lim.x0, l2.x0 - U), y0: Math.min(lim.y0, l2.y0 - U * 2), x1: Math.max(lim.x1, l2.x1 + U), y1: Math.max(lim.y1, l2.y1 + U * 2) };
  }
  return embrulho(lim, U, formas.join(''));
}
