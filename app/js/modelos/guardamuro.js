// Guarda de barras sobre muro, sem prumos: barras verticais soldadas ao corrimão e a uma barra chata
// assente no fundo de um rasgo do muro, selado com grout. Em módulos que cabem dois por vara de 6 m.
import { dims, PERFIS } from '../catalogo.js';
import { num, arred, vazio, peca, sacoAcessorios } from './util.js';

export const DEF_GUARDAMURO = { comp: '', altura: 600, passo: 110, modulo: 2970, rasgo: 80, pCorrimao: 'tr50x2', pBarra: 'tr20x1.5', pChata: 'barra50x8' };
const perfilOu = (id, def) => (PERFIS[id] ? id : def);
const ENTRA = 15, CALCO = 5, LITROS_SACO = 12.5;

export function calcGuardaMuro(medidas = {}) {
  const m = { ...DEF_GUARDAMURO, ...medidas };
  const L = num(m.comp, 0), H = num(m.altura, DEF_GUARDAMURO.altura);
  if (!L) return vazio(['Introduza o comprimento da guarda.']);
  if (L > 500000 || H > 2000) return vazio([`Guarda de ${L} mm com ${H} mm acima do muro é demasiado grande; confirme as medidas (em mm).`]);
  const pC = perfilOu(m.pCorrimao, DEF_GUARDAMURO.pCorrimao), pB = perfilOu(m.pBarra, DEF_GUARDAMURO.pBarra), pF = perfilOu(m.pChata, DEF_GUARDAMURO.pChata);
  const dC = dims(pC).a, dB = dims(pB).a, dF = dims(pF), eF = dF.b, lF = dF.a;
  const passo = Math.min(400, Math.max(dB + 20, num(m.passo, DEF_GUARDAMURO.passo)));
  const rasgo = Math.min(200, Math.max(40, num(m.rasgo, DEF_GUARDAMURO.rasgo)));
  const mod = Math.min(6000, Math.max(500, num(m.modulo, DEF_GUARDAMURO.modulo)));
  if (L < passo + dB || H < dC + 100) return vazio([`Medidas demasiado pequenas para esta guarda (${L} mm, ${H} mm acima do muro).`]);

  const r = vazio(['Rasgo no coroamento do muro feito na betonagem (negativo): confirmar a largura do muro, as armaduras e as juntas de dilatação.',
    'Guarda por dimensionar: a carga de serviço e a fixação por grout têm de ser verificadas por técnico habilitado.']);
  const ac = sacoAcessorios();
  const n = Math.ceil(L / mod - 1e-9), yChata = -rasgo + CALCO + eF / 2, yPe = -rasgo + CALCO + eF, yCorr = H - dC / 2;
  let barras = 0;
  for (let k = 0; k < n; k++) {
    const x0 = k * mod, Lm = arred(Math.min(mod, L - x0));
    if (Lm < passo) { r.avisos.push(`Último módulo com ${Math.round(Lm)} mm: demasiado curto, juntar ao anterior.`); continue; }
    r.pecas.push(peca('corrimao', pC, [x0, yCorr, 0], [x0 + Lm, yCorr, 0], [x0, yCorr, x0 + Lm, yCorr]));
    r.pecas.push(peca('chata', pF, [x0, yChata, 0], [x0 + Lm, yChata, 0], [x0, yChata, x0 + Lm, yChata], { t: eF, p: lF }));
    const nb = Math.floor((Lm - passo) / passo + 1e-9) + 1, margem = (Lm - (nb - 1) * passo) / 2;
    for (let j = 0; j < nb; j++) { const x = x0 + margem + j * passo;
      r.pecas.push(peca('varao', pB, [x, yPe, 0], [x, H - dC + ENTRA, 0], [x, yPe, x, H - dC + ENTRA])); }
    barras += nb; r.ligacoes += 2 * nb;
    ac.junta('calco_inox', 3);
    r.cotas.push({ tipo: 'h', nivel: 1, s1: x0, s2: x0 + Lm, texto: String(Math.round(Lm)) });
  }
  if (n > 1) { ac.junta('casquilho', n - 1); ac.junta('rebite', 2 * (n - 1)); }
  ac.junta('tampa', 2);
  const litros = L / 1000 * rasgo * rasgo / 1000 * 1.1;
  ac.junta('grout', Math.ceil(litros / LITROS_SACO));
  r.cotas.push({ tipo: 'h', nivel: 2, s1: 0, s2: L, texto: String(Math.round(L)) }, { tipo: 'v', y1: 0, y2: H, texto: String(Math.round(H)) });
  r.trocosPlanta.push({ a: [0, 0], b: [L, 0], texto: String(Math.round(L)) });
  r.acessorios = ac.lista();
  r.guardaMuro = { modulos: n, modulo: mod, passo, barras, rasgo, entra: ENTRA, calco: CALCO, dBarra: dB, dCorr: dC, chata: [lF, eF], groutM3: arred(litros / 1000, 2) };
  r.altura = H; r.comprimentoTotal = L;
  return r;
}
