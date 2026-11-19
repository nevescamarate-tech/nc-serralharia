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
function embrulho(b, U, corpo, cor = "#c0392b") {
  const m = U * 1.5, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
  const sw = f(U * 0.07);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(b.x0 - m)} ${f(-b.y1 - m)} ${f(w)} ${f(h)}" class="desenho" preserveAspectRatio="xMidYMid meet">` +
    `<style>.pc{fill:#fff;stroke:#111;stroke-width:${sw}}.pf{fill:#dfe5ea;fill-opacity:.8;stroke:#111;stroke-width:${sw}}.pn{fill:#e9eef2;stroke:#111;stroke-width:${sw}}.vd{fill:#d6ecf5;stroke:#4a7d91;stroke-width:${sw}}` +
    `.cota line{stroke:${cor};stroke-width:${f(U * 0.05)}}.cota text{fill:${cor};font-family:Helvetica,Arial,sans-serif}` +
    `.bl circle{fill:#fff;stroke:#1b7f3b;stroke-width:${f(U * 0.09)}}.bl line{stroke:#1b7f3b;stroke-width:${f(U * 0.06)}}.bl text{fill:#111;font-family:Helvetica,Arial,sans-serif;font-weight:bold}` +
    `.chao{stroke:#888;stroke-width:${f(U * 0.06)};stroke-dasharray:${f(U * 0.6)} ${f(U * 0.3)}}.pt{fill:#111}</style>${corpo}</svg>`;
}

/** Alçado desenvolvido (os troços aparecem seguidos, como se a guarda fosse esticada). */
export function alcadoSVG(res, { fino = false, refs = null, janela = null } = {}) {
  if (!res || (!res.pecas.length && !res.paineis.length)) return VAZIO;
  const formas = [], pts = [], frentes = [];
  for (const p of res.paineis) {
    const [x1, y1, x2, y2] = p.s, dy = p.dy || 0;
    const q = [[x1, y1], [x2, y1 + dy], [x2, y2 + dy], [x1, y2]];
    if (p.sem2d) continue;                       // chapa de trás, isolamento: não se veem de frente
    if (p.frente) frentes.push(pol(q, 'pf')); else formas.push(pol(q, p.grupo === 'vidro' ? 'vd' : 'pn'));
    pts.push(...q);
  }
  for (const p of res.pecas) {
    const q = faixa(p.s[0], p.s[1], p.s[2], p.s[3], p.ts ?? p.t);
    formas.push(pol(q, 'pc')); pts.push(...q);
  }
  formas.push(...frentes);                       // chapas da frente por cima da estrutura, meio transparentes
  const b = limites(pts);
  if (janela) { b.x0 = janela[0]; b.x1 = janela[1]; }   // pormenor: só se vê esta faixa do alçado
  const U = Math.max(b.x1 - b.x0, b.y1 - b.y0, 400) / (janela ? 55 : fino ? 85 : 40);
  for (const pt of res.pontos || []) formas.push(`<circle class="pt" cx="${f(pt.s[0])}" cy="${f(-pt.s[1])}" r="${f(U * 0.22)}"/>`);
  if (refs) {   // um balão por referência, na primeira peça que a tem
    const vistos = new Set(); let k = 0;
    for (const p of [...res.pecas, ...res.paineis]) {
      const ref = refs.get(p); if (!ref || p.sem2d || vistos.has(ref)) continue; vistos.add(ref);
      let ax, ay, bx, by;
      if (p.w !== undefined) { ax = (p.s[0] + p.s[2]) / 2; ay = (p.s[1] + p.s[3]) / 2 + (p.dy || 0) / 2; bx = ax; by = ay; }
      else {
        const dx = p.s[2] - p.s[0], dy = p.s[3] - p.s[1], L = Math.hypot(dx, dy) || 1, vert = Math.abs(dx) < Math.abs(dy) * 0.2;
        const fr = vert ? 0.3 + 0.2 * (k++ % 3) : 0.3;
        ax = p.s[0] + dx * fr; ay = p.s[1] + dy * fr;
        if (vert) { bx = ax + U * 2.4; by = ay + U * 1.4; }
        else { const s = dx >= 0 ? 1 : -1; bx = ax + (-dy / L) * s * U * 2.6; by = ay + (dx / L) * s * U * 2.6; }
      }
      const r = U * 1.2;
      formas.push(`<g class="bl">${bx !== ax || by !== ay ? `<line x1="${f(ax)}" y1="${f(-ay)}" x2="${f(bx)}" y2="${f(-by)}"/><circle cx="${f(ax)}" cy="${f(-ay)}" r="${f(U * 0.16)}" style="fill:#1b7f3b"/>` : ''}` +
        `<circle cx="${f(bx)}" cy="${f(-by)}" r="${f(r)}"/><text x="${f(bx)}" y="${f(-by + U * 0.36)}" text-anchor="middle" font-size="${f(U * (ref.length > 2 ? 0.8 : 1.05))}">${ref}</text></g>`);
      if (!janela) { b.x0 = Math.min(b.x0, bx - r); b.x1 = Math.max(b.x1, bx + r); }
      b.y0 = Math.min(b.y0, by - r); b.y1 = Math.max(b.y1, by + r);
    }
  }
  const yBase = Math.min(b.y0, 0), isometrico = (res.cotas || []).some(c => c.tipo === 'l');
  if (!isometrico) formas.push(`<line class="chao" x1="${f(b.x0 - U)}" y1="0" x2="${f(b.x1 + U)}" y2="0"/>`);
  else { b.y0 -= U * 2; b.y1 += U * 2; b.x0 -= U * 2; b.x1 += U * 2; }
  let baixo = yBase, esq = b.x0;
  for (const c of res.cotas || []) {
    if (c.tipo === 'l') {   // cota livre, ao longo de um troço em qualquer direção (isométrico)
      const mx = (c.a[0] + c.b[0]) / 2, my = -(c.a[1] + c.b[1]) / 2;
      let ang = Math.atan2(-(c.b[1] - c.a[1]), c.b[0] - c.a[0]) * 180 / Math.PI;
      if (ang > 90 || ang <= -90) ang += 180;
      formas.push(`<g class="cota"><text x="${f(mx)}" y="${f(my - U * 1.1)}" text-anchor="middle" font-size="${f(U * 1.25)}" transform="rotate(${f(ang)} ${f(mx)} ${f(my)})">${c.texto}</text></g>`);
    } else if (c.tipo === 'h') { const y = yBase - U * 2.2 * c.nivel; formas.push(cotaH(c.s1, c.s2, y, c.texto, U)); baixo = Math.min(baixo, y - U); }
    else { const x = b.x0 - U * 2.2; formas.push(cotaV(x, c.y1, c.y2, c.texto, U)); esq = Math.min(esq, x - U * 1.6); }
  }
  return embrulho({ x0: esq, y0: baixo, x1: b.x1, y1: b.y1 }, U, formas.join(''), fino || janela ? '#1f4e9c' : undefined);
}

/** Planta (vista de cima). */
export function plantaSVG(res, { fino = false } = {}) {
  if (!res || (!res.pecas.length && !res.paineis.length)) return VAZIO;
  const formas = [], pts = [];
  for (const p of res.paineis) {
    if (p.plano || p.sem2d) continue;   // cobertura, tardoz e isolamento: na planta tapariam a estrutura
    const lw = p.vis ? p.vis[0] : p.w, x2 = p.o[0] + p.u[0] * lw, z2 = p.o[2] + p.u[2] * lw;
    const q = faixa(p.o[0], -p.o[2], x2, -z2, Math.max(p.e3 || p.esp, 6));
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
  const U = Math.max(b.x1 - b.x0, b.y1 - b.y0, 400) / (fino ? 85 : 40);
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
  return embrulho(lim, U, formas.join(''), fino ? '#1f4e9c' : undefined);
}

/**
 * Vista de topo: o trabalho visto ao longo do seu comprimento (eixos largura × altura).
 * Numa guarda é o corte transversal; numa escada, a vista do pé. Devolve { svg, largura } ou null.
 */
export function vistaTopoSVG(res, opts = {}) {
  if (!res || !res.pecas || !res.pecas.length || (res.cotas || []).some(c => c.tipo === 'l')) return null;
  const pecas = [], vistos = new Set(), zs = [];
  const junta = (s, ts) => { const k = s.map(v => Math.round(v)).join(',') + '|' + Math.round(ts); if (vistos.has(k)) return; vistos.add(k); pecas.push({ s, ts, t: ts }); zs.push(s[0] - ts / 2, s[2] + ts / 2, s[0] + ts / 2, s[2] - ts / 2); };
  for (const p of res.pecas) {
    if (p.sl) { junta(p.sl, p.tl ?? p.t); continue; }
    const dx = Math.abs(p.b[0] - p.a[0]), dy = Math.abs(p.b[1] - p.a[1]), dz = Math.abs(p.b[2] - p.a[2]);
    const y0 = Math.min(p.a[1], p.b[1]), y1 = Math.max(p.a[1], p.b[1]);
    if (dz >= dx && dz >= dy) junta([p.a[2], p.a[1], p.b[2], p.b[1]], p.t);                          // atravessada: vê-se ao comprido
    else if (dy >= dx) junta([p.a[2], y0, p.a[2], y1], p.p);                                          // a prumo
    else junta([p.a[2], y0 - p.t / 2, p.a[2], y1 + p.t / 2], p.p);                                    // ao comprido: vê-se de topo
  }
  const paineis = [];
  for (const p of res.paineis || []) {
    if (p.sem2d || p.v) continue;
    const aoLargo = Math.abs(p.u[2]) > 0.5, w = p.vis ? p.vis[0] : p.w, h = p.vis ? p.vis[1] : p.h, e = Math.max(p.e3 || p.esp, 4);
    const s = aoLargo ? [p.o[2], p.o[1], p.o[2] + w, p.o[1] + h] : [p.o[2] - e / 2, p.o[1], p.o[2] + e / 2, p.o[1] + h];
    const k = 'p' + s.map(v => Math.round(v)).join(','); if (vistos.has(k)) continue; vistos.add(k);
    paineis.push({ grupo: p.grupo, s, dy: 0, frente: !!p.frente }); zs.push(s[0], s[2]);
  }
  const z0 = Math.min(...zs), z1 = Math.max(...zs), cotas = [];
  if (res.altura > 0) cotas.push({ tipo: 'v', y1: 0, y2: res.altura, texto: String(Math.round(res.altura)) });
  if (z1 - z0 > 150) cotas.push({ tipo: 'h', nivel: 1, s1: z0, s2: z1, texto: String(Math.round(z1 - z0)) });
  const pontos = (res.pontos || []).filter(p => p.p).map(p => ({ ...p, s: [p.p[2], p.p[1]] }));
  return { svg: alcadoSVG({ ...res, pecas, paineis, cotas, pontos }, { fino: opts.fino }), largura: z1 - z0 };
}
