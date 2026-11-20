import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, hip, arred, vazio, peca, sacoAcessorios, repartirVaroes, ripa, afast, deitado } from './util.js';

export const DEF_GUARDA = {
  trocos: [{ comp: '', desnivel: 0, viragem: 0 }],
  altura: 1100, fixacao: 'topo', enchimento: 'varoes',
  pPrumo: 'tq40x2', pCorrimao: 'tr42x2', pTravessa: 'tret40x20x2', pVarao: 'varao12',
  maxPrumos: 1200, vaoMax: 110, baixo: 100, nBarras: 5,
};
const perfilOu = (id, def) => (PERFIS[id] ? id : def);
const FOLGA_CORRIMAO = 50;   // distância entre o corrimão e a travessa superior
const FOLGA_VIDRO = 20;

export function calcGuarda(medidas = {}) {
  const m = { ...DEF_GUARDA, ...medidas };
  const altura = num(m.altura, DEF_GUARDA.altura);
  const maxPrumos = Math.max(200, num(m.maxPrumos, DEF_GUARDA.maxPrumos));
  const vaoMax = afast(m.vaoMax, DEF_GUARDA.vaoMax), vaoBarras = num(m.vaoBarras, 0) ? afast(m.vaoBarras, 0) : 0;
  const baixo = num(m.baixo, DEF_GUARDA.baixo);
  const nBarras = Math.min(30, Math.max(1, Math.round(num(m.nBarras, DEF_GUARDA.nBarras))));
  const pPrumo = perfilOu(m.pPrumo, DEF_GUARDA.pPrumo), pCorr = perfilOu(m.pCorrimao, DEF_GUARDA.pCorrimao);
  const pTrav = perfilOu(m.pTravessa, DEF_GUARDA.pTravessa), pVar = perfilOu(m.pVarao, DEF_GUARDA.pVarao);
  const aP = dims(pPrumo).a, fC = deitado(pCorr), hc = fC.t, fV = ripa(pVar, m.posicao), dV = fV.t;
  const dT = dims(pTrav), tT = dT.b, profT = dT.a;   // travessa deitada: vê-se a face menor
  const avisos = [];

  const brutos = Array.isArray(m.trocos) ? m.trocos : [];
  const trocos = [];
  brutos.forEach((t, i) => {
    const comp = num(t && t.comp, 0);
    if (!comp) { if (brutos.length > 1 || (t && t.comp !== '' && t.comp != null)) avisos.push(`Troço ${i + 1}: comprimento em falta ou inválido.`); return; }
    if (comp > 100000) { avisos.push(`Troço ${i + 1}: ${comp} mm é demasiado comprido; confirme a medida (em mm).`); return; }
    if (comp < 4 * aP) { avisos.push(`Troço ${i + 1}: ${comp} mm é demasiado curto para uma guarda.`); return; }
    trocos.push({ comp, desnivel: numLivre(t.desnivel), viragem: numLivre(t.viragem) });
  });
  if (!trocos.length) return vazio(avisos.length ? avisos : ['Introduza o comprimento da guarda.']);
  if (altura > 3000) return vazio([`Altura de ${altura} mm demasiado alta para uma guarda; confirme a medida (em mm).`]);
  if (altura < baixo + hc + FOLGA_CORRIMAO + 2 * tT + 50) return vazio([`Altura de ${altura} mm demasiado baixa para este enchimento.`]);

  const r = vazio(avisos);
  const ac = sacoAcessorios();
  const lateral = m.fixacao === 'lateral', extra = lateral ? 120 : 0;
  let rumo = 0, P = [0, 0, 0], s0 = 0;

  trocos.forEach((t, i) => {
    if (i > 0) rumo += t.viragem;
    const rad = rumo * Math.PI / 180, dir = [Math.cos(rad), 0, Math.sin(rad)];
    const inclin = Math.atan2(t.desnivel, t.comp), f = 1 / Math.cos(inclin), angInc = arred(Math.abs(inclin) * 180 / Math.PI);
    const y0 = P[1];
    const pt = (u, dy = 0) => [P[0] + dir[0] * u, y0 + t.desnivel * u / t.comp + dy, P[2] + dir[2] * u];
    const sy = (u, dy = 0) => [s0 + u, y0 + t.desnivel * u / t.comp + dy];
    const primeiro = i === 0, ultimo = i === trocos.length - 1;

    // Corrimão: de vértice a vértice, meia-esquadria nos cantos.
    // Ângulo da junta entre o troço k-1 e o k: viragem em planta ou mudança de inclinação.
    const graus = k => Math.atan2(trocos[k].desnivel, trocos[k].comp) * 180 / Math.PI;
    const junta = k => {
      const planta = Math.abs(trocos[k].viragem) / 2, vert = Math.abs(graus(k) - graus(k - 1)) / 2;
      if (planta > 0.05 && vert > 0.05 && k === i) avisos.push(`Canto ${k}: tem viragem e mudança de inclinação; o ângulo composto do corrimão deve ser confirmado em obra.`);
      return arred(Math.min(80, planta > 0.05 ? planta : vert));
    };
    const angA = primeiro ? 0 : junta(i), angB = ultimo ? 0 : junta(i + 1);
    const yc = altura - hc / 2, rad1 = Math.PI / 180;
    // Comprimento pela ponta mais comprida: o eixo mais meia secção por cada topo em meia-esquadria.
    r.pecas.push(peca('corrimao', pCorr, pt(0, yc), pt(t.comp, yc), [...sy(0, yc), ...sy(t.comp, yc)],
      { L: hip(t.comp, t.desnivel) + hc / 2 * (Math.tan(angA * rad1) + Math.tan(angB * rad1)), ang: [angA, angB], ...fC }));

    // Prumos: nas pontas livres recuam meia secção; nos cantos ficam no vértice (partilhados).
    const u0 = primeiro ? aP / 2 : 0, u1 = ultimo ? t.comp - aP / 2 : t.comp;
    const n = reparte(u1 - u0, maxPrumos), passo = (u1 - u0) / n;
    const nos = Array.from({ length: n + 1 }, (_, k) => u0 + k * passo);
    nos.forEach((u, k) => {
      if (k === 0 && !primeiro) return;
      r.pecas.push(peca('prumo', pPrumo, pt(u, -extra), pt(u, altura - hc), [...sy(u, -extra), ...sy(u, altura - hc)]));
      r.pontos.push({ tipo: lateral ? 'fix_lateral' : 'sapata', p: pt(u, 0), s: sy(u, 0) });
      ac.junta(lateral ? 'fix_lateral' : 'sapata'); ac.junta('bucha', lateral ? 2 : 4);
      r.ligacoes += 2;
    });
    for (let k = 0; k < n; k++) r.cotas.push({ tipo: 'h', nivel: 1, s1: s0 + nos[k], s2: s0 + nos[k + 1], texto: String(Math.round(passo)) });

    // Enchimento de cada vão entre prumos.
    for (let k = 0; k < n; k++) {
      const ua = nos[k] + aP / 2, ub = nos[k + 1] - aP / 2, livre = ub - ua;
      if (livre <= 0) continue;
      const yTopo = altura - hc - FOLGA_CORRIMAO;
      const travessa = (dy) => {
        r.pecas.push(peca('travessa', pTrav, pt(ua, dy), pt(ub, dy), [...sy(ua, dy), ...sy(ub, dy)],
          { L: livre * f, ang: [angInc, angInc], t: tT, p: profT }));
        r.ligacoes += 2;
      };
      if (m.enchimento === 'varoes') {
        travessa(yTopo - tT / 2); travessa(baixo + tT / 2);
        const { n: nv, folga } = repartirVaroes(livre, dV, vaoMax);
        const yb = baixo + tT, yt = yTopo - tT;
        for (let j = 0; j < nv; j++) {
          const u = ua + folga * (j + 1) + dV * (j + 0.5);
          r.pecas.push(peca('varao', pVar, pt(u, yb), pt(u, yt), [...sy(u, yb), ...sy(u, yt)], { L: yt - yb, ang: [angInc, angInc], ...fV }));
          r.ligacoes += 2;
        }
        r.vaos.push({ livre: arred(livre), n: nv, folga: arred(folga) });
      } else if (m.enchimento === 'chapa') {
        travessa(yTopo - tT / 2); travessa(baixo + tT / 2);
        const yb = baixo + tT, h = yTopo - tT - yb;
        r.paineis.push({ grupo: 'chapa', esp: 2, w: arred(livre), h: arred(h), o: pt(ua, yb), u: dir, dy: t.desnivel * livre / t.comp,
          s: [...sy(ua, yb), s0 + ub, sy(ua, yb)[1] + h] });
        r.ligacoes += 4;
      } else if (m.enchimento === 'vidro') {
        const va = ua + FOLGA_VIDRO, vb = ub - FOLGA_VIDRO, h = yTopo - baixo;
        if (vb - va > 0) {
          r.paineis.push({ grupo: 'vidro', esp: 10, w: arred(vb - va), h: arred(h), o: pt(va, baixo), u: dir, dy: t.desnivel * (vb - va) / t.comp,
            s: [...sy(va, baixo), s0 + vb, sy(va, baixo)[1] + h] });
          ac.junta('pinca_vidro', 4);
        }
      } else if (m.enchimento === 'barras') {
        // com afastamento pedido: folgas iguais entre barras e da última ao corrimão; senão, pelo número de barras
        const zona = altura - hc - baixo, nb = vaoBarras ? Math.min(80, Math.max(1, Math.ceil(zona / (dV + vaoBarras) - 1e-9))) : nBarras;
        const passoY = zona / nb;
        for (let j = 0; j < nb; j++) {
          const dy = baixo + passoY * j + (vaoBarras ? dV / 2 : 0);
          r.pecas.push(peca('barra', pVar, pt(ua, dy), pt(ub, dy), [...sy(ua, dy), ...sy(ub, dy)], { L: livre * f, ang: [angInc, angInc], ...fV }));
          r.ligacoes += 2;
        }
        if (vaoBarras) r.vaos.push({ livre: arred(zona), n: nb, folga: arred(passoY - dV), horizontal: true });
      }
    }

    const fim = pt(t.comp);
    r.cotas.push({ tipo: 'h', nivel: 2, s1: s0, s2: s0 + t.comp, texto: String(Math.round(t.comp)) });
    r.trocosPlanta.push({ a: [P[0], P[2]], b: [fim[0], fim[2]], texto: String(Math.round(t.comp)) });
    r.comprimentoTotal += hip(t.comp, t.desnivel);
    P = fim; s0 += t.comp;
  });

  ac.junta('tampa', 2);
  r.cotas.push({ tipo: 'v', y1: 0, y2: altura, texto: String(Math.round(altura)) });
  r.acessorios = ac.lista();
  r.altura = altura;
  r.comprimentoTotal = arred(r.comprimentoTotal);
  return r;
}
