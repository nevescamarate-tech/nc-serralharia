// Preparação para a oficina: lista de posições, aprovisionamento, notas de fabrico, escalas e pormenores.
import { PERFIS, MATERIAIS, ACESSORIOS, kgm, dims, acabamentoDe } from './catalogo.js';
import { nomeAcessorio } from './custo.js';
import { alcadoSVG } from './desenho2d.js';

const arred = (v, c = 1) => Math.round(v * 10 ** c) / 10 ** c;
const GRUPOS = {
  corrimao: ['C', 'Corrimão'], prumo: ['P', 'Prumo'], pilar: ['PL', 'Pilar'], aro: ['A', 'Aro da folha'], travessa: ['T', 'Travessa'],
  varao: ['V', 'Varão'], barra: ['B', 'Barra horizontal'], lamina: ['L', 'Lâmina'], tubo: ['TB', 'Troço de tubo'],
  chapa: ['CH', 'Chapa de enchimento'], vidro: ['VD', 'Vidro laminado'],
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
      juntas.set(k, { tipo: 'perfil', grupo: p.grupo, perfilId: p.perfil, perfil: (PERFIS[p.perfil] || {}).nome || p.perfil, L: p.L,
        dim: String(Math.round(p.L * 10) / 10).replace('.', ','), qtd: 0, kgUn, corte: `${grau(ang[0])}/${grau(ang[1])}`, itens: [] });
    }
    const g = juntas.get(k); g.qtd++; g.itens.push(p);
  }
  for (const p of (res && res.paineis) || []) {
    const k = `${p.grupo}|${p.esp}|${p.w}|${p.h}|${p.dy ? arred(p.dy) : 0}`;
    if (!juntas.has(k)) juntas.set(k, { tipo: 'painel', grupo: p.grupo, perfilId: '', perfil: `${p.grupo === 'vidro' ? 'Vidro laminado' : 'Chapa'} ${p.esp} mm`,
      L: Math.max(p.w, p.h), dim: `${Math.round(p.w)} × ${Math.round(p.h)}`, qtd: 0,
      kgUn: p.grupo === 'chapa' ? p.w * p.h / 1e6 * p.esp / 1000 * dens : 0, corte: p.dy ? 'topo inclinado' : '—', itens: [] });
    const g = juntas.get(k); g.qtd++; g.itens.push(p);
  }
  const lista = [...juntas.values()].sort((a, b) => {
    const ia = ORDEM.indexOf(a.grupo), ib = ORDEM.indexOf(b.grupo);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.perfil.localeCompare(b.perfil) || b.L - a.L;
  });
  const conta = {}, refDe = new Map();
  const posicoes = lista.map(g => {
    const [letra, nome] = GRUPOS[g.grupo] || [String(g.grupo || 'X').slice(0, 1).toUpperCase(), g.grupo || 'Peça'];
    conta[letra] = (conta[letra] || 0) + 1;
    const ref = letra + conta[letra];
    for (const it of g.itens) refDe.set(it, ref);
    const { itens, ...resto } = g;
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
    if (!porTipo.has(k)) porTipo.set(k, { nome: `${p.grupo === 'vidro' ? 'Vidro laminado' : 'Chapa'} ${p.esp} mm`, grupo: p.grupo, esp: p.esp, qtd: 0, m2: 0, kg: 0 });
    const g = porTipo.get(k); g.qtd++; g.m2 += p.w * p.h / 1e6;
    if (p.grupo === 'chapa') g.kg += p.w * p.h / 1e6 * p.esp / 1000 * dens;
  }
  const chapas = [...porTipo.values()].map(g => ({ ...g, m2: arred(g.m2, 2), kg: arred(g.kg, 1) }));
  const compra = ((res && res.acessorios) || []).map(a => ({ nome: nomeAcessorio(a), qtd: a.qtd, un: (ACESSORIOS[a.ref] || {}).un || 'un' }));
  return { varas, chapas, compra };
}

/** Notas de fabrico por omissão, conforme o material e o acabamento. São pressupostos a confirmar. */
export function notasFabrico(trabalho, res) {
  const matId = MATERIAIS[trabalho.material] ? trabalho.material : 'aco', mat = MATERIAIS[matId], ac = acabamentoDe(matId, trabalho.acabamento);
  const tub = trabalho.tipo === 'tubagem', cor = ac.comCor && trabalho.corNome ? ' ' + trabalho.corNome : '';
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
  if (!res || !res.pecas.length || (res.cotas || []).some(c => c.tipo === 'l')) return '';
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
  return alcadoSVG({ ...res, cotas, pontos: [] }, { fino: true, janela: [xa - a.t - m, xb + b.t + m] });
}

/** Pormenor do pé do prumo (sapata ou fixação lateral). Dimensões da chapa são pressuposto. null se não houver. */
export function pormenorPe(res) {
  const pt = ((res && res.pontos) || []).find(p => p.tipo === 'sapata' || p.tipo === 'fix_lateral');
  const prumo = pt && res.pecas.find(p => p.grupo === 'prumo');
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
  const lado = Math.max(100, Math.ceil((a + 60) / 10) * 10), e = 8, fu = lado - 30, x0 = -lado / 2;
  const furos = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => `<circle class="l" cx="${f(i * fu / 2)}" cy="${f(190 + j * fu / 2)}" r="6"/>`).join('');
  return { titulo: 'Pé do prumo — sapata', nota: `Chapa ${lado}×${lado}×${e}, 4 furos Ø12 para bucha M10, cordão a3 a toda a volta — [A CONFIRMAR] conforme o suporte.`, w: lado + 120, h: lado + 250,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0 - 60)} -40 ${lado + 120} ${lado + 250}">${estilo}
<rect class="l" x="${f(-a / 2)}" y="-40" width="${f(a)}" height="110"/><rect class="c" x="${f(x0)}" y="70" width="${lado}" height="${e}"/>
<rect class="h" x="${f(x0 - 40)}" y="${70 + e}" width="${lado + 80}" height="26"/>
${[-1, 1].map(i => `<line x1="${f(i * fu / 2)}" y1="62" x2="${f(i * fu / 2)}" y2="${70 + e + 24}" stroke="#111" stroke-width="2.2"/>`).join('')}
<line class="e" x1="0" y1="-40" x2="0" y2="${190 + lado / 2 + 12}"/>
${cotaH(-a / 2, a / 2, -22, f(a))}${cotaH(x0, -x0, 122, lado)}
<rect class="c" x="${f(x0)}" y="${f(190 - lado / 2)}" width="${lado}" height="${lado}"/><rect class="l" x="${f(-a / 2)}" y="${f(190 - a / 2)}" width="${f(a)}" height="${f(a)}"${prumo.redondo ? ` rx="${f(a / 2)}"` : ''}/>
${furos}${cotaH(-fu / 2, fu / 2, 190 + lado / 2 + 22, fu)}</svg>` };
}
