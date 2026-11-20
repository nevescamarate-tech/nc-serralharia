// Tubagem flangeada, troço a troço: a linha escreve-se peça a peça (tubo, curva, tê, redução, válvula…);
// a app dá nome aos troços, numera as ligações e calcula flanges, juntas, kits de isolamento e parafusos.
import { DIAMETROS, ESPESSURAS } from '../catalogo.js';
import { num, numLivre, arred, vazio, peca } from './util.js';
import { DIRECOES } from './tubagem.js';

export const DEF_FLANGEADA = { letra: 'A', dn: 100, esp: 2, pn: 10, nIni: 1, ini: 'ffd', fim: 'ffd', itens: [{ tipo: 'tubo', comp: '', dir: 'dir' }] };
export const EQUIP = { valvula: 'Válvula de seccionamento (volante)', valvula_mot: 'Válvula motorizada', retencao: 'Válvula de retenção', junta_desm: 'Junta de desmontagem autotravada', medidor: 'Medidor de caudal' };
export const ITENS = { tubo: 'Tubo reto', curva: 'Curva (com o ângulo)', flange: 'Ligação flangeada (separa dois troços)', te: 'Tê com ramal flangeado', reducao: 'Redução concêntrica', ...EQUIP };
export const PONTAS = { ffd: 'Liga a ferro fundido ou a equipamento (kit de isolamento)', inox: 'Liga a inox de outra linha (junta EPDM)', contada: 'Flange; ligação contada noutra linha', livre: 'Ponta livre, sem flange' };
const TXT_PONTA = { contada: 'Flange; ligação contada noutra linha', livre: 'Ponta livre, sem flange' };
const NOME_EXT = { ffd: 'Ferro fundido / equipamento existente', inox: 'Inox de outra linha' };

// Flanges EN 1092-1: [diâmetro exterior, círculo de furação, n.º de furos, Ø do furo, métrica do parafuso]
const F10 = { 15: [95, 65, 4, 14, 12], 20: [105, 75, 4, 14, 12], 25: [115, 85, 4, 14, 12], 32: [140, 100, 4, 18, 16], 40: [150, 110, 4, 18, 16], 50: [165, 125, 4, 18, 16], 65: [185, 145, 8, 18, 16],
  80: [200, 160, 8, 18, 16], 100: [220, 180, 8, 18, 16], 125: [250, 210, 8, 18, 16], 150: [285, 240, 8, 22, 20], 200: [340, 295, 8, 22, 20], 250: [395, 350, 12, 22, 20], 300: [445, 400, 12, 22, 20],
  350: [505, 460, 16, 22, 20], 400: [565, 515, 16, 26, 24], 450: [615, 565, 20, 26, 24], 500: [670, 620, 20, 26, 24], 600: [780, 725, 20, 30, 27] };
const F16 = { ...F10, 200: [340, 295, 12, 22, 20], 250: [405, 355, 12, 26, 24], 300: [460, 410, 12, 26, 24], 350: [520, 470, 16, 26, 24], 400: [580, 525, 16, 30, 27], 450: [640, 585, 20, 30, 27], 500: [715, 650, 20, 33, 30], 600: [840, 770, 20, 36, 33] };
const tabela = t => Object.fromEntries(Object.entries(t).map(([dn, [D, K, n, h, M]]) => [dn, { D, K, n, h, M }]));
export const FLANGES = { 10: tabela(F10), 16: tabela(F16) };
// PRESSUPOSTOS de espessura (mm) para o comprimento dos parafusos: a confirmar com as fichas técnicas.
export const T_INOX = { 15: 16, 20: 18, 25: 18, 32: 20, 40: 20, 50: 22, 65: 22, 80: 24, 100: 24, 125: 26, 150: 26, 200: 28, 250: 30, 300: 32, 350: 34, 400: 36, 450: 38, 500: 40, 600: 44 };   // flange solta tipo 02 + colar tipo 32
export const T_FFD = { 15: 19, 20: 19, 25: 19, 32: 19, 40: 19, 50: 19, 65: 19, 80: 19, 100: 19, 125: 19, 150: 19, 200: 20, 250: 22, 300: 25, 350: 26, 400: 27, 450: 28, 500: 30, 600: 32 };       // flange EN 1092-2 (equipamento / FFD)
const PORCA = { 12: 10, 16: 13, 20: 16, 24: 19, 27: 22, 30: 24, 33: 26 }, ANILHA = { 12: 2.5, 16: 3, 20: 3, 24: 4, 27: 4, 30: 4, 33: 5 };
const COMPRIMENTOS = [40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 240, 260];

/** Parafuso de uma ligação: métrica, quantidade, comprimento calculado (L0) e comprimento normalizado (L). */
export function parafuso(dn, pn, tipo) {
  const f = FLANGES[pn][dn], kit = tipo === 'inox-FFD';
  const t1 = tipo === 'ferro-ferro' ? T_FFD[dn] : T_INOX[dn], t2 = tipo === 'inox-inox' ? T_INOX[dn] : T_FFD[dn];
  const L0 = t1 + t2 + (kit ? 9 : 3) + 2 * ANILHA[f.M] + PORCA[f.M] + 5;      // junta 3 mm (kit: + 2 anilhas isolantes de 3) + 5 de ponta livre
  return { M: f.M, n: f.n, L: COMPRIMENTOS.find(v => v >= L0) || Math.ceil(L0 / 10) * 10, L0: arred(L0) };
}


const MAX_ITENS = 80;
/** Comprimento de face a face habitual (mm), só para desenhar um equipamento a que ainda não se deu a medida. */
const FACE_A_FACE = (dn, tipo) => Math.round((tipo === 'junta_desm' ? 200 + dn * 0.55 : tipo === 'medidor' ? 200 + dn * 0.5 : 140 + dn * 0.42) / 10) * 10;
export const ANGULOS = { 90: '90°', 45: '45°', 30: '30°', 22.5: '22,5°', outro: 'Outro ângulo (medido no local)' };
const iso = p => [(p[0] - p[2]) * 0.866, p[1] - (p[0] + p[2]) * 0.5];
const mais = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const escalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const igual = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 0.05;
const vazia = v => v === '' || v === null || v === undefined;
const meio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const unit = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return v.map(x => Math.round(x / n * 1e9) / 1e9); };
const r2 = p => p.map(v => arred(v, 2));
const graus = a => String(arred(a, 1)).replace('.', ',');
/** Pontos do eixo de uma curva de raio R: entra na direção d, sai na direção e, com o canto (cruzamento dos eixos) em `canto`. */
export function arco(canto, d, e, R, n = 10) {
  const cos = Math.max(-1, Math.min(1, escalar(d, e))), ang = Math.acos(cos), T = R * Math.tan(ang / 2);
  const lado = unit([0, 1, 2].map(k => e[k] - cos * d[k])), c = mais(mais(canto, d, -T), lado, R), pts = [];
  for (let k = 0; k <= n; k++) { const a = ang * k / n; pts.push(r2(mais(mais(c, lado, -R * Math.cos(a)), d, R * Math.sin(a)))); }
  return pts;
}

export function calcFlangeada(medidas = {}) {
  const m = { ...DEF_FLANGEADA, ...(medidas || {}) };
  const dn0 = DIAMETROS[+m.dn] ? +m.dn : 100, pn = +m.pn === 16 ? 16 : 10;
  const espDe = dn => (ESPESSURAS.includes(+m.esp) && 2 * +m.esp < DIAMETROS[dn].de ? +m.esp : 2);
  const limpa = v => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  // várias linhas no mesmo trabalho: a primeira são as medidas de sempre; as outras vêm em m.linhas
  const extra = (Array.isArray(m.linhas) ? m.linhas : []).slice(0, 11), varias = extra.some(x => x && Array.isArray(x.itens) && x.itens.length);
  const letra0 = limpa(m.letra) || 'A', letras = [];
  let letra = letra0, ini = 'ffd', fim = 'ffd', itens = [], nTro = 0, rot = 'Peça ';
  let nLig = Math.min(9999, Math.max(1, Math.round(numLivre(m.nIni)) || 1));
  const avisos = [], r = vazio(avisos);
  Object.assign(r, { arcos3d: [], curvas2d: [], blocos2d: [], blocos3d: [], etiquetas: [], etiquetas3d: [], semPontos2d: true });
  const trocos = [], ligs = [], equips = [], soFlange = {}, acs = new Map();
  let P = [0, 0, 0], d = null, dn = dn0, sp = null, antes = { ext: ini }, soldas = 0, dnMax = dn0, pend = null;   // pend: curva acabada de fazer, à espera do tubo seguinte
  const ac = (ref, sufixo, qtd, fator) => { const k = ref + '|' + sufixo, a = acs.get(k) || { ref, qtd: 0, fator, sufixo }; a.qtd += qtd; acs.set(k, a); };
  const lado = x => (x.sp ? { nome: x.sp.id, inox: true, sp: x.sp } : x.eq ? { nome: x.eq.nome, inox: false, eq: x.eq } : { nome: NOME_EXT[x.ext], inox: x.ext === 'inox' });

  function liga(a, b, p, dir, dnL = dn) {
    const A = lado(a), B = lado(b), tipo = A.inox && B.inox ? 'inox-inox' : !A.inox && !B.inox ? 'ferro-ferro' : 'inox-FFD', f = FLANGES[pn][dnL];
    const l = { n: nLig++, tipo, dn: dnL, pn, kit: tipo === 'inox-FFD', nossas: (A.sp ? 1 : 0) + (B.sp ? 1 : 0), flange: f, parafuso: parafuso(dnL, pn, tipo), p: r2(p), s: iso(p), dir, entre: [A.nome, B.nome] };
    l.aberta = !B.sp && !B.eq;                    // do outro lado ainda não há nada desta obra: outra linha pode nascer aqui
    ligs.push(l); soldas += l.nossas;
    for (const x of [A, B]) { if (x.sp) x.sp.ends.push(l.n); if (x.eq) x.eq.ligs.push(l.n); }
    const cls = 'lig ' + { 'inox-inox': 'g', 'inox-FFD': 'o', 'ferro-ferro': 'y' }[tipo];
    r.pontos.push({ tipo: 'flange', p: l.p, s: l.s, dir, r: f.D / 2, lig: l.n, furos: { K: f.K, n: f.n, h: f.h }, D: f.D, bore: DIAMETROS[dnL].de, esp: T_INOX[dnL] });
    r.blocos2d.push({ a: iso(mais(p, dir, -f.D * 0.04)), b: iso(mais(p, dir, f.D * 0.04)), t: f.D, cls: 'fl', lig: l.n });
    r.etiquetas.push({ s: l.s, a: iso(mais(p, dir, -10)), b: iso(mais(p, dir, 10)), txt: String(l.n), cls, r: f.D / 2, lig: l.n });
    r.etiquetas3d.push({ p: [l.p[0], l.p[1] + f.D / 2 + 40, l.p[2]], txt: String(l.n), cls, lig: l.n });
    return l;
  }
  function pontaSolta(troco, como, dnL = dn) {      // ponta sem ligação numerada nesta linha
    troco.ends.push({ livre: TXT_PONTA[como] });
    if (como === 'contada') { soFlange[dnL] = (soFlange[dnL] || 0) + 1; soldas++; }
  }
  /** Uma linha nova nasce numa ligação que já existe (ramal de um tê, fim de outra linha): a ligação passa a ser entre as duas. */
  function pega(l, x) {
    const X = lado(x), tipo = X.inox ? 'inox-inox' : 'inox-FFD', cls = 'lig ' + (X.inox ? 'g' : 'o');
    Object.assign(l, { tipo, kit: !X.inox, parafuso: parafuso(l.dn, pn, tipo), nossas: 1 + (X.sp ? 1 : 0), aberta: false }); l.entre[1] = X.nome;
    if (X.sp) { X.sp.ends.push(l.n); soldas++; } else X.eq.ligs.push(l.n);
    for (const e of [...r.etiquetas, ...r.etiquetas3d]) if (e.lig === l.n) e.cls = cls;
  }
  function abre(dir) {
    if (sp) return;
    sp = { id: letra + (++nTro), dnIni: dn, dnFim: dn, pernas: [], face: false, curvas: 0, angs: [], tes: [], reds: [], ends: [], total: 0, ult: null, maior: null };
    trocos.push(sp);
    if (antes.lig) pega(antes.lig, { sp });
    else if (antes.ext) { if (antes.ext === 'ffd' || antes.ext === 'inox') liga(antes, { sp }, P, dir); else pontaSolta(sp, antes.ext); }
    else liga(antes, { sp }, P, dir);
    antes = null;
  }
  const fecha = () => { const c = sp; sp = null; return c; };
  const perfilDe = x => `tu${x}x${espDe(x)}`;
  function tubo(a, b, L, dnT = dn) {
    const de = DIAMETROS[dnT].de, k = trocos.length;
    const p = { ...peca('tb' + k, perfilDe(dnT), r2(a), r2(b), [...iso(a), ...iso(b)], { L, t: de, p: de }), nome: 'Tubo do troço ' + sp.id, letra: 'TB', ordem: k, tro: sp.id };
    r.pecas.push(p); soldas += Math.ceil(L / 6000) - 1;
    if (!sp.maior || L > sp.maior.L) sp.maior = { L, a, b, t: de };
    return p;
  }
  const cota = (a, b, texto, t) => r.cotas.push({ tipo: 'l', a: iso(a), b: iso(b), texto, t, tro: sp ? sp.id : null });
  /** Fecha uma curva que ficou sem tubo a seguir (logo antes de uma flange ou de um equipamento). */
  function semTubo() {
    if (!pend) return;
    if (sp) { sp.pernas.push(`${Math.round(pend.T)} (eixo-face)`); sp.face = true; sp.total += pend.T; }
    r.comprimentoTotal += pend.T; pend = null;
  }
  /** Curva no ponto atual: da direção d para a direção e. Deixa o ponto atual no fim da curva. */
  function dobra(e, n) {
    const cos = Math.max(-1, Math.min(1, escalar(d, e))), ang = Math.acos(cos), R = 1.5 * dn, T = R * Math.tan(ang / 2), de = DIAMETROS[dn].de, a = arred(ang * 180 / Math.PI, 1);
    abre(d);
    let canto;
    if (sp.ult && igual(sp.ult.b, P)) {          // a seguir a um tubo do mesmo troço: o canto é onde o tubo acabava, e o tubo encurta
      const u = sp.ult; u.L = arred(u.L - T); u.b = r2(mais(P, d, -T)); u.s = [u.s[0], u.s[1], ...iso(u.b)]; canto = P;
      if (u.L <= 0) { avisos.push(`${rot}${n}: o tubo anterior não chega para a curva DN${dn} (raio ${R} mm).`); r.pecas.splice(r.pecas.indexOf(u), 1); }
    } else {                                     // logo a seguir a uma flange, a um equipamento ou a outra curva
      canto = mais(P, d, T);
      if (pend) sp.pernas.push(String(Math.round(pend.T + T))); else { sp.pernas.push(`${Math.round(T)} (face-eixo)`); sp.face = true; }
      sp.total += T; r.comprimentoTotal += T;
    }
    const pts = arco(canto, d, e, R);
    r.arcos3d.push({ pts, r: de / 2, tro: sp.id }); r.curvas2d.push({ pts: pts.map(iso), t: de, tro: sp.id, ang: graus(a) + '°' });
    sp.curvas++; sp.angs.push(a); soldas += 2;
    if (a === 90) ac('curva_inox', 'DN' + dn, 1, dn / 50); else if (a === 45) ac('curva45_inox', 'DN' + dn, 1, dn / 50); else ac('curva_ang_inox', `${graus(a)}° DN${dn}`, 1, dn / 50);
    P = mais(canto, e, T); d = e; pend = { canto, T }; sp.ult = null;
  }

  const percorre = () => {
  itens.forEach((it, i) => {
    const n = i + 1, tipo = it && it.tipo;
    if (tipo === 'tubo') {
      if (vazia(it.comp)) return;
      const comp = num(it.comp, 0), e = (it.dir !== 'segue' && DIRECOES[it.dir]) || d || DIRECOES.dir;
      if (!comp || comp > 100000) { avisos.push(`${rot}${n}: comprimento do tubo inválido (em mm).`); return; }
      if (d) {
        const c = escalar(d, e);
        if (c < -0.999) { avisos.push(`${rot}${n}: o tubo volta para trás sobre o anterior. Confirme a direção.`); return; }
        if (c < -1e-6) { avisos.push(`${rot}${n}: mudança de direção de mais de 90°. Ponha duas curvas, ou «segue a direito» no tubo.`); return; }
        if (c < 1 - 1e-9) dobra(e, n);
      }
      abre(d || e);
      const canto = pend ? pend.canto : P, desconto = pend ? pend.T : 0, Q = mais(canto, e, comp), de = DIAMETROS[dn].de;
      pend = null;
      if (comp - desconto <= 0) avisos.push(`${rot}${n}: ${comp} mm não chegam para a curva DN${dn} (raio ${1.5 * dn} mm).`);
      else { sp.ult = tubo(P, Q, arred(comp - desconto)); P = Q; }
      sp.pernas.push(String(Math.round(comp))); sp.total += comp;
      cota(canto, Q, String(Math.round(comp)), de);
      if (Math.abs(e[1]) < 1e-6) r.trocosPlanta.push({ a: [canto[0], canto[2]], b: [Q[0], Q[2]], texto: String(Math.round(comp)) });
      r.comprimentoTotal += comp; d = e;
    } else if (tipo === 'curva') {
      const de0 = d || DIRECOES.dir, a = it.ang === 'outro' ? numLivre(it.angOutro) : numLivre(vazia(it.ang) ? 90 : it.ang), para = DIRECOES[it.para];
      if (!(a >= 1 && a <= 90)) { avisos.push(`${rot}${n}: indique o ângulo da curva (entre 1° e 90°).`); return; }
      const perp = q => [0, 1, 2].map(k => q[k] - escalar(q, de0) * de0[k]);
      let u = para ? perp(para) : null;
      if (!u || Math.hypot(u[0], u[1], u[2]) < 1e-6) {   // sem lado (ou a virar para onde o tubo já segue): desenha-se para um lado possível e avisa-se
        const nome = Math.abs(de0[1]) < 0.9 ? 'cima' : 'dir'; u = perp(DIRECOES[nome]);
        avisos.push(`${rot}${n}: escolha para que lado vira a curva; por agora foi desenhada a virar para ${nome === 'cima' ? 'cima' : 'a direita'}.`);
      }
      const lad = unit(u), rad = a * Math.PI / 180;
      d = de0; dobra(unit([0, 1, 2].map(k => Math.cos(rad) * de0[k] + Math.sin(rad) * lad[k])), n);
    } else if (tipo === 'flange') {
      semTubo();
      if (sp) antes = { sp: fecha() }; else avisos.push(`${rot}${n}: ligação flangeada sem tubo antes; foi ignorada.`);
    } else if (EQUIP[tipo]) {
      const e = d || DIRECOES.dir, f = FLANGES[pn][dn];
      let comp = num(it.comp, 0);
      if (!comp || comp > 20000) {                 // sem medida: desenha-se com um comprimento habitual, para a linha não parar, e avisa-se
        comp = FACE_A_FACE(dn, tipo);
        avisos.push(`${rot}${n}: falta o comprimento de face a face de «${EQUIP[tipo]}»; foi desenhada com ${comp} mm. Confirme com a ficha do equipamento.`);
      }
      semTubo();
      const eq = { nome: EQUIP[tipo], tipo, dn, comp, ligs: [] }, Q = mais(P, e, comp);
      if (sp) liga({ sp: fecha() }, { eq }, P, e); else if (antes.lig) pega(antes.lig, { eq }); else if (antes.ext) { if (antes.ext === 'ffd' || antes.ext === 'inox') liga(antes, { eq }, P, e); } else liga(antes, { eq }, P, e);
      equips.push(eq);
      r.blocos2d.push({ a: iso(P), b: iso(Q), t: f.D * 0.8, cls: 'eq', eq: true }); r.blocos3d.push({ a: P, b: Q, r: f.D * 0.4, tipo, info: `${eq.nome} DN${dn}` });
      r.cotas.push({ tipo: 'l', a: iso(P), b: iso(Q), texto: String(Math.round(comp)), t: f.D * 0.8 });
      r.comprimentoTotal += comp; P = Q; d = e; antes = { eq };
    } else if (tipo === 'reducao') {
      const dn2 = +it.dn2, e = d || DIRECOES.dir, comp = num(it.comp, 150);
      if (!DIAMETROS[dn2] || dn2 === dn) { avisos.push(`${rot}${n}: escolha o diâmetro de saída da redução.`); return; }
      if (comp > 5000) { avisos.push(`${rot}${n}: comprimento da redução inválido.`); return; }
      semTubo(); abre(e);
      const Q = mais(P, e, comp), de1 = DIAMETROS[dn].de, de2 = DIAMETROS[dn2].de;
      r.blocos2d.push({ a: iso(P), b: iso(Q), t: (de1 + de2) / 2, cls: 'pc', tro: sp.id }); r.blocos3d.push({ a: P, b: Q, r: de1 / 2, r2: de2 / 2, tipo: 'reducao', tro: sp.id });
      sp.reds.push([dn, dn2]); sp.total += comp; sp.pernas.push(String(Math.round(comp))); sp.ult = null;
      ac('reducao_inox', `DN${Math.max(dn, dn2)}×DN${Math.min(dn, dn2)}`, 1, Math.max(dn, dn2) / 50); soldas += 2;
      r.comprimentoTotal += comp; P = Q; d = e; dn = dn2; sp.dnFim = dn2; dnMax = Math.max(dnMax, dn2);
    } else if (tipo === 'te') {
      const e = d || DIRECOES.dir, dn2 = DIAMETROS[+it.dn2] && +it.dn2 <= dn ? +it.dn2 : dn;
      let dr = DIRECOES[it.dirR]; if (!dr || Math.abs(escalar(dr, e)) > 1e-6) dr = Math.abs(e[1]) < 0.9 ? (Math.abs(e[2]) < 1e-6 ? DIRECOES.frente : DIRECOES.cima) : DIRECOES.frente;
      const compR = Math.min(5000, num(it.compR, Math.round(DIAMETROS[dn].de / 2 + 150))), ramal = PONTAS[it.ramal] ? it.ramal : 'inox';
      semTubo(); abre(e);
      const B = mais(P, dr, compR), ult = sp.ult;
      tubo(P, B, compR, dn2); sp.ult = ult; cota(P, B, String(Math.round(compR)), DIAMETROS[dn2].de);
      if (ramal === 'ffd' || ramal === 'inox') liga({ sp }, { ext: ramal }, B, dr, dn2); else pontaSolta(sp, ramal, dn2);
      sp.tes.push({ dn, dn2, compR: Math.round(compR) }); soldas += 3;
      ac('te_inox', dn2 === dn ? 'DN' + dn : `DN${dn}×DN${dn2}`, 1, dn / 50);
    } else avisos.push(`${rot}${n}: tipo de peça desconhecido.`);
  });

  // fim da linha
  const ult = d || DIRECOES.dir;
  semTubo();
  if (sp) { const c = fecha(); if (fim === 'ffd' || fim === 'inox') liga({ sp: c }, { ext: fim }, P, ult); else pontaSolta(c, fim); }
  else if (antes && antes.sp) { if (fim === 'ffd' || fim === 'inox') liga(antes, { ext: fim }, P, ult); else pontaSolta(antes.sp, fim); }
  else if (antes && antes.eq && (fim === 'ffd' || fim === 'inox')) liga(antes, { ext: fim }, P, ult);
  };
  [m, ...extra].forEach((L, li) => {
    if (!L || !Array.isArray(L.itens) || !L.itens.length) return;
    letra = li ? limpa(L.letra) || String.fromCharCode(65 + li) : letra0;
    while (letras.includes(letra)) letra = letra.length === 1 && letra < 'Z' ? String.fromCharCode(letra.charCodeAt(0) + 1) : letra + '2';   // duas linhas não podem ter a mesma letra
    rot = varias ? `Linha ${letra}, peça ` : 'Peça ';
    ini = PONTAS[L.ini] ? L.ini : 'ffd'; fim = PONTAS[L.fim] ? L.fim : 'ffd';
    itens = L.itens.slice(0, MAX_ITENS); nTro = 0; sp = null; pend = null; d = null;
    dn = DIAMETROS[+L.dn] ? +L.dn : dn0; P = [0, 0, 0]; antes = { ext: ini };
    if (li) {
      const alvo = Math.round(numLivre(L.lig)), l = L.comeca === 'lig' ? ligs.find(x => x.n === alvo && x.aberta) : null;
      if (l) { P = l.p.slice(); d = l.dir; dn = l.dn; antes = { lig: l }; }
      else {
        if (L.comeca === 'lig') avisos.push(`Linha ${letra}: a ligação n.º ${alvo || '?'} não existe ou não está livre (tem de ser o ramal de um tê ou o fim de outra linha). A linha foi desenhada a partir do ponto de partida.`);
        P = [L.x, L.y, L.z].map(v => Math.max(-1e6, Math.min(1e6, numLivre(v))));
      }
    }
    dnMax = Math.max(dnMax, dn);
    const havia = trocos.length + equips.length;
    percorre();
    if (trocos.length + equips.length > havia) letras.push(letra);
  });
  if (!trocos.length && !equips.length) return vazio(avisos.length ? avisos : ['Escreva a primeira peça da linha: um tubo com o comprimento de flange a flange.']);

  // nomes e medidas dos troços
  const pub = trocos.map(t => {
    const iguais = t.angs.every(a => a === t.angs[0]);
    const curvas = !t.curvas ? '' : iguais ? `${t.curvas} curva${t.curvas > 1 ? 's' : ''} ${graus(t.angs[0])}°` : `${t.curvas} curvas (${t.angs.map(a => graus(a) + '°').join(' + ')})`;
    const nome = t.tes.length ? `Tê DN${t.tes[0].dn}${t.tes[0].dn2 !== t.tes[0].dn ? '×DN' + t.tes[0].dn2 : ''}` : t.reds.length ? `Tubo com redução DN${t.reds[0][0]}→DN${t.reds[0][1]}`
      : t.curvas ? `Peça com ${curvas} DN${t.dnIni}` : `Tubo reto DN${t.dnIni}`;
    const L = t.curvas ? t.pernas.join(' + ') + (t.face ? '' : ' (ao eixo)') : t.tes.length ? `${Math.round(t.total)} (passagem) · ${t.tes[0].compR} (derivação)` : String(Math.round(t.total));
    if (t.maior) {
      r.etiquetas.push({ s: iso(meio(t.maior.a, t.maior.b)), a: iso(t.maior.a), b: iso(t.maior.b), txt: t.id, cls: 'tro', r: t.maior.t / 2, tro: t.id });
      const c = meio(t.maior.a, t.maior.b); r.etiquetas3d.push({ p: [c[0], c[1] + t.maior.t / 2 + 60, c[2]], txt: t.id, cls: 'tro', tro: t.id });
    }
    return { id: t.id, nome, dn: t.dnIni === t.dnFim ? `DN${t.dnIni}` : `DN${t.dnIni} → DN${t.dnFim}`, L, ends: t.ends, curvas: t.curvas, angulos: t.angs };
  });

  // material de ligação
  const porDN = o => Object.fromEntries(Object.entries(o).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => ['DN' + k, v]));
  const fl = { ...soFlange }, juntas = {}, kits = {}, paraf = {};
  for (const l of ligs) {
    if (l.nossas) fl[l.dn] = (fl[l.dn] || 0) + l.nossas;
    if (l.kit) { kits[l.dn] = (kits[l.dn] || 0) + 1; ac('kit_isolamento', 'DN' + l.dn, 1, l.dn / 50); } else { juntas[l.dn] = (juntas[l.dn] || 0) + 1; ac('junta_epdm', 'DN' + l.dn, 1, l.dn / 50); }
    const k = `M${l.parafuso.M} × ${l.parafuso.L}`; paraf[k] = (paraf[k] || 0) + l.parafuso.n;
    ac('parafuso_a4', `M${l.parafuso.M}×${l.parafuso.L}`, l.parafuso.n, arred((l.parafuso.M / 16) ** 2 * l.parafuso.L / 60, 2));
  }
  for (const [k, v] of Object.entries(fl)) { ac('flange_solta', 'DN' + k, v, k / 50); ac('colar_inox', 'DN' + k, v, k / 50); }
  r.acessorios = [...acs.values()].map(a => ({ ...a, qtd: arred(a.qtd, 2) }));
  r.flangeada = { letra: letra0, linhas: letras, pn, trocos: pub, ligacoes: ligs, equipamentos: equips, resumo: { parafusos: paraf, flanges: porDN(fl), juntas: porDN(juntas), kits: porDN(kits) } };

  r.ligacoes = soldas;
  const metros = r.pecas.reduce((s, p) => s + p.L, 0) / 1000;
  r.horas = Math.round((soldas * (0.25 + dnMax / 200) + r.pecas.length * 0.1 + metros * 0.1 + ligs.length * 0.25) * 2) / 2;
  r.dn = dn0; r.de = DIAMETROS[dn0].de; r.esp = espDe(dn0); r.altura = 0; r.comprimentoTotal = arred(r.comprimentoTotal);
  avisos.push('Medidas de projeto: confirmar em obra antes de fabricar. Comprimentos de corte sem descontar a altura dos colares.');
  return r;
}
