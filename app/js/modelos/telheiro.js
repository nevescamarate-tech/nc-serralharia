// Telheiro / pérgula de uma água: pilares, vigas no sentido da pendente, madres (ou ripas) e cobertura.
// x = ao comprido, z = largura (0 = frente, lado baixo), y = altura.
import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, arred, vazio, peca, sacoAcessorios } from './util.js';

export const DEF_TELHEIRO = {
  comp: '', largura: '', altura: 2500, pendente: 5, aguas: 'uma', apoio: 'pilares', cobertura: 'sandwich',
  pPilar: 'tq80x3', pViga: 'tret100x50x3', pMadre: 'tret60x40x2', vaoMax: 3500, maxMadres: 1000, beiral: 200,
};
const perfilOu = (id, def) => (PERFIS[id] ? id : def);
const VARA = 6000, PAINEL = 1000;
export const COBERTURAS = { sandwich: { esp: 30 }, trapezoidal: { esp: 0.7 } };

export function calcTelheiro(medidas = {}) {
  const m = { ...DEF_TELHEIRO, ...medidas };
  const L = num(m.comp, 0), W = num(m.largura, 0), H = num(m.altura, DEF_TELHEIRO.altura);
  if (!L) return vazio(['Introduza o comprimento do telheiro.']);
  if (!W) return vazio(['Introduza a largura (profundidade) do telheiro.']);
  if (L > 60000 || W > 12000 || H > 8000) return vazio([`Telheiro de ${L}×${W} mm com ${H} mm de altura é demasiado grande; confirme as medidas (em mm).`]);
  if (L < 600 || W < 600 || H < 1000) return vazio([`Medidas demasiado pequenas para um telheiro (${L}×${W} mm, altura ${H} mm).`]);
  const pend = Math.min(40, Math.max(0, numLivre(m.pendente))), tan = pend / 100, cos = 1 / Math.sqrt(1 + tan * tan), graus = arred(Math.atan(tan) * 180 / Math.PI);
  const pPil = perfilOu(m.pPilar, DEF_TELHEIRO.pPilar), pVig = perfilOu(m.pViga, DEF_TELHEIRO.pViga), pMad = perfilOu(m.pMadre, DEF_TELHEIRO.pMadre);
  const aP = dims(pPil).a, dV = dims(pVig), dM = dims(pMad), hV = dV.a, bV = dV.b, hM = dM.a, bM = dM.b;
  const vaoMax = Math.min(6000, Math.max(1000, num(m.vaoMax, DEF_TELHEIRO.vaoMax)));
  const maxMad = Math.max(50, num(m.maxMadres, DEF_TELHEIRO.maxMadres)), beiral = Math.min(1500, Math.max(0, numLivre(m.beiral)));
  const duas = m.aguas === 'duas', parede = m.apoio === 'parede' && !duas, ripado = m.cobertura === 'ripado', cob = COBERTURAS[m.cobertura] ? m.cobertura : null;
  const comMadres = ripado || !!cob;

  const r = vazio(['Estrutura por dimensionar: as secções, as fundações e as ligações têm de ser verificadas por técnico habilitado (vento, neve e peso da cobertura).']);
  const ac = sacoAcessorios();
  // h = dimensão da secção na vertical, w = na horizontal. Gera a peça com as duas projeções (frontal x-y e lateral z-y).
  const junta = (grupo, perfil, a, b, h, w, o = {}) => {
    const p = peca(grupo, perfil, a, b, [0, 0, 0, 0], { ...o, t: h, p: w });
    const aoComprido = Math.abs(b[0] - a[0]) > 1, aoLargo = Math.abs(b[2] - a[2]) > 1, y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (aoComprido) { p.s = [a[0], a[1], b[0], b[1]]; p.ts = h; p.sl = [a[2], y0 - h / 2, a[2], y1 + h / 2]; p.tl = w; }
    else if (aoLargo) { p.s = [a[0], y0 - h / 2, a[0], y1 + h / 2]; p.ts = w; p.sl = [a[2], a[1], b[2], b[1]]; p.tl = h; }
    else { p.s = [a[0], a[1], b[0], b[1]]; p.ts = w; p.sl = [a[2], a[1], b[2], b[1]]; p.tl = w; p.t = w; }
    r.pecas.push(p); return p;
  };
  // face inferior da viga: uma água sobe da frente para trás; duas águas sobem das duas margens até à cumeeira, a meio
  const yInf = z => H + (duas ? W / 2 - Math.abs(z - W / 2) : z) * tan;
  const yEixo = z => yInf(z) + hV / (2 * cos);         // eixo da viga
  const yMadre = z => yInf(z) + hV / cos + hM / 2;     // eixo da madre, pousada na viga

  // Eixos dos pórticos ao comprido
  const nx = reparte(L - aP, vaoMax), xs = Array.from({ length: nx + 1 }, (_, k) => aP / 2 + k * (L - aP) / nx);
  const zF = aP / 2, zT = W - aP / 2, z0 = -beiral, z1 = parede ? W - bV : W + beiral;

  // Pilares (topo cortado à pendente) e vigas
  const pilar = (x, z) => {
    junta('pilar', pPil, [x, 0, z], [x, yInf(z), z], aP, aP, { L: yInf(z) + aP / 2 * tan, ang: [0, graus] });
    r.pontos.push({ tipo: 'sapata', p: [x, 0, z], s: [x, 0], sl: [z, 0], lado: Math.ceil((aP + 120) / 10) * 10 });
    ac.junta('placa_base'); ac.junta('perno', 4); r.ligacoes += 2;
  };
  for (const x of xs) {
    pilar(x, zF); if (!parede) pilar(x, zT);
    if (duas) {
      // duas vigas por pórtico, a encontrar-se na cumeeira, e uma linha entre os pilares a segurar o impulso
      junta('viga', pVig, [x, yEixo(z0), z0], [x, yEixo(W / 2), W / 2], hV, bV, { L: (W / 2 - z0) / cos + hV / 2 * tan, ang: [0, graus] });
      junta('viga', pVig, [x, yEixo(W / 2), W / 2], [x, yEixo(z1), z1], hV, bV, { L: (z1 - W / 2) / cos + hV / 2 * tan, ang: [graus, 0] });
      junta('linha', pVig, [x, yInf(zF) - hV / 2, zF + aP / 2], [x, yInf(zF) - hV / 2, zT - aP / 2], hV, bV);
      ac.junta('tampa', 2); r.ligacoes += 4;
    } else {
      junta('viga', pVig, [x, yEixo(z0), z0], [x, yEixo(z1), z1], hV, bV, { L: (z1 - z0) / cos });
      ac.junta('tampa', parede ? 1 : 2); if (parede) r.ligacoes += 1;
    }
  }
  if (parede) {
    const zp = W - bV / 2;
    junta('vigap', pVig, [0, yEixo(zp), zp], [L, yEixo(zp), zp], hV, bV);
    ac.junta('bucha_quimica', Math.ceil(L / 600) + 1); ac.junta('tampa', 2);
  }

  // Madres ou ripas: ao comprido, emendadas sobre as vigas para caberem na vara
  const xa = -beiral, xb = L + beiral;
  if (comMadres) {
    // posições das madres ao longo da largura: numa água, de ponta a ponta; em duas, espelhadas em relação à cumeeira
    const meio = duas ? W / 2 - z0 : z1 - z0, n = reparte(meio - bM, maxMad);
    const lado = Array.from({ length: n + 1 }, (_, k) => z0 + bM / 2 + k * (meio - bM) / n);
    const zsMad = duas ? [...lado, ...lado.map(z => W - z).reverse()] : lado;
    const cortes = [xa];
    while (xb - cortes[cortes.length - 1] > VARA) {
      const ini = cortes[cortes.length - 1], cand = xs.filter(x => x > ini + 1 && x - ini <= VARA);
      if (!cand.length) break;                          // vão maior do que a vara: fica inteira e a lista de corte avisa
      cortes.push(cand[cand.length - 1]);
    }
    cortes.push(xb);
    for (const z of zsMad) {
      const y = yMadre(z);
      for (let i = 0; i < cortes.length - 1; i++) junta(ripado ? 'ripa' : 'madre', pMad, [cortes[i], y, z], [cortes[i + 1], y, z], hM, bM);
      r.ligacoes += xs.length;
    }
  }
  // Cobertura em painéis de 1 m de largura útil, inteiros no sentido da pendente (um pano por água)
  if (cob) {
    const esp = COBERTURAS[cob].esp, total = xb - xa, n = Math.ceil(total / PAINEL - 1e-9);
    const yTopo = z => yInf(z) + hV / cos + hM;
    const panos = duas ? [[z0, W / 2, 1], [W / 2, z1, -1]] : [[z0, z1, 1]];
    for (const [za, zb, sobe] of panos) {
      const S = arred((zb - za) / cos), ya = yTopo(za), yb = yTopo(zb);
      for (let k = 0; k < n; k++) {
        const x = xa + k * PAINEL, w = arred(Math.min(PAINEL, xb - x));
        r.paineis.push({ grupo: cob, esp, w, h: S, o: [x, ya, za], u: [1, 0, 0], v: [0, sobe * tan * cos, cos], plano: true, dy: 0,
          s: [x, Math.min(ya, yb), x + w, Math.max(ya, yb, Math.min(ya, yb) + Math.max(esp, 20))] });
      }
      ac.junta('parafuso_cob', Math.ceil(total * S / 1e6 * 6));
    }
    if (duas) ac.junta('cumeeira', arred(total / 1000, 2));
  }

  for (let k = 0; k < nx; k++) r.cotas.push({ tipo: 'h', nivel: 1, s1: xs[k], s2: xs[k + 1], texto: String(Math.round(xs[k + 1] - xs[k])) });
  r.cotas.push({ tipo: 'h', nivel: 2, s1: 0, s2: L, texto: String(Math.round(L)) });
  r.cotas.push({ tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.cotasLateral = [{ tipo: 'h', nivel: 1, s1: 0, s2: W, texto: String(Math.round(W)) }, { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) }];
  r.trocosPlanta.push({ a: [0, 0], b: [L, 0], texto: String(Math.round(L)) }, { a: [0, W], b: [0, 0], texto: String(Math.round(W)) });
  r.acessorios = ac.lista();
  if (duas && m.apoio === 'parede') r.avisos.push('Com duas águas o telheiro fica sobre duas filas de pilares; o apoio na parede não se aplica.');
  r.altura = H; r.alturaAlta = arred(H + (duas ? W / 2 : W) * tan); r.aguas = duas ? 2 : 1; r.pendente = pend; r.comprimentoTotal = L; r.largura = W; r.telheiro = true;
  return r;
}
