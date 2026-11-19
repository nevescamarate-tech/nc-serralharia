// Folhas para imprimir: preparação (oficina) e proposta (cliente).
import { esc, dec, eur, dataPT, logoSVG } from './fmt.js';
import { MATERIAIS, acabamentoDe } from './catalogo.js';
import { superficieM2, pesoKg } from './custo.js';
import { listaPosicoes, aprovisionamento, notasFabrico, escalaPara, pormenorVao, pormenorPe, pormenorAlmofada } from './preparacao.js';
import { alcadoSVG, plantaSVG } from './desenho2d.js';
import { TIPOS } from './calc.js';

function cabecalho(titulo, obra, empresa) {
  const e = empresa || {};
  return `<header class="f-cab"><div class="f-logo">${logoSVG({ altura: 90, cor: '#1a1a1a' })}</div>
<div class="f-emp">${[e.morada, e.telefone, e.email, e.nif ? 'NIF ' + e.nif : ''].filter(Boolean).map(esc).join('<br>')}</div></header>
<h1 class="f-tit">${esc(titulo)}</h1>
<table class="f-dados"><tr><th>Cliente</th><td>${esc(obra.cliente)}</td><th>Data</th><td>${esc(dataPT(obra.data))}</td></tr>
<tr><th>Obra</th><td>${esc(obra.nome)}</td><th>N.º</th><td>${esc(obra.numero)}</td></tr>
<tr><th>Morada</th><td colspan="3">${esc(obra.morada)}</td></tr></table>`;
}

export function descricaoMaterial(trabalho) {
  const m = MATERIAIS[trabalho.material] || MATERIAIS.aco, a = acabamentoDe(trabalho.material, trabalho.acabamento);
  return `${m.nome}, ${a.nome.toLowerCase()}${a.comCor && trabalho.corNome ? ' ' + trabalho.corNome : ''}`;
}

// ---------- folhas A3 de preparação ----------
const LETRA_TIPO = { guarda: 'G', corrimao: 'C', portao: 'P', tubagem: 'T', telheiro: 'TL', grade: 'GR' };
const virg = (v, c = 1) => String(Math.round(v * 10 ** c) / 10 ** c).replace('.', ',');

/** Põe um SVG à escala normalizada que caiba na caixa (mm de papel). unidade = mm reais por unidade do viewBox. */
function aEscala(svg, caixaW, caixaH) {
  const m = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg || '');
  if (!m) return { svg: svg || '', n: 0 };
  const w = +m[3], h = +m[4], n = escalaPara(w, h, caixaW, caixaH);
  return { n, svg: svg.replace('<svg ', `<svg style="width:${virg(w / n, 2).replace(',', '.')}mm;height:${virg(h / n, 2).replace(',', '.')}mm" `) };
}
/** Verdadeiro se o desenho for mais alto do que metade da largura (não cabe bem numa faixa ao baixo). */
function alto(svg) { const m = /viewBox="[-\d.]+ [-\d.]+ ([-\d.]+) ([-\d.]+)"/.exec(svg || ''); return !!m && +m[2] > 0.5 * +m[1]; }
function vista(titulo, svg, caixaW, caixaH, escalas, nota = '') {
  const v = aEscala(svg, caixaW, caixaH);
  if (v.n) escalas.add(v.n);
  return `<figure class="a3-v"><figcaption><b>${esc(titulo)}</b>${v.n ? ` 1:${v.n}` : ''}</figcaption>${v.svg}${nota ? `<p class="a3-n">${esc(nota)}</p>` : ''}</figure>`;
}
function legenda(d, sub, escalas, n, total) {
  const es = [...escalas].sort((a, b) => a - b).map(x => '1:' + x).join(' · ') || 's/ escala';
  const c = (rot, val) => `<td><small>${rot}</small><b>${esc(val)}</b></td>`;
  return `<table class="a3-leg"><tr><td colspan="4"><div class="a3-emp">${logoSVG({ texto: false, altura: 26, cor: "#111" })}<span><b>NC</b> serralharia</span><i>desenho de preparação</i></div></td></tr>
<tr><td colspan="4" class="a3-tit"><b>${esc(d.titulo)}</b><span>${esc(sub)}</span><span>${esc(d.material)}</span></td></tr>
<tr>${c('Obra', d.obra)}${c('Cliente', d.cliente)}${c('Data', d.data)}${c('Folha', `${n}/${total}`)}</tr>
<tr>${c('Desenhou', d.desenhou)}${c('Escalas', es)}${c('Desenho n.º', d.numero)}<td><small>Rev. · Unid.</small><b>${esc(d.rev)} · mm</b></td></tr></table>`;
}
function tabelaPosicoes(pos) {
  return `<table class="a3-t"><tr><th>Pos.</th><th>Designação</th><th>Perfil / chapa</th><th class="n">Comp. / dim.</th><th class="n">Qtd.</th><th class="n">kg/un</th><th class="n">kg</th><th>Corte</th></tr>
${pos.map(p => `<tr><td><b>${p.ref}</b></td><td>${esc(p.designacao)}</td><td>${esc(p.perfil)}</td><td class="n">${esc(p.dim)}</td><td class="n">${p.qtd}</td><td class="n">${p.kgUn ? dec(p.kgUn, 2) : '—'}</td><td class="n">${p.kg ? dec(p.kg, 1) : '—'}</td><td>${esc(p.corte)}</td></tr>`).join('')}</table>`;
}
function blocoVaras(g) {
  const cab = `<h4>${esc(g.nome)} <span>${g.nVaras} vara(s) de ${virg(g.vara / 1000)} m · ${dec(g.kg, 1)} kg · sobra ${dec(g.sobraM)} m (${g.pct} %)</span></h4>`;
  const linhas = g.padroes.map(p => `<div class="a3-vara"><b>${p.vezes}×</b><div>${p.cortes.map(c => `<span style="flex:${Math.max(1, Math.round(c.L))} 0 0">${c.ref} · ${virg(c.L)}</span>`).join('')}${
    p.emenda ? `<span class="em" style="flex:0 0 auto">emenda: ${p.n} varas</span>` : p.sobra > 0 ? `<span class="so" style="flex:${p.sobra} 0 0">${p.sobra >= 250 ? 'sobra ' + p.sobra : ''}</span>` : ''}</div></div>`);
  return [{ html: cab + (linhas[0] || ''), alt: 15 }, ...linhas.slice(1).map(html => ({ html, alt: 8 }))];
}

/**
 * Preparação para a oficina em folhas A3 ao baixo: conjunto e posições, vistas e pormenores,
 * aprovisionamento e corte, fotos. Sem preços.
 */
export function folhaPreparacao(obra, trabalho, res, plano, imagem3d, empresa, fotos = []) {
  const tipo = (TIPOS[trabalho.tipo] || {}).nome || '', e = empresa || {}, tub = !!res.dn;
  const { posicoes, refDe } = listaPosicoes(res, trabalho.material);
  const ap = aprovisionamento(res, plano, trabalho.material, (trabalho.precos && +trabalho.precos.vara) || 6000);
  const idx = Math.max(0, (obra.trabalhos || []).findIndex(t => t.id === trabalho.id)) + 1;
  const d = { titulo: trabalho.nome || tipo, material: descricaoMaterial(trabalho), obra: obra.nome || '—', cliente: obra.cliente || '—',
    data: dataPT(trabalho.alterado || obra.data), desenhou: e.desenhou || '—', rev: trabalho.rev || '00',
    numero: `${obra.numero || ''}-${LETRA_TIPO[trabalho.tipo] || 'X'}${idx}` };
  const folhas = [];   // { sub, corpo, escalas }
  const nova = (sub, corpo, escalas = new Set()) => folhas.push({ sub, corpo, escalas });

  // 1 — conjunto, notas e lista de posições
  const kg = pesoKg(res, trabalho.material);
  const avisos = [...res.avisos, ...plano.avisos];
  const notas = notasFabrico(trabalho, res).map(b => `<h4>${esc(b.titulo)}</h4>${b.linhas.map(l => `<p>${esc(l)}</p>`).join('')}`).join('') +
    (avisos.length ? `<h4>Avisos</h4>${avisos.map(a => `<p class="av">${esc(a)}</p>`).join('')}` : '') +
    (trabalho.notas ? `<h4>Notas para a oficina</h4><p>${esc(trabalho.notas).replace(/\n/g, '<br>')}</p>` : '');
  const e1 = new Set(), CAB = imagem3d ? 13 : 20, RESTO = 34;
  const topo1 = imagem3d ? `<figure class="a3-v a3-3d"><figcaption><b>Conjunto</b> s/ escala</figcaption><img src="${imagem3d}" alt="Vista 3D"></figure>` : '';
  nova('Conjunto e lista de posições', `<div class="a3-g1"><div>${topo1}<h3>Lista de posições (peças a fabricar)</h3>${tabelaPosicoes(posicoes.slice(0, CAB))}
<p class="a3-n"><b>Peso do metal ≈ ${dec(kg, 1)} kg</b> · superfície a tratar ≈ ${dec(superficieM2(res), 1)} m²${posicoes.length > CAB ? ' · a lista continua na folha seguinte' : ''}. Comprimentos em mm, pela ponta mais comprida; 90° = corte em esquadria.</p></div>
<aside class="a3-notas">${notas}</aside></div>`, e1);
  for (let i = CAB; i < posicoes.length; i += RESTO)
    nova('Lista de posições (continuação)', `<h3>Lista de posições (continuação)</h3>${tabelaPosicoes(posicoes.slice(i, i + RESTO))}`);

  // 2 — vistas e pormenores
  const e2 = new Set(), pe = pormenorPe(res) || pormenorAlmofada(res), vao = pormenorVao(res);
  const alc = alcadoSVG(res, { fino: true, refs: refDe }), pla = plantaSVG(res, { fino: true });
  let corpo2;
  if (tub) corpo2 = `${vista('Isométrico', alc, 392, 150, new Set(), 'Isométrico sem escala; cotas ao eixo, em mm.')}${vista('Planta', pla, 392, 60, e2)}`;
  else if (res.cotasLateral) {   // telheiro: alçado frontal, lateral e planta
    const refsL = new Map();
    const lat = { ...res, paineis: [], cotas: res.cotasLateral, pontos: (res.pontos || []).filter(p => p.sl).map(p => ({ ...p, s: p.sl })),
      pecas: res.pecas.filter(p => p.sl).map(p => { const c = { ...p, s: p.sl, ts: p.tl }; refsL.set(c, refDe.get(p)); return c; }) };
    corpo2 = `${vista('Alçado frontal', alc, 392, 92, e2)}<div class="a3-g3">${
      vista('Alçado lateral', alcadoSVG(lat, { fino: true, refs: refsL }), 125, 92, e2, `Pendente ${virg(res.pendente)} % · topo da viga atrás a ≈ ${Math.round(res.alturaAlta)} mm.`)}${
      vista('Planta da estrutura', pla, 150, 92, e2, 'Sem a cobertura.')}${pe ? vista('Pormenor 1 — ' + pe.titulo.toLowerCase(), pe.svg, 90, 78, e2, pe.nota) : ''}</div>`;
  } else if (alto(alc)) {   // peça alta (portão): alçado à esquerda, a toda a altura; planta e pormenores à direita
    corpo2 = `<div class="a3-g2">${vista('Alçado', alc, 200, 212, e2)}<div>${vista('Planta', pla, 180, 45, e2)}${
      vao ? vista('Pormenor 1 — vão tipo', vao, 180, 70, e2, 'Vão livre entre montantes e folgas do enchimento.') : ''}${
      pe ? vista(`Pormenor ${vao ? 2 : 1} — ` + pe.titulo.toLowerCase(), pe.svg, 180, vao ? 60 : 90, e2, pe.nota) : ''}</div></div>`;
  } else corpo2 = `${vista('Alçado', alc, 392, 112, e2)}<div class="a3-g3">${vista('Planta', pla, 150, 78, e2)}${
    vao ? vista('Pormenor 1 — vão tipo', vao, 125, 78, e2, 'Vão livre entre montantes e folgas do enchimento.') : ''}${
    pe ? vista(`Pormenor ${vao ? 2 : 1} — ` + pe.titulo.toLowerCase(), pe.svg, vao ? 90 : 200, 70, e2, pe.nota) : ''}</div>`;
  nova(tub ? 'Isométrico e planta' : res.cotasLateral ? 'Alçados, planta e pormenores' : 'Alçado, planta e pormenores', corpo2, e2);

  // 3 — aprovisionamento e corte (com continuação se não couber)
  const lado = `<aside class="a3-notas">${ap.chapas.length ? `<h4>Chapas e vidros</h4><table class="a3-t"><tr><th>Material</th><th class="n">Peças</th><th class="n">m²</th><th class="n">kg</th></tr>
${ap.chapas.map(c => `<tr><td>${esc(c.nome)}</td><td class="n">${c.qtd}</td><td class="n">${dec(c.m2)}</td><td class="n">${c.kg ? dec(c.kg, 1) : '—'}</td></tr>`).join('')}</table>` : ''}
${ap.compra.length ? `<h4>Ferragens e acessórios (compra)</h4><table class="a3-t"><tr><th>Descrição</th><th class="n">Qtd.</th><th>Un</th></tr>
${ap.compra.map(a => `<tr><td>${esc(a.nome)}</td><td class="n">${dec(a.qtd, a.qtd % 1 ? 2 : 0)}</td><td>${esc(a.un)}</td></tr>`).join('')}</table>` : ''}
<h4>Como ler</h4><p>Cada barra é uma vara. Os cortes levam a posição e o comprimento em mm. A cinzento, a sobra.</p></aside>`;
  const blocos = ap.varas.flatMap(blocoVaras), paginas = [[]];
  let alt = 0;
  for (const b of blocos) { if (alt + b.alt > 205) { paginas.push([]); alt = 0; } paginas[paginas.length - 1].push(b.html); alt += b.alt; }
  paginas.forEach((p, i) => nova(i ? 'Lista de corte (continuação)' : 'Aprovisionamento e lista de corte',
    `<div class="a3-g1"><div><h3>${i ? 'Lista de corte por vara (continuação)' : 'Aprovisionamento — lista de corte por vara'}</h3>${p.join('') || '<p class="a3-n">Sem perfis para cortar.</p>'}</div>${i ? '' : lado}</div>`));

  // 4 — fotos de obra
  for (let i = 0; i < fotos.length; i += 6)
    nova('Fotos de obra', `<h3>Fotos de obra</h3><div class="a3-fotos">${fotos.slice(i, i + 6).map(f => `<figure><img src="${esc(f.src)}" alt="">${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ''}</figure>`).join('')}</div>`);

  return folhas.map((f, i) => `<section class="a3"><div class="a3-q"><div class="a3-corpo">${f.corpo}</div>
<footer class="a3-rod"><div class="a3-obs">${esc(tipo)} · ${esc(d.material)}<br>Cotas em mm. Confirmar as medidas em obra antes do fabrico.</div>${legenda(d, f.sub, f.escalas, i + 1, folhas.length)}</footer></div></section>`).join('');
}

/** Proposta para o cliente. Só preços de venda: nunca valores internos. */
export function folhaProposta(obra, linhas, empresa, precos) {
  const sub = linhas.reduce((s, l) => s + (+l.venda || 0), 0);
  // O IVA é o de cada trabalho (cópia de preços do trabalho), para bater com o ecrã.
  const proprio = linhas.some(l => Number.isFinite(l.iva));
  const iva = proprio ? linhas.reduce((s, l) => s + (+l.iva || 0), 0) : sub * (+precos.iva || 0) / 100;
  const taxa = proprio ? (sub > 0 ? Math.round(iva / sub * 1000) / 10 : 0) : (+precos.iva || 0);
  const corpo = linhas.map((l, i) => `<tr><td class="n">${i + 1}</td><td><strong>${esc(l.nome)}</strong><br>${esc(l.descricao)}<br><em>${esc(l.acabamento)}</em>
${l.imagem ? `<br><img class="f-mini" src="${l.imagem}" alt="">` : ''}</td><td class="n">${eur(l.venda)}</td></tr>`).join('');
  return `<article class="folha">${cabecalho('Proposta', obra, empresa)}
<table class="f-tab f-prop"><tr><th class="n">N.º</th><th>Descrição</th><th class="n">Valor</th></tr>${corpo}</table>
<table class="f-totais"><tr><th>Total sem IVA</th><td>${eur(sub)}</td></tr><tr><th>IVA ${dec(taxa, taxa % 1 ? 1 : 0)}%</th><td>${eur(iva)}</td></tr>
<tr class="f-total"><th>Total</th><td>${eur(sub + iva)}</td></tr></table>
<p class="f-nota">Validade da proposta: ${esc(obra.validade || 30)} dias.</p>
${obra.condicoes ? `<h3>Condições</h3><p>${esc(obra.condicoes).replace(/\n/g, '<br>')}</p>` : ''}</article>`;
}
