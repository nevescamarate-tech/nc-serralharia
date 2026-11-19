// Escada reta de um lanço: dois banzos inclinados e degraus em chapa lacrimada quinada.
// x = avanço (0 = arranque em baixo), y = altura, z = largura.
import { dims, PERFIS } from '../catalogo.js';
import { num, arred, vazio, peca, sacoAcessorios } from './util.js';

export const DEF_ESCADA = { desnivel: '', largura: 900, cobertor: 280, espelhoMax: 180, pBanzo: 'tret150x50x3' };
const ABA = 30, ESP_DEGRAU = 4, MAX_SEM_PATAMAR = 18;

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

  const r = vazio(['Estrutura por dimensionar: os banzos, os degraus e as fixações têm de ser verificados por técnico habilitado.']);
  const passo = 2 * e + c;
  if (passo < 600 || passo > 660) r.avisos.push(`Regra de conforto: 2 × espelho + cobertor = ${Math.round(passo)} mm (o habitual é 600 a 650). Ajuste o cobertor.`);
  if (n > MAX_SEM_PATAMAR) r.avisos.push(`${n} espelhos num só lanço: prever patamar intermédio.`);
  const ac = sacoAcessorios();

  // Banzos: o eixo passa a meio dos espelhos; corte de nível no arranque e a prumo na chegada
  const yEixo = x => e / 2 + x * e / c;
  for (const z of [-bB / 2, W + bB / 2]) {
    r.pecas.push(peca('banzo', pB, [0, yEixo(0), z], [avanco, yEixo(avanco), z], [0, yEixo(0), avanco, yEixo(avanco)],
      { L: avanco / Math.cos(teta) + hB / 2 * (Math.tan((90 - graus) * rad) + Math.tan(graus * rad)), ang: [arred(90 - graus), graus], t: hB, p: bB }));
    ac.junta('placa_base', 2); ac.junta('bucha_quimica', 4); r.ligacoes += 2;
  }
  // Degraus: o degrau k tem o piso à altura k × espelho
  for (let k = 1; k < n; k++) {
    const x0 = (k - 1) * c, y = k * e;
    r.paineis.push({ grupo: 'lacrimada', esp: ESP_DEGRAU, w: arred(W), h: arred(c + 2 * ABA), vis: [arred(W), ABA], e3: c, frente: true, nota: `quinada, 2 abas de ${ABA}`,
      o: [x0 + c / 2, y - ABA, 0], u: [0, 0, 1], dy: 0, s: [x0, y - ABA, x0 + c, y] });
    r.ligacoes += 2;
  }
  r.cotas.push({ tipo: 'h', nivel: 1, s1: 0, s2: c, texto: String(Math.round(c)) }, { tipo: 'h', nivel: 2, s1: 0, s2: avanco, texto: String(Math.round(avanco)) },
    { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.trocosPlanta.push({ a: [0, 0], b: [avanco, 0], texto: String(Math.round(avanco)) });
  r.acessorios = ac.lista();
  r.escada = { n, degraus: n - 1, espelho: e, cobertor: c, angulo: graus, largura: W, banzo: hB };
  r.altura = H; r.comprimentoTotal = arred(avanco); r.largura = W;
  return r;
}
