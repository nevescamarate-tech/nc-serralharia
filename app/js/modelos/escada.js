// Escada reta de um lanço: dois banzos laterais ou uma viga central, degraus em chapa lacrimada quinada
// ou em gradil, patamar de chegada (direito ou em L) e guardas de barras verticais.
// x = avanço (0 = arranque em baixo), y = altura, z = largura (+z fica à direita de quem sobe).
import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, arred, vazio, peca, sacoAcessorios } from './util.js';

export const DEF_ESCADA = { desnivel: '', largura: 900, cobertor: 280, espelhoMax: 180, pBanzo: 'tret150x50x3', estrutura: 'banzos',
  degrau: 'lacrimada', patamar: 0, patamarLargura: 0, patamarLado: 'dir', guarda: 'nenhuma', guardaAltura: 1100, guardaPasso: 100, pGuarda: 'barra50x8', pPilar: 'tq80x3' };
const ABA = 30, ESP_DEGRAU = 4, ESP_GRADIL = 30, MAX_SEM_PATAMAR = 18, MAX_TRAVESSA = 800, P_SUPORTE = 'tret60x40x2';

export function calcEscada(medidas = {}) {
  const m = { ...DEF_ESCADA, ...medidas };
  const H = num(m.desnivel, 0), W = num(m.largura, DEF_ESCADA.largura);
  if (!H) return vazio(['Introduza o desnível total da escada (de piso a piso).']);
  if (H > 8000 || W > 3000) return vazio([`Escada com ${H} mm de desnível e ${W} mm de largura é demasiado grande; confirme as medidas (em mm).`]);
  if (H < 300 || W < 400) return vazio([`Medidas demasiado pequenas para uma escada (desnível ${H} mm, largura ${W} mm).`]);
  const c = Math.min(400, Math.max(180, num(m.cobertor, DEF_ESCADA.cobertor)));
  const eMax = Math.min(220, Math.max(120, num(m.espelhoMax, DEF_ESCADA.espelhoMax)));
  const n = Math.max(2, Math.ceil(H / eMax - 1e-9)), e = H / n, avanco = (n - 1) * c;
  const pB = PERFIS[m.pBanzo] ? m.pBanzo : DEF_ESCADA.pBanzo, dB = dims(pB), hB = dB.a, bB = dB.b;
  const teta = Math.atan(e / c), cos = Math.cos(teta), graus = arred(teta * 180 / Math.PI), rad = Math.PI / 180;
  const gradil = m.degrau === 'gradil', patPedido = numLivre(m.patamar), pat = patPedido < 300 ? 0 : Math.min(6000, patPedido);
  const lados = m.guarda === 'dois' ? 2 : m.guarda === 'um' ? 1 : 0, central = m.estrutura === 'central';
  const espD = gradil ? ESP_GRADIL : ABA;
  // Patamar: da largura da escada ou mais largo para um dos lados (em L)
  const PW = pat ? Math.min(8000, Math.max(W, numLivre(m.patamarLargura))) : W, emL = PW > W + 1;
  const zA = m.patamarLado === 'esq' ? W - PW : 0, zB = zA + PW;

  const r = vazio(['Estrutura por dimensionar: os banzos, os degraus e as fixações têm de ser verificados por técnico habilitado.']);
  const passo = 2 * e + c;
  if (passo < 600 || passo > 660) r.avisos.push(`Regra de conforto: 2 × espelho + cobertor = ${Math.round(passo)} mm (o habitual é 600 a 650). Ajuste o cobertor.`);
  if (n > MAX_SEM_PATAMAR) r.avisos.push(`${n} espelhos num só lanço: prever patamar intermédio.`);
  const ac = sacoAcessorios();
  const corteBanzo = { ang: [arred(90 - graus), graus], t: hB, p: bB };
  const pontaLonga = L => L + hB / 2 * (Math.tan((90 - graus) * rad) + Math.tan(graus * rad));
  // peça ao longo de z (atravessada): no alçado lateral vê-se de topo
  const atravessada = (grupo, perfil, x, y, z1, z2, h, w) => { const p = peca(grupo, perfil, [x, y, z1], [x, y, z2], [x, y - h / 2, x, y + h / 2], { t: h, p: w }); p.ts = w; r.pecas.push(p); return p; };

  const yEixo = x => e / 2 + x * e / c, zs = [-bB / 2, W + bB / 2];
  if (central) {
    // Viga central por baixo dos degraus, com um suporte atravessado por degrau
    const desce = e / 2 + hB / (2 * cos) + espD + 60, yC = x => yEixo(x) - desce, x0 = Math.max(0, (hB / 2 + desce - e / 2) * c / e);
    if (avanco - x0 > 300) {
      r.pecas.push(peca('banzo', pB, [x0, yC(x0), W / 2], [avanco, yC(avanco), W / 2], [x0, yC(x0), avanco, yC(avanco)], { ...corteBanzo, L: pontaLonga((avanco - x0) / cos) }));
      ac.junta('placa_base', 2); ac.junta('bucha_quimica', 4); r.ligacoes += 2;
    } else r.avisos.push('Escada demasiado curta para viga central: use dois banzos laterais.');
    const dS = dims(P_SUPORTE);
    for (let k = 1; k < n; k++) { atravessada('suporte', P_SUPORTE, (k - 0.5) * c, k * e - espD - dS.b / 2, 100, W - 100, dS.b, dS.a); r.ligacoes += 3; }
    r.avisos.push('Viga central: os pés que ligam cada suporte à viga são cortados à medida na montagem e não estão na lista.');
  } else for (const z of zs) {
    // Banzos: o eixo passa a meio dos espelhos; corte de nível no arranque e a prumo na chegada
    r.pecas.push(peca('banzo', pB, [0, yEixo(0), z], [avanco, yEixo(avanco), z], [0, yEixo(0), avanco, yEixo(avanco)], { ...corteBanzo, L: pontaLonga(avanco / cos) }));
    ac.junta('placa_base', 2); ac.junta('bucha_quimica', 4); r.ligacoes += 2;
  }
  // Degraus: o degrau k tem o piso à altura k × espelho
  for (let k = 1; k < n; k++) {
    const x0 = (k - 1) * c, y = k * e;
    if (gradil) r.paineis.push({ grupo: 'gradil', esp: ESP_GRADIL, w: arred(W), h: arred(c), vis: [arred(W), ESP_GRADIL], e3: c, frente: true, nota: 'degrau com orla e focinho',
      o: [x0 + c / 2, y - ESP_GRADIL, 0], u: [0, 0, 1], dy: 0, s: [x0, y - ESP_GRADIL, x0 + c, y] });
    else r.paineis.push({ grupo: 'lacrimada', esp: ESP_DEGRAU, w: arred(W), h: arred(c + 2 * ABA), vis: [arred(W), ABA], e3: c, frente: true, nota: `quinada, 2 abas de ${ABA}`,
      o: [x0 + c / 2, y - ABA, 0], u: [0, 0, 1], dy: 0, s: [x0, y - ABA, x0 + c, y] });
    r.ligacoes += 2;
  }
  // Patamar de chegada: longarinas nas duas margens, travessas, piso e dois pilares no extremo
  const x1 = avanco + pat, yL = H - hB / 2, zLong = [zA - bB / 2, zB + bB / 2];
  if (pat > 0) {
    const pP = PERFIS[m.pPilar] ? m.pPilar : DEF_ESCADA.pPilar, aP = dims(pP).a;
    for (const z of zLong) r.pecas.push(peca('longarina', pB, [avanco, yL, z], [x1, yL, z], [avanco, yL, x1, yL], { t: hB, p: bB }));
    const nT = reparte(pat - bB, MAX_TRAVESSA);
    for (let k = 0; k <= nT; k++) { atravessada('travessa', pB, avanco + bB / 2 + k * (pat - bB) / nT, yL, zA, zB, hB, bB); r.ligacoes += 2; }
    r.paineis.push({ grupo: gradil ? 'gradil' : 'piso', esp: gradil ? ESP_GRADIL : ESP_DEGRAU, w: arred(pat), h: arred(PW), o: [avanco, H - (gradil ? ESP_GRADIL : ESP_DEGRAU), zA], u: [1, 0, 0], v: [0, 0, 1], plano: true, sem2d: true, dy: 0,
      s: [avanco, H - 30, x1, H], nota: 'piso do patamar' });
    if (H - hB > 300) for (const z of zLong) {
      r.pecas.push(peca('pilar', pP, [x1 - aP / 2, 0, z], [x1 - aP / 2, H - hB, z], [x1 - aP / 2, 0, x1 - aP / 2, H - hB]));
      r.pontos.push({ tipo: 'sapata', p: [x1 - aP / 2, 0, z], s: [x1 - aP / 2, 0], lado: Math.ceil((aP + 120) / 10) * 10 });
      ac.junta('placa_base'); ac.junta('perno', 4); r.ligacoes += 2;
    }
    r.avisos.push(`Apoio do patamar: assumidos dois pilares no extremo${emL ? ' e as longarinas apoiadas nos banzos' : ''}; confirmar com o cálculo ou trocar por ligação à fachada.`);
    r.cotas.push({ tipo: 'h', nivel: 1, s1: avanco, s2: x1, texto: String(Math.round(pat)) });
  }
  // Guardas: barras verticais com travessa de topo. No lanço seguem a inclinação; no patamar fecham as margens livres.
  if (lados) {
    const pG = PERFIS[m.pGuarda] ? m.pGuarda : DEF_ESCADA.pGuarda, dG = dims(pG), hG = Math.min(1500, Math.max(600, num(m.guardaAltura, DEF_ESCADA.guardaAltura)));
    const pg = Math.min(300, Math.max(dG.b + 20, num(m.guardaPasso, DEF_ESCADA.guardaPasso)));
    const o = { t: dG.b, p: dG.a }, yNariz = x => e + x * e / c + hG, yT = H + hG, yBase = central ? x => (Math.floor(x / c) + 1) * e - espD : yEixo;
    const reparteBarras = L => { const nb = Math.max(1, Math.floor((L - pg) / pg + 1e-9) + 1); return { nb, mg: (L - (nb - 1) * pg) / 2 }; };
    for (const z of zs.slice(0, lados)) {
      r.pecas.push(peca('corrimao', pG, [0, yNariz(0), z], [avanco, yNariz(avanco), z], [0, yNariz(0), avanco, yNariz(avanco)], { ...o, L: avanco / cos, ang: [graus, graus] }));
      const { nb, mg } = reparteBarras(avanco);
      for (let j = 0; j < nb; j++) { const x = mg + j * pg;
        r.pecas.push(peca('varao', pG, [x, yBase(x), z], [x, yNariz(x), z], [x, yBase(x), x, yNariz(x)], { ...o, ang: [0, graus] })); r.ligacoes += 2; }
    }
    if (pat > 0) {
      // ao comprido (x): do lado do lanço que tem guarda e não é para onde o patamar alarga; atravessadas (z): topo do patamar e frente da parte em L
      const aoComprido = [], atraves = [];   // num patamar direito sai-se pelo topo, que fica aberto
      if (emL) { aoComprido.push(m.patamarLado === 'esq' ? zLong[1] : zLong[0]); atraves.push([x1, zA, zB], m.patamarLado === 'esq' ? [avanco, zA, 0] : [avanco, W, zB]); }
      else aoComprido.push(...zLong.slice(0, lados));
      for (const z of aoComprido) {
        r.pecas.push(peca('corrimao', pG, [avanco, yT, z], [x1, yT, z], [avanco, yT, x1, yT], o));
        const { nb, mg } = reparteBarras(pat);
        for (let j = 0; j < nb; j++) { const x = avanco + mg + j * pg; r.pecas.push(peca('varao', pG, [x, yL, z], [x, yT, z], [x, yL, x, yT], o)); r.ligacoes += 2; }
      }
      for (const [x, za, zb] of atraves) {
        atravessada('corrimao', pG, x, yT, za, zb, dG.b, dG.a);
        const { nb, mg } = reparteBarras(zb - za);
        for (let j = 0; j < nb; j++) { const z = za + mg + j * pg; r.pecas.push(peca('varao', pG, [x, yL, z], [x, yT, z], [x, yL, x, yT], { t: dG.a, p: dG.b })); r.ligacoes += 2; }
      }
    }
    r.avisos.push('Guarda da escada: confirmar se é exigido corrimão preensível (Ø40 a 50) e espelhos fechados, conforme o uso do edifício.');
  }
  const total = avanco + pat;
  r.cotas.push({ tipo: 'h', nivel: 1, s1: 0, s2: c, texto: String(Math.round(c)) }, { tipo: 'h', nivel: 2, s1: 0, s2: avanco, texto: String(Math.round(avanco)) },
    { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.trocosPlanta.push({ a: [0, 0], b: [total, 0], texto: String(Math.round(total)) });
  if (emL) r.trocosPlanta.push({ a: [x1, zA], b: [x1, zB], texto: String(Math.round(PW)) });
  r.acessorios = ac.lista();
  r.escada = { n, degraus: n - 1, espelho: e, cobertor: c, angulo: graus, largura: W, banzo: hB, gradil, patamar: pat, patamarLargura: pat ? PW : 0, emL, central, guardas: lados, avanco };
  r.altura = H; r.comprimentoTotal = arred(total); r.largura = W;
  return r;
}
