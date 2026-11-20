// Preparação para a oficina: lista de posições, aprovisionamento, notas de fabrico, escalas e pormenores.
import { PERFIS, MATERIAIS, ACESSORIOS, kgm, acabamentoDe, painelInfo } from './catalogo.js';
import { nomeAcessorio, pesoKg, superficieM2 } from './custo.js';
import { alcadoSVG } from './desenho2d.js';

const arred = (v, c = 1) => Math.round(v * 10 ** c) / 10 ** c;
const GRUPOS = {
  corrimao: ['C', 'Corrimão'], prumo: ['P', 'Prumo'], pilar: ['PL', 'Pilar'], aro: ['A', 'Aro da folha'], travessa: ['T', 'Travessa'],
  varao: ['V', 'Varão'], barra: ['B', 'Barra horizontal'], lamina: ['L', 'Lâmina'], tubo: ['TB', 'Troço de tubo'],
  viga: ['VG', 'Viga'], linha: ['LN', 'Linha (tirante entre pilares)'], vigap: ['VP', 'Viga de parede'], madre: ['M', 'Madre'], ripa: ['R', 'Ripa'],
  chapa: ['CH', 'Chapa de enchimento'], vidro: ['VD', 'Vidro laminado'], sandwich: ['CB', 'Painel de cobertura'], trapezoidal: ['CB', 'Chapa de cobertura'],
  chata: ['BC', 'Barra chata de base'], longarina: ['LG', 'Longarina do patamar'], gradil: ['GR', 'Gradil'], base: ['B', 'Quadro de base'], topo: ['TP', 'Quadro de topo'], ombreira: ['J', 'Ombreira da porta'], padieira: ['JP', 'Padieira da porta'],
  banzo: ['BZ', 'Banzo ou viga da escada'], suporte: ['S', 'Suporte de degrau'], lacrimada: ['D', 'Degrau (planificado)'], piso: ['F', 'Piso em chapa lacrimada'], parede: ['W', 'Revestimento de parede'],
  almofada: ['AL', 'Almofada quinada (planificada)'], tardoz: ['CT', 'Chapa de trás'], xps: ['IS', 'Isolamento'],
};
const ORDEM = Object.keys(GRUPOS);
const grau = a => String(arred(90 - (+a || 0))).replace('.', ',') + '°';
const chavePeca = p => `${p.grupo}|${p.perfil}|${p.L}|${(p.ang || [0, 0]).join('/')}`;

/**
 * Lista de posições: peças iguais juntas, cada grupo com a sua letra (P1, T2…).
 * Devolve { posicoes, refDe } — refDe liga cada peça/painel do resultado à sua referência.
 */
export function listaPosicoes(res, material) {
  const mat = MATERIAIS[material] ? material : 'aco', dens = MATERIAIS[mat].densidade;
  const juntas = new Map();
  for (const p of (res && res.pecas) || []) {
    const k = chavePeca(p);
    if (!juntas.has(k)) {
      const kgUn = p.L / 1000 * kgm(p.perfil, mat), ang = p.ang || [0, 0];
      juntas.set(k, { tipo: 'perfil', grupo: p.grupo, nome: p.nome, letra: p.letra, ordem: p.ordem, perfilId: p.perfil, perfil: (PERFIS[p.perfil] || {}).nome || p.perfil, L: p.L,
        dim: String(Math.round(p.L * 10) / 10).replace('.', ','), qtd: 0, kgUn, corte: `${grau(ang[0])}/${grau(ang[1])}`, itens: [] });
    }
    const g = juntas.get(k); g.qtd++; g.itens.push(p);
  }
  for (const p of (res && res.paineis) || []) {
    const k = `${p.grupo}|${p.esp}|${p.w}|${p.h}|${p.dy ? arred(p.dy) : 0}`;
    if (!juntas.has(k)) juntas.set(k, { tipo: 'painel', grupo: p.grupo, nome: p.nome, letra: p.letra, ordem: p.ordem, perfilId: '', perfil: painelInfo(p, mat).nome,
      L: Math.max(p.w, p.h), dim: `${Math.round(p.w)} × ${Math.round(p.h)}`, qtd: 0,
      kgUn: painelInfo(p, mat).kg, corte: p.nota || (p.dy ? 'topo inclinado' : '—'), itens: [] });
    const g = juntas.get(k); g.qtd++; g.itens.push(p);
  }
  const lista = [...juntas.values()].sort((a, b) => {
    const ia = ORDEM.indexOf(a.grupo), ib = ORDEM.indexOf(b.grupo);
    return (a.ordem || 0) - (b.ordem || 0) || (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.perfil.localeCompare(b.perfil) || b.L - a.L;
  });
  const conta = {}, refDe = new Map();
  const posicoes = lista.map(g => {
    const [letraG, nomeG] = GRUPOS[g.grupo] || [String(g.grupo || 'X').slice(0, 1).toUpperCase(), g.grupo || 'Peça'], letra = g.letra || letraG, nome = g.nome || nomeG;
    conta[letra] = (conta[letra] || 0) + 1;
    const ref = letra + conta[letra];
    for (const it of g.itens) refDe.set(it, ref);
    const { itens, nome: _n, letra: _l, ordem: _o, ...resto } = g;
    return { ref, designacao: nome, ...resto, kgUn: arred(g.kgUn, 2), kg: arred(g.kgUn * g.qtd, 2) };
  });
  return { posicoes, refDe };
}

/** Varas a encomendar com o esquema de corte, chapas/vidros e ferragens de compra. */
export function aprovisionamento(res, plano, material, vara = 6000) {
  const { posicoes } = listaPosicoes(res, material);
  const refPor = new Map(posicoes.filter(p => p.tipo === 'perfil').map(p => [`${p.grupo}|${p.perfilId}|${p.L}|${p.corte}`, p.ref]));
  const varas = ((plano && plano.porPerfil) || []).map(g => {
    const padroes = new Map();
    for (const v of g.varas) {
      const cortes = v.cortes.map(c => { const a = c.ang || [0, 0];
        return { L: c.L, ref: refPor.get(`${c.grupo}|${g.perfil}|${c.L}|${grau(a[0])}/${grau(a[1])}`) || '?' }; });
      const k = cortes.map(c => c.ref + ':' + c.L).join(',') + (v.emenda ? '|e' + v.n : '');
      if (!padroes.has(k)) padroes.set(k, { cortes, sobra: Math.max(0, Math.round(v.sobra)), emenda: !!v.emenda, n: v.n || 1, vezes: 0 });
      padroes.get(k).vezes++;
    }
    const total = g.nVaras * vara;
    return { perfil: g.perfil, nome: (PERFIS[g.perfil] || {}).nome || g.perfil, nVaras: g.nVaras, vara, sobraM: arred(g.desperdicio / 1000, 2),
      pct: total > 0 ? Math.round(g.desperdicio / total * 100) : 0, kg: arred(g.nVaras * vara / 1000 * kgm(g.perfil, material), 1), padroes: [...padroes.values()] };
  });
  const dens = (MATERIAIS[material] || MATERIAIS.aco).densidade, porTipo = new Map();
  for (const p of (res && res.paineis) || []) {
    const k = p.grupo + p.esp;
    if (!porTipo.has(k)) porTipo.set(k, { nome: painelInfo(p, material).nome, grupo: p.grupo, esp: p.esp, qtd: 0, m2: 0, kg: 0 });
    const g = porTipo.get(k); g.qtd++; g.m2 += p.w * p.h / 1e6;
    g.kg += painelInfo(p, material).kg;
  }
  const chapas = [...porTipo.values()].map(g => ({ ...g, m2: arred(g.m2, 2), kg: arred(g.kg, 1) }));
  const compra = [...((res && res.acessorios) || []).map(a => ({ nome: nomeAcessorio(a), qtd: a.qtd, un: (ACESSORIOS[a.ref] || {}).un || 'un' })),
    ...((res && res.extras) || []).map(x => ({ nome: x.nome, qtd: x.qtd, un: 'un' }))];
  return { varas, chapas, compra };
}

/** Notas de fabrico por omissão, conforme o material e o acabamento. São pressupostos a confirmar. */
export function notasFabrico(trabalho, res) {
  const matId = MATERIAIS[trabalho.material] ? trabalho.material : 'aco', mat = MATERIAIS[matId], ac = acabamentoDe(matId, trabalho.acabamento);
  const tub = trabalho.tipo === 'tubagem' || trabalho.tipo === 'flangeada', cor = ac.comCor && trabalho.corNome ? ' ' + trabalho.corNome : '';
  const material = { aco: 'Perfis e tubos em aço S235JR (EN 10219 / EN 10025).', inox: `Aço inoxidável ${matId === 'inox316' ? 'AISI 316L (1.4404)' : 'AISI 304 (1.4301)'}. Usar só ferramentas e discos próprios para inox.`,
    aluminio: 'Perfis em liga de alumínio EN AW-6060/6063 T5.' }[mat.familia];
  const solda = { aco: ['MAG (135), fio G3Si1. Cordões de ângulo a3, contínuos nas ligações à vista.', 'Esmerilar os cordões nas faces visíveis. Fechar os topos abertos dos tubos.'],
    inox: [tub ? 'TIG (141) com gás de purga no interior; penetração total topo a topo.' : 'TIG (141), vareta 308L (316L no AISI 316).', 'Decapar e passivar todos os cordões e zonas afetadas pelo calor.'],
    aluminio: ['TIG/MIG (141/131), vareta ER4043 ou ER5356.', 'Limpar o óxido antes de soldar; cordões limpos e sem poros.'] }[mat.familia];
  const trat = { pintado: `Limpeza mecânica St 3 + primário anticorrosivo + 2 demãos de esmalte${cor}.`, galvanizado: 'Galvanização por imersão a quente (EN ISO 1461). Prever furos de respiro e escoamento em todos os tubos fechados.',
    galv_lacado: `Galvanização a quente (EN ISO 1461) com furos de respiro + lacagem a pó poliéster${cor}.`, lacado: `Lacagem a pó poliéster${cor}, com pré-tratamento.`,
    escovado: 'Acabamento escovado (grão 240–320), sempre no mesmo sentido. Proteger com película até à montagem.', polido: 'Acabamento polido espelho. Proteger com película até à montagem.',
    decapado: 'Decapagem e passivação de toda a peça.', anodizado: 'Anodização (classe 15 µm no exterior).', nenhum: 'Sem tratamento de superfície.' }[ac.id] || ac.nome + '.';
  const fix = (res.pontos || []).some(p => p.tipo === 'sapata' || p.tipo === 'fix_lateral');
  const blocos = [
    { titulo: 'Materiais', linhas: [material] },
    { titulo: 'Soldadura', linhas: solda },
    { titulo: 'Tolerâncias', linhas: tub ? ['Cortes ± 1 mm, em esquadria. Alinhamento dos troços ≤ 2 mm/m.'] : ['Cortes ± 1 mm. Esquadria e prumo ≤ 2 mm/m.', 'Comprimentos pela ponta mais comprida; 90° = corte em esquadria.'] },
    { titulo: 'Tratamento', linhas: [trat] },
    { titulo: 'Montagem', linhas: [tub ? 'Ensaio de estanquidade antes da entrega. Suportes conforme o isométrico.' : 'Confirmar as medidas em obra antes do corte.',
      ...(fix ? ['Fixações por bucha: confirmar o tipo de suporte (betão, alvenaria, pedra).'] : [])] },
  ];
  if (res.telheiro) blocos.splice(4, 1, { titulo: 'Montagem', linhas: ['Pórticos (pilares e viga) soldados em oficina; madres e cobertura montadas em obra.', 'Confirmar em obra o alinhamento e o nível das fundações antes do fabrico.'] },
    { titulo: 'Estrutura', linhas: ['[A CALCULAR] Secções, placas de base, pernos, fundações e contraventamento por técnico habilitado (vento, neve e peso da cobertura).'] });
  if (res.abrigo) blocos.splice(4, 1, { titulo: 'Montagem', linhas: ['Montar o quadro de base sobre mesa plana e medir as diagonais (diferença ≤ 3 mm).', 'Faces de fora dos tubos alinhadas com as dos pilares; fechar os topos abertos.'] },
    { titulo: 'Estrutura', linhas: ['[A CALCULAR] Pilares, base e ligações por técnico habilitado; se o abrigo for para elevar, olhais, lingas e ensaio de carga antes do primeiro uso.'] });
  if (res.escada) blocos.splice(4, 1, { titulo: 'Montagem', linhas: ['Degraus soldados entre os banzos, com as abas para baixo; conferir o nível de cada degrau.', 'Confirmar em obra o desnível real de piso acabado a piso acabado antes do fabrico.'] },
    { titulo: 'Estrutura', linhas: ['[A CALCULAR] Banzos, degraus, chapas de apoio e fixações por técnico habilitado. Guarda da escada em trabalho à parte.'] });
  blocos.push({ titulo: 'Atenção', linhas: ['[A CONFIRMAR] Notas geradas pela app conforme o material e o acabamento; rever antes do fabrico.'] });
  return blocos;
}

const ESCALAS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
/** Menor denominador normalizado (1:n) em que w × h (mm reais) cabe numa caixa de papel (mm). */
export function escalaPara(w, h, caixaW, caixaH) {
  if (!(w > 0) || !(h > 0) || !(caixaW > 0) || !(caixaH > 0)) return 1;
  return ESCALAS.find(n => w / n <= caixaW && h / n <= caixaH) || ESCALAS[ESCALAS.length - 1];
}

const VERTICAIS = ['prumo', 'aro', 'pilar', 'travessa'];
const vertical = p => Math.abs(p.s[2] - p.s[0]) < 1;
/** Pormenor ampliado do primeiro vão: vão livre entre montantes e folga do enchimento. '' se não se aplicar. */
export function pormenorVao(res) {
  if (!res || !res.pecas.length || res.telheiro || res.almofadas || res.escada || (res.cotas || []).some(c => c.tipo === 'l')) return '';
  const mont = res.pecas.filter(p => VERTICAIS.includes(p.grupo) && vertical(p)).sort((a, b) => a.s[0] - b.s[0]);
  if (mont.length < 2) return '';
  const a = mont[0], b = mont.find(p => p.s[0] - a.s[0] > a.t + 20);
  if (!b) return '';
  const xa = a.s[0] + a.t / 2, xb = b.s[0] - b.t / 2, m = Math.max(80, (xb - xa) * 0.08);
  const cotas = [{ tipo: 'h', nivel: 2, s1: xa, s2: xb, texto: String(Math.round(xb - xa)) }];
  const finos = res.pecas.filter(p => (p.grupo === 'varao') && vertical(p) && p.s[0] > xa && p.s[0] < xb).sort((p, q) => p.s[0] - q.s[0]);
  if (finos.length) {
    const v0 = finos[0];
    cotas.push({ tipo: 'h', nivel: 1, s1: xa, s2: v0.s[0] - v0.t / 2, texto: String(Math.round(v0.s[0] - v0.t / 2 - xa)) });
    if (finos.length > 1) cotas.push({ tipo: 'h', nivel: 1, s1: v0.s[0] + v0.t / 2, s2: finos[1].s[0] - finos[1].t / 2, texto: String(Math.round(finos[1].s[0] - finos[1].t / 2 - v0.s[0] - v0.t / 2)) });
  }
  const horiz = res.pecas.filter(p => !vertical(p) && Math.min(p.s[0], p.s[2]) < xb && Math.max(p.s[0], p.s[2]) > xa).map(p => (p.s[1] + p.s[3]) / 2 - p.t / 2).sort((p, q) => p - q);
  if (horiz.length && horiz[0] > 5) cotas.push({ tipo: 'v', y1: 0, y2: horiz[0], texto: String(Math.round(horiz[0])) });
  // barras ou lâminas deitadas: a folga livre entre as duas primeiras
  const deit = res.pecas.filter(p => ['barra', 'lamina'].includes(p.grupo) && !vertical(p) && Math.min(p.s[0], p.s[2]) < xb && Math.max(p.s[0], p.s[2]) > xa).sort((p, q) => p.s[1] - q.s[1]);
  if (deit.length > 1) { const y1 = deit[0].s[1] + deit[0].t / 2, y2 = deit[1].s[1] - deit[1].t / 2; if (y2 - y1 > 1) cotas.push({ tipo: 'v', y1, y2, texto: String(Math.round(y2 - y1)) }); }
  return alcadoSVG({ ...res, cotas, pontos: [] }, { fino: true, janela: [xa - a.t - m, xb + b.t + m] });
}

/** Pormenor do pé do prumo (sapata ou fixação lateral). Dimensões da chapa são pressuposto. null se não houver. */
export function pormenorPe(res) {
  const pt = ((res && res.pontos) || []).find(p => p.tipo === 'sapata' || p.tipo === 'fix_lateral');
  const prumo = pt && res.pecas.find(p => p.grupo === 'prumo' || p.grupo === 'pilar'), pilar = prumo && prumo.grupo === 'pilar';
  if (!pt || !prumo) return null;
  const a = prumo.t, lateral = pt.tipo === 'fix_lateral';
  const f = v => String(Math.round(v * 10) / 10);
  const estilo = `<style>.l{fill:#fff;stroke:#111;stroke-width:.8}.c{fill:#ddd;stroke:#111;stroke-width:.8}.e{stroke:#111;stroke-width:.4;stroke-dasharray:6 2 1 2;fill:none}.q line{stroke:#1f4e9c;stroke-width:.5}.q text,.t{font-family:Helvetica,Arial,sans-serif;font-size:9px;fill:#1f4e9c}.t{fill:#111}.h{fill:url(#hx);stroke:#111;stroke-width:.5}</style>
<defs><pattern id="hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#999" stroke-width=".6"/></pattern></defs>`;
  const cotaH = (x1, x2, y, t) => `<g class="q"><line x1="${f(x1)}" y1="${y}" x2="${f(x2)}" y2="${y}"/><line x1="${f(x1)}" y1="${y - 4}" x2="${f(x1)}" y2="${y + 4}"/><line x1="${f(x2)}" y1="${y - 4}" x2="${f(x2)}" y2="${y + 4}"/><text x="${f((x1 + x2) / 2)}" y="${y - 3}" text-anchor="middle">${t}</text></g>`;
  if (lateral) {
    const cw = 80, ch = 120, e = 8;   // chapa lateral 80×120×8, 2 furos
    return { titulo: 'Fixação lateral do prumo', nota: `Chapa ${cw}×${ch}×${e}, 2 furos Ø12 para bucha M10 — [A CONFIRMAR] conforme o suporte.`, w: 260, h: 220,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -30 260 220">${estilo}
<rect class="h" x="-60" y="40" width="60" height="150"/><line x1="-60" y1="40" x2="${f(a + 60)}" y2="40" stroke="#111" stroke-width=".8"/>
<rect class="c" x="0" y="50" width="${e}" height="${ch}"/><rect class="l" x="${e}" y="-30" width="${f(a)}" height="210"/>
<circle cx="${e / 2}" cy="80" r="3" fill="#111"/><circle cx="${e / 2}" cy="140" r="3" fill="#111"/>
<line class="e" x1="-40" y1="80" x2="${f(a + 30)}" y2="80"/><line class="e" x1="-40" y1="140" x2="${f(a + 30)}" y2="140"/>
${cotaH(e, e + a, -12, f(a))}<text class="t" x="${f(a + 20)}" y="112">60</text><text class="t" x="${f(a + 20)}" y="30">pavimento</text><text class="t" x="${f(a + 20)}" y="176">prumo desce 120</text></svg>` };
  }
  const lado = pilar ? Math.ceil((a + 120) / 10) * 10 : Math.max(100, Math.ceil((a + 60) / 10) * 10), e = pilar ? 10 : 8, fu = lado - (pilar ? 60 : 30), x0 = -lado / 2;
  const furos = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => `<circle class="l" cx="${f(i * fu / 2)}" cy="${f(190 + j * fu / 2)}" r="6"/>`).join('');
  return { titulo: pilar ? 'Pé do pilar — placa de base' : 'Pé do prumo — sapata', nota: pilar ? `Placa ${lado}×${lado}×${e}, 4 furos Ø14 para perno M12, cordão a4 a toda a volta — [A CONFIRMAR] com o cálculo e a fundação.` : `Chapa ${lado}×${lado}×${e}, 4 furos Ø12 para bucha M10, cordão a3 a toda a volta — [A CONFIRMAR] conforme o suporte.`, w: lado + 120, h: lado + 250,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0 - 60)} -40 ${lado + 120} ${lado + 250}">${estilo}
<rect class="l" x="${f(-a / 2)}" y="-40" width="${f(a)}" height="110"/><rect class="c" x="${f(x0)}" y="70" width="${lado}" height="${e}"/>
<rect class="h" x="${f(x0 - 40)}" y="${70 + e}" width="${lado + 80}" height="26"/>
${[-1, 1].map(i => `<line x1="${f(i * fu / 2)}" y1="62" x2="${f(i * fu / 2)}" y2="${70 + e + 24}" stroke="#111" stroke-width="2.2"/>`).join('')}
<line class="e" x1="0" y1="-40" x2="0" y2="${190 + lado / 2 + 12}"/>
${cotaH(-a / 2, a / 2, -22, f(a))}${cotaH(x0, -x0, 122, lado)}
<rect class="c" x="${f(x0)}" y="${f(190 - lado / 2)}" width="${lado}" height="${lado}"/><rect class="l" x="${f(-a / 2)}" y="${f(190 - a / 2)}" width="${f(a)}" height="${f(a)}"${prumo.redondo ? ` rx="${f(a / 2)}"` : ''}/>
${furos}${cotaH(-fu / 2, fu / 2, 190 + lado / 2 + 22, fu)}</svg>` };
}

/** Corte horizontal pela junta entre duas almofadas (escala 1:1 em mm). null se o trabalho não tiver almofadas. */
export function pormenorAlmofada(res) {
  const al = res && res.almofadas;
  if (!al) return null;
  const { relevo: r, aba, junta: j, aro: a } = al, M = Math.max(110, a + 70), f = v => String(Math.round(v * 10) / 10);
  const pele = s => `<polyline class="ch" points="${f(s * M)},${-r} ${f(s * j / 2)},${-r} ${f(s * j / 2)},0 ${f(s * (j / 2 + aba))},0"/>`;
  const iso = al.isolamento ? [-1, 1].map(s => `<rect class="h" x="${f(s > 0 ? a / 2 + 2 : -M)}" y="${f(Math.max(0, a - 40) / 2)}" width="${f(M - a / 2 - 2)}" height="${f(Math.min(40, a))}"/>`).join('') : '';
  const tard = al.tardoz ? `<rect class="c" x="${-M}" y="${f(a)}" width="${2 * M}" height="1.5"/><line x1="0" y1="${f(a - 6)}" x2="0" y2="${f(a + 7)}" stroke="#111" stroke-width="2"/>
<text class="t" x="6" y="${f(a + 14)}">rebite cego inox Ø4,8 a cada ≈ 200</text>` : '';
  const cotaV = `<g class="q"><line x1="${-M + 12}" y1="${-r}" x2="${-M + 12}" y2="0"/><line x1="${-M + 8}" y1="${-r}" x2="${-M + 16}" y2="${-r}"/><line x1="${-M + 8}" y1="0" x2="${-M + 16}" y2="0"/><text x="${-M + 20}" y="${f(-r / 2 + 3)}">${f(r)}</text></g>`;
  const cotaJ = `<g class="q"><line x1="${f(-j / 2)}" y1="${-r - 10}" x2="${f(j / 2)}" y2="${-r - 10}"/><text x="${f(j / 2 + 6)}" y="${-r - 7}">junta entre almofadas ${f(j)}</text></g>`;
  return { titulo: 'Junta entre almofadas (corte horizontal)', w: 2 * M, h: a + r + 60,
    nota: `Relevo ${f(r)} mm, aba de retorno ≈ ${aba} mm dobrada para dentro, encostada ao montante; junta de ${f(j)} mm. Chapa 2 mm. [A CONFIRMAR] raios de quinagem com a quinadeira.`,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-M} ${-r - 26} ${2 * M} ${a + r + 60}"><style>.l{fill:#fff;stroke:#111;stroke-width:.9}.c{fill:#bbb;stroke:#111;stroke-width:.4}.ch{fill:none;stroke:#111;stroke-width:2}.q line{stroke:#1f4e9c;stroke-width:.5}.q text,.t{font-family:Helvetica,Arial,sans-serif;font-size:7px;fill:#1f4e9c}.t{fill:#111}.h{fill:url(#hz);stroke:#999;stroke-width:.4}</style>
<defs><pattern id="hz" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#aaa" stroke-width=".6"/></pattern></defs>
${iso}<rect class="l" x="${f(-a / 2)}" y="0" width="${f(a)}" height="${f(a)}"/><rect class="l" x="${f(-a / 2 + 2)}" y="2" width="${f(a - 4)}" height="${f(a - 4)}"/>
${pele(-1)}${pele(1)}${tard}${cotaV}${cotaJ}<text class="t" x="${f(-a / 2 + 4)}" y="${f(a / 2 + 2)}">montante</text><text class="t" x="${-M + 30}" y="${-r - 4}">frente</text></svg>` };
}

/** Perfil de dois degraus seguidos, com espelho e cobertor (escala 1:1 em mm). null se não for escada. */
export function pormenorDegrau(res) {
  const es = res && res.escada;
  if (!es) return null;
  const { espelho: e, cobertor: c, n } = es, f = v => String(Math.round(v * 10) / 10), aba = 30;
  const degrau = (x, y) => `<polyline class="ch" points="${f(x)},${f(y + aba)} ${f(x)},${f(y)} ${f(x + c)},${f(y)} ${f(x + c)},${f(y + aba)}"/>`;
  return { titulo: 'Degrau tipo', w: 2 * c + 150, h: 2 * e + 110,
    nota: `${n} espelhos de ${String(Math.round(e * 10) / 10).replace('.', ',')} mm · ${n - 1} degraus com cobertor de ${Math.round(c)} mm · inclinação ${String(es.angulo).replace('.', ',')}°. ${es.gradil ? 'Degraus em gradil eletrossoldado com orla e focinho, fixos aos banzos.' : `Chapa lacrimada 4 mm quinada com 2 abas de ${aba} mm, soldada aos banzos.`} [A CONFIRMAR] espessura e reforço conforme a largura.`,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 ${f(-e - 40)} ${f(2 * c + 150)} ${f(2 * e + 110)}"><style>.ch{fill:none;stroke:#111;stroke-width:3}.q line{stroke:#1f4e9c;stroke-width:.8}.q text{font-family:Helvetica,Arial,sans-serif;font-size:16px;fill:#1f4e9c}.b{stroke:#999;stroke-width:.8;stroke-dasharray:8 4;fill:none}</style>
<line class="b" x1="-60" y1="${f(e + e / 2 + 60 * e / c)}" x2="${f(2 * c + 40)}" y2="${f(e / 2 - (2 * c + 40) * e / c + e)}"/>
${degrau(0, e)}${degrau(c, 0)}
<g class="q"><line x1="${f(c)}" y1="-14" x2="${f(2 * c)}" y2="-14"/><line x1="${f(c)}" y1="-22" x2="${f(c)}" y2="-6"/><line x1="${f(2 * c)}" y1="-22" x2="${f(2 * c)}" y2="-6"/><text x="${f(c + c / 2)}" y="-22" text-anchor="middle">${f(c)}</text>
<line x1="-30" y1="0" x2="-30" y2="${f(e)}"/><line x1="-38" y1="0" x2="-22" y2="0"/><line x1="-38" y1="${f(e)}" x2="-22" y2="${f(e)}"/><text x="-40" y="${f(e / 2 + 6)}" text-anchor="end">${f(e)}</text></g></svg>` };
}

/** Corte transversal ao muro: rasgo, barra chata, barra e grout (escala 1:1 em mm). null se não for guarda em rasgo. */
export function pormenorRasgo(res) {
  const g = res && res.guardaMuro;
  if (!g) return null;
  const { rasgo: R, calco, dBarra: d, chata: [lF, eF] } = g, M = R / 2 + 85, f = v => String(Math.round(v * 10) / 10);
  return { titulo: 'Rasgo e selagem com grout', w: 2 * M + 40, h: R + 230,
    nota: `Rasgo ${f(R)}×${f(R)} feito na betonagem com negativo. Barra chata ${f(lF)}×${f(eF)} sobre calços inox (folga ${calco}); barras soldadas a toda a volta; grout cimentício sem retração à face do muro, cura húmida 3 dias. [A CONFIRMAR] largura do muro e armaduras.`,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-M - 30} -120 ${2 * M + 40} ${R + 230}"><style>.b{fill:url(#hr);stroke:#111;stroke-width:.6}.g{fill:#c4c4c4;stroke:#111;stroke-width:.6}.l{fill:#fff;stroke:#111;stroke-width:.9}.k{fill:#333}.q line{stroke:#1f4e9c;stroke-width:.5}.q text,.t{font-family:Helvetica,Arial,sans-serif;font-size:8px;fill:#1f4e9c}.t{fill:#111}</style>
<defs><pattern id="hr" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#888" stroke-width=".6"/></pattern></defs>
<rect class="b" x="${-M}" y="0" width="${2 * M}" height="${R + 100}"/><rect class="g" x="${-R / 2}" y="0" width="${R}" height="${R}"/>
<rect class="k" x="${f(-lF / 2)}" y="${f(R - calco - eF)}" width="${f(lF)}" height="${f(eF)}"/><rect class="l" x="${f(-d / 2)}" y="-120" width="${f(d)}" height="${f(120 + R - calco - eF)}"/>
<g class="q"><line x1="${-R / 2}" y1="-14" x2="${R / 2}" y2="-14"/><line x1="${-R / 2}" y1="-20" x2="${-R / 2}" y2="-8"/><line x1="${R / 2}" y1="-20" x2="${R / 2}" y2="-8"/><text x="${R / 2 + 5}" y="-11">${f(R)}</text>
<line x1="${-M - 14}" y1="0" x2="${-M - 14}" y2="${R}"/><line x1="${-M - 20}" y1="0" x2="${-M - 8}" y2="0"/><line x1="${-M - 20}" y1="${R}" x2="${-M - 8}" y2="${R}"/></g>
<text class="t" x="${R / 2 + 6}" y="${R / 2}">grout</text><text class="t" x="${R / 2 + 6}" y="${R + 40}">betão do muro</text><text class="t" x="${f(d / 2 + 5)}" y="-60">barra Ø${f(d)}</text></svg>` };
}

const metros = v => String(Math.round(v) / 1000).replace('.', ',') + ' m';
const dec1 = (v, c = 1) => (Math.round(v * 10 ** c) / 10 ** c).toFixed(c).replace('.', ',');
/** Quadro resumo do trabalho: pares [rótulo, valor] para a folha 1. */
export function quadroResumo(trabalho, res) {
  const q = [], mat = MATERIAIS[trabalho.material] ? trabalho.material : 'aco', kg = pesoKg(res, mat), L = res.comprimentoTotal || 0;
  if (L > 0) q.push(['Comprimento', metros(L)]);
  if (res.largura > 0) q.push(['Largura', metros(res.largura)]);
  if (res.altura > 0) q.push(['Altura', metros(res.altura)]);
  if (res.guardaMuro) q.push(['Módulos', `${res.guardaMuro.modulos} de ${Math.round(res.guardaMuro.modulo)} mm (o último de acerto)`], ['Barras', `${res.guardaMuro.barras} a ${Math.round(res.guardaMuro.passo)} mm entre eixos`], ['Grout', `${dec1(res.guardaMuro.groutM3, 2)} m³ (com 10 %)`]);
  if (res.modulos) q.push(['Módulos', String(res.modulos)]);
  if (res.unidades > 1) q.push(['Unidades iguais', String(res.unidades)]);
  if (res.escada) q.push(['Espelhos', `${res.escada.n} × ${dec1(res.escada.espelho)} mm`], ['Degraus', `${res.escada.degraus} × ${Math.round(res.escada.cobertor)} mm`], ['Inclinação', dec1(res.escada.angulo) + '°']);
  if (res.telheiro || res.abrigo) q.push(['Pendente', dec1(res.pendente || 0) + ' %'], ['Área em planta', dec1(L * (res.largura || 0) / 1e6) + ' m²']);
  if (res.dn) q.push(['Tubo', `DN${res.dn} · Ø${dec1(res.de)} × ${dec1(res.esp)} mm`]);
  q.push(['Peso do metal', dec1(kg) + ' kg']);
  if (L > 0 && kg > 0 && !res.telheiro && !res.abrigo) q.push(['Peso por metro', dec1(kg / (L / 1000)) + ' kg/m']);
  q.push(['Superfície a tratar', dec1(superficieM2(res)) + ' m²'], ['Peças a cortar', String(res.pecas.length)]);
  return q;
}

/** Sequência de fabrico e montagem, por passos. */
export function sequenciaFabrico(trabalho, res) {
  const ac = acabamentoDe(MATERIAIS[trabalho.material] ? trabalho.material : 'aco', trabalho.acabamento);
  const trat = { galvanizado: 'Furos de respiro, limpar e enviar para galvanizar; endireitar empenos no regresso.', galv_lacado: 'Furos de respiro, galvanizar, endireitar empenos e lacar.',
    pintado: 'Limpar as soldaduras e pintar em oficina (primário + 2 demãos).', lacado: 'Limpar e enviar para lacar.', nenhum: 'Limpar as soldaduras; sem tratamento.' }[ac.id] || `Limpar as soldaduras; acabamento ${ac.nome.toLowerCase()}.`;
  if (res && res.guardaMuro) return [
    'Antes da betonagem do muro: enviar o desenho do rasgo e entregar o negativo; quem faz o muro fixa-o à cofragem.',
    'Com o muro feito: levantamento dos troços e receção do rasgo. Só depois cortar os módulos de acerto.',
    'Cortar as barras em feixe; corrimão e barra chata por módulo. Furar o corrimão com gabarito.',
    'Montar em gabarito: barras a entrar no corrimão e assentes na barra chata; soldar a toda a volta.',
    trat + ' A barra chata vai para o grout: mascarar.',
    'Em obra: retirar o negativo, limpar e saturar o rasgo com água na véspera.',
    'Assentar o módulo sobre 3 calços inox; linha e nível; aprumo com 2 escoras por módulo; travar com cunhas.',
    'Verter o grout de um só lado até sair do outro, um troço de cada vez; acabar à face do muro.',
    'Cura húmida 3 dias; às 24 h tirar escoras e cunhas de cima e retocar. Junta de módulo em cada junta de dilatação do muro.'];
  const tub = trabalho.tipo === 'tubagem' || trabalho.tipo === 'flangeada';
  return [
    'Confirmar as medidas em obra e resolver os pontos «a confirmar» antes de cortar.',
    'Cortar pela lista de corte por vara e marcar cada peça com a sua posição.',
    tub ? 'Pingar os troços e as curvas em bancada, conferir o alinhamento e soldar com purga.' : 'Montar em mesa plana ou gabarito, pingar, conferir esquadria e diagonais, e só depois soldar.',
    tub ? 'Decapar e passivar os cordões; ensaio de estanquidade.' : trat,
    'Controlo final: medidas, folgas e acabamento. Proteger para o transporte.',
    tub ? 'Montagem em obra com os suportes do isométrico; apertos e ensaio final.' : 'Montagem em obra: marcar, nivelar, aprumar e fixar; retoques de acabamento e limpeza.'];
}
