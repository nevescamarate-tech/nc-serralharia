import { dims, PERFIS } from '../catalogo.js';
import { num, reparte, arred, vazio, peca, sacoAcessorios, repartirVaroes } from './util.js';

export const DEF_PORTAO = {
  largura: '', altura: 1800, tipo: 'batente2', enchimento: 'varoes',
  pAro: 'tq50x2', pTravessa: 'tq40x2', pVarao: 'vq12', pLamina: 'tret80x20x2',
  vaoMax: 110, folgaLado: 15, folgaChao: 50, sobreposicao: 200,
  pilares: false, pPilar: 'tq100x3', motor: false,
};
const perfilOu = (id, def) => (PERFIS[id] ? id : def);
const CHUMBAR = 600, MAX_MONTANTES = 1500, FOLGA_LAMINA = 20;

export function calcPortao(medidas = {}) {
  const m = { ...DEF_PORTAO, ...medidas };
  const largura = num(m.largura, 0);
  if (!largura) return vazio(['Introduza a largura do vão do portão.']);
  const altura = num(m.altura, DEF_PORTAO.altura);
  if (largura > 20000 || altura > 6000) return vazio([`Vão de ${largura}×${altura} mm demasiado grande; confirme as medidas (em mm).`]);
  if (largura < 300) return vazio([`Vão de ${largura} mm demasiado pequeno para um portão.`]);
  const g = num(m.folgaLado, DEF_PORTAO.folgaLado), chao = num(m.folgaChao, DEF_PORTAO.folgaChao);
  const sobre = num(m.sobreposicao, DEF_PORTAO.sobreposicao), vaoMax = Math.max(20, num(m.vaoMax, DEF_PORTAO.vaoMax));
  const pAro = perfilOu(m.pAro, DEF_PORTAO.pAro), pTrav = perfilOu(m.pTravessa, DEF_PORTAO.pTravessa);
  const pVar = perfilOu(m.pVarao, DEF_PORTAO.pVarao), pLam = perfilOu(m.pLamina, DEF_PORTAO.pLamina), pPil = perfilOu(m.pPilar, DEF_PORTAO.pPilar);
  const a = dims(pAro).a, aT = dims(pTrav).a, dV = dims(pVar).a, dL = dims(pLam), aPil = dims(pPil).a;
  const correr = m.tipo === 'correr', nFolhas = correr ? 1 : (m.tipo === 'batente1' ? 1 : 2);
  const w = correr ? largura + sobre : (largura - 2 * g - (nFolhas - 1) * g) / nFolhas;
  const h = altura - chao;
  if (w < 4 * a || h < 4 * a) return vazio([`Vão de ${largura}×${altura} mm demasiado pequeno para um portão com aro de ${a} mm.`]);

  const r = vazio(), ac = sacoAcessorios();
  const P = (x, y, z = 0) => [x, y, z];
  const lin = (grupo, perfil, x1, y1, x2, y2, o) => r.pecas.push(peca(grupo, perfil, P(x1, y1), P(x2, y2), [x1, y1, x2, y2], o));

  for (let i = 0; i < nFolhas; i++) {
    const x0 = correr ? -sobre : g + i * (w + g), y0 = chao, x1 = x0 + w, y1 = y0 + h;
    const esq = { ang: [45, 45] };
    lin('aro', pAro, x0, y0 + a / 2, x1, y0 + a / 2, esq);
    lin('aro', pAro, x0, y1 - a / 2, x1, y1 - a / 2, esq);
    lin('aro', pAro, x0 + a / 2, y0, x0 + a / 2, y1, esq);
    lin('aro', pAro, x1 - a / 2, y0, x1 - a / 2, y1, esq);
    r.ligacoes += 4;

    // Montantes intermédios dividem a folha em colunas.
    const nCol = reparte(w - a, MAX_MONTANTES), passo = (w - a) / nCol;
    const xs = [x0 + a];
    for (let c = 1; c < nCol; c++) {
      const xm = x0 + a / 2 + c * passo;
      lin('travessa', pTrav, xm, y0 + a, xm, y1 - a);
      r.ligacoes += 2;
      xs.push(xm - aT / 2, xm + aT / 2);
    }
    xs.push(x1 - a);
    // Travessa intermédia horizontal só com varões e folhas altas.
    const comMeio = m.enchimento === 'varoes' && altura > 1500;
    const ym = y0 + h / 2;
    const linhasY = comMeio ? [[y0 + a, ym - aT / 2], [ym + aT / 2, y1 - a]] : [[y0 + a, y1 - a]];

    for (let c = 0; c < xs.length; c += 2) {
      const ca = xs[c], cb = xs[c + 1], livre = cb - ca;
      if (livre <= 0) continue;
      if (comMeio) { lin('travessa', pTrav, ca, ym, cb, ym); r.ligacoes += 2; }
      if (m.enchimento === 'varoes') {
        const { n, folga } = repartirVaroes(livre, dV, vaoMax);
        r.vaos.push({ livre: arred(livre), n, folga: arred(folga) });
        for (const [ya, yb] of linhasY) for (let j = 0; j < n; j++) {
          const x = ca + folga * (j + 1) + dV * (j + 0.5);
          lin('varao', pVar, x, ya, x, yb); r.ligacoes += 2;
        }
      } else if (m.enchimento === 'chapa') {
        const [ya, yb] = linhasY[0];
        r.paineis.push({ grupo: 'chapa', esp: 2, w: arred(livre), h: arred(yb - ya), o: P(ca, ya), u: [1, 0, 0], dy: 0, s: [ca, ya, cb, yb] });
        r.ligacoes += 4;
      } else if (m.enchimento === 'laminas') {
        const [ya, yb] = linhasY[0], H = yb - ya;
        const n = Math.max(1, Math.floor((H + FOLGA_LAMINA) / (dL.a + FOLGA_LAMINA)));
        const folga = (H - n * dL.a) / (n + 1);
        for (let j = 0; j < n; j++) {
          const y = ya + folga * (j + 1) + dL.a * (j + 0.5);
          lin('lamina', pLam, ca, y, cb, y, { t: dL.a, p: dL.b }); r.ligacoes += 2;
        }
      }
    }
    r.cotas.push({ tipo: 'h', nivel: 1, s1: x0, s2: x1, texto: String(arred(w)).replace('.', ',') });
  }

  if (correr) {
    ac.junta('roda', 2); ac.junta('carril', (2 * largura + sobre) / 1000); ac.junta('guia_sup', 1); ac.junta('batente_fim', 2);
    if (m.motor) { ac.junta('cremalheira', w / 1000); ac.junta('motor_prep', 1); } else ac.junta('fechadura', 1);
    r.carril = { x1: -largura - sobre, x2: largura };
  } else {
    ac.junta('dobradica', (altura > 2000 ? 3 : 2) * nFolhas); ac.junta('fechadura', 1); ac.junta('batente_chao', nFolhas);
    if (m.motor) ac.junta('motor_prep', nFolhas);
  }
  if (m.pilares) {
    const z = correr ? aPil / 2 + a / 2 + 20 : 0;
    const xs = correr ? [-aPil / 2 - 20, largura + aPil / 2] : [-aPil / 2, largura + aPil / 2];
    xs.forEach((x, k) => r.pecas.push(peca('pilar', pPil, P(x, -CHUMBAR, k === 0 ? z : 0), P(x, altura, k === 0 ? z : 0), [x, -CHUMBAR, x, altura])));
    r.ligacoes += 2;
  }
  r.cotas.push({ tipo: 'h', nivel: 2, s1: 0, s2: largura, texto: String(Math.round(largura)) });
  r.cotas.push({ tipo: 'v', y1: 0, y2: altura, texto: String(Math.round(altura)) });
  r.trocosPlanta.push({ a: [0, 0], b: [largura, 0], texto: String(Math.round(largura)) });
  r.acessorios = ac.lista();
  r.altura = altura; r.comprimentoTotal = largura;
  return r;
}
