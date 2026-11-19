// Escada reta de um lanço: dois banzos inclinados, degraus em chapa lacrimada quinada ou em gradil,
// patamar de chegada opcional e guardas de barras verticais opcionais.
// x = avanço (0 = arranque em baixo), y = altura, z = largura.
import { dims, PERFIS } from '../catalogo.js';
import { num, numLivre, reparte, arred, vazio, peca, sacoAcessorios } from './util.js';

export const DEF_ESCADA = { desnivel: '', largura: 900, cobertor: 280, espelhoMax: 180, pBanzo: 'tret150x50x3',
  degrau: 'lacrimada', patamar: 0, guarda: 'nenhuma', guardaAltura: 1100, guardaPasso: 100, pGuarda: 'barra50x8', pPilar: 'tq80x3' };
const ABA = 30, ESP_DEGRAU = 4, ESP_GRADIL = 30, MAX_SEM_PATAMAR = 18, MAX_TRAVESSA = 800;

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
  const teta = Math.atan(e / c), graus = arred(teta * 180 / Math.PI), rad = Math.PI / 180;
  const gradil = m.degrau === 'gradil', patPedido = numLivre(m.patamar), pat = patPedido < 300 ? 0 : Math.min(6000, patPedido);
  const lados = m.guarda === 'dois' ? 2 : m.guarda === 'um' ? 1 : 0;

  const r = vazio(['Estrutura por dimensionar: os banzos, os degraus e as fixações têm de ser verificados por técnico habilitado.']);
  const passo = 2 * e + c;
  if (passo < 600 || passo > 660) r.avisos.push(`Regra de conforto: 2 × espelho + cobertor = ${Math.round(passo)} mm (o habitual é 600 a 650). Ajuste o cobertor.`);
  if (n > MAX_SEM_PATAMAR) r.avisos.push(`${n} espelhos num só lanço: prever patamar intermédio.`);
  const ac = sacoAcessorios();

  // Banzos: o eixo passa a meio dos espelhos; corte de nível no arranque e a prumo na chegada
  const yEixo = x => e / 2 + x * e / c, zs = [-bB / 2, W + bB / 2];
  for (const z of zs) {
    r.pecas.push(peca('banzo', pB, [0, yEixo(0), z], [avanco, yEixo(avanco), z], [0, yEixo(0), avanco, yEixo(avanco)],
      { L: avanco / Math.cos(teta) + hB / 2 * (Math.tan((90 - graus) * rad) + Math.tan(graus * rad)), ang: [arred(90 - graus), graus], t: hB, p: bB }));
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
  // Patamar de chegada, no seguimento do lanço: longarinas, travessas, piso e dois pilares no extremo
  if (pat > 0) {
    const yL = H - hB / 2, x1 = avanco + pat, pP = PERFIS[m.pPilar] ? m.pPilar : DEF_ESCADA.pPilar, aP = dims(pP).a;
    for (const z of zs) r.pecas.push(peca('longarina', pB, [avanco, yL, z], [x1, yL, z], [avanco, yL, x1, yL], { t: hB, p: bB }));
    const nT = reparte(pat - bB, MAX_TRAVESSA);
    for (let k = 0; k <= nT; k++) { const x = avanco + bB / 2 + k * (pat - bB) / nT;
      const t = peca('travessa', pB, [x, yL, 0], [x, yL, W], [x, yL - hB / 2, x, yL + hB / 2], { t: hB, p: bB }); t.ts = bB; r.pecas.push(t); r.ligacoes += 2; }
    r.paineis.push({ grupo: gradil ? 'gradil' : 'piso', esp: gradil ? ESP_GRADIL : ESP_DEGRAU, w: arred(pat), h: arred(W), o: [avanco, H - (gradil ? ESP_GRADIL : ESP_DEGRAU), 0], u: [1, 0, 0], v: [0, 0, 1], plano: true, sem2d: true, dy: 0,
      s: [avanco, H - 30, x1, H], nota: 'piso do patamar' });
    if (H - hB > 300) for (const z of zs) {
      r.pecas.push(peca('pilar', pP, [x1 - aP / 2, 0, z], [x1 - aP / 2, H - hB, z], [x1 - aP / 2, 0, x1 - aP / 2, H - hB]));
      r.pontos.push({ tipo: 'sapata', p: [x1 - aP / 2, 0, z], s: [x1 - aP / 2, 0], lado: Math.ceil((aP + 120) / 10) * 10 });
      ac.junta('placa_base'); ac.junta('perno', 4); r.ligacoes += 2;
    }
    r.avisos.push('Apoio do patamar: assumidos dois pilares no extremo; confirmar com o cálculo ou trocar por ligação à fachada.');
    r.cotas.push({ tipo: 'h', nivel: 1, s1: avanco, s2: x1, texto: String(Math.round(pat)) });
  }
  // Guardas: barras verticais fixas ao banzo, com travessa de topo paralela ao lanço
  if (lados) {
    const pG = PERFIS[m.pGuarda] ? m.pGuarda : DEF_ESCADA.pGuarda, dG = dims(pG), hG = Math.min(1500, Math.max(600, num(m.guardaAltura, DEF_ESCADA.guardaAltura)));
    const pg = Math.min(300, Math.max(dG.b + 20, num(m.guardaPasso, DEF_ESCADA.guardaPasso)));
    const o = { t: dG.b, p: dG.a }, yNariz = x => e + x * e / c + hG;   // altura medida na linha dos focinhos
    for (const z of zs.slice(0, lados)) {
      r.pecas.push(peca('corrimao', pG, [0, yNariz(0), z], [avanco, yNariz(avanco), z], [0, yNariz(0), avanco, yNariz(avanco)], { ...o, L: avanco / Math.cos(teta), ang: [graus, graus] }));
      const nb = Math.max(1, Math.floor((avanco - pg) / pg + 1e-9) + 1), mg = (avanco - (nb - 1) * pg) / 2;
      for (let j = 0; j < nb; j++) { const x = mg + j * pg;
        r.pecas.push(peca('varao', pG, [x, yEixo(x), z], [x, yNariz(x), z], [x, yEixo(x), x, yNariz(x)], { ...o, ang: [0, graus] })); r.ligacoes += 2; }
      if (pat > 0) {
        const x1 = avanco + pat, yT = H + hG;
        r.pecas.push(peca('corrimao', pG, [avanco, yT, z], [x1, yT, z], [avanco, yT, x1, yT], o));
        const np = Math.max(1, Math.floor((pat - pg) / pg + 1e-9) + 1), mp = (pat - (np - 1) * pg) / 2;
        for (let j = 0; j < np; j++) { const x = avanco + mp + j * pg;
          r.pecas.push(peca('varao', pG, [x, H - hB / 2, z], [x, yT, z], [x, H - hB / 2, x, yT], o)); r.ligacoes += 2; }
      }
    }
    r.avisos.push('Guarda da escada: confirmar se é exigido corrimão preensível (Ø40 a 50) e espelhos fechados, conforme o uso do edifício.');
  }
  const total = avanco + pat;
  r.cotas.push({ tipo: 'h', nivel: 1, s1: 0, s2: c, texto: String(Math.round(c)) }, { tipo: 'h', nivel: 2, s1: 0, s2: avanco, texto: String(Math.round(avanco)) },
    { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.trocosPlanta.push({ a: [0, 0], b: [total, 0], texto: String(Math.round(total)) });
  r.acessorios = ac.lista();
  r.escada = { n, degraus: n - 1, espelho: e, cobertor: c, angulo: graus, largura: W, banzo: hB, gradil, patamar: pat, guardas: lados };
  r.altura = H; r.comprimentoTotal = arred(total); r.largura = W;
  return r;
}
