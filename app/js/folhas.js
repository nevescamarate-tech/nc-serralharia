// Folhas para imprimir: preparação (oficina) e proposta (cliente).
import { esc, dec, eur, dataPT, logoSVG } from './fmt.js';
import { MATERIAIS, acabamentoDe } from './catalogo.js';
import { superficieM2, pesoKg } from './custo.js';
import { listaPosicoes, aprovisionamento, notasFabrico, escalaPara, pormenorVao, pormenorPe, pormenorAlmofada, pormenorDegrau, pormenorRasgo, quadroResumo, sequenciaFabrico } from './preparacao.js';
import { alcadoSVG, plantaSVG, vistaTopoSVG } from './desenho2d.js';
import { TIPOS } from './calc.js';
import { verificar } from './verificacao.js';
import { T_INOX, T_FFD } from './modelos/flangeada.js';
import { fichaTroco, tabelaLigacoes } from './fichas.js';

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
const LETRA_TIPO = { guarda: 'G', corrimao: 'C', portao: 'P', tubagem: 'T', telheiro: 'TL', grade: 'GR', escada: 'E', gradeamento: 'GM', abrigo: 'AB', guardamuro: 'GB', livre: 'L', flangeada: 'F' };
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
  if (res.livre) imagem3d = '';   // sem desenho automático não há conjunto 3D que valha
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
  const resumo = `<h4>Quadro resumo</h4><table class="a3-t">${quadroResumo(trabalho, res).map(([a, b]) => `<tr><td>${esc(a)}</td><td class="n"><b>${esc(b)}</b></td></tr>`).join('')}</table>`;
  const vf = verificar(trabalho, res);
  const verif = vf ? `<h4>Verificação simples <span>${vf.ok ? 'passa' : 'NÃO PASSA'}</span></h4><table class="a3-t">${vf.linhas.map(l => `<tr><td>${esc(l.elemento)}<br>${esc(l.perfil)}</td><td class="n">${esc(l.esforco)}</td><td class="n"><b>${dec(l.ratio)}</b>${l.ok ? '' : ' ✗'}</td></tr>${l.sugestao ? `<tr><td colspan="3" class="av">Sugestão: ${esc(l.sugestao)}</td></tr>` : ''}`).join('')}</table>
<p>${vf.cargas.map(esc).join(' · ')}. Aproveitamento até 1,00 passa.</p><p>${esc(vf.notas[vf.notas.length - 1])}</p>` : '';
  const notas = resumo + verif + notasFabrico(trabalho, res).map(b => `<h4>${esc(b.titulo)}</h4>${b.linhas.map(l => `<p>${esc(l)}</p>`).join('')}`).join('');
  // avisos e notas vão para a coluna da esquerda, para a coluna das notas não chegar à legenda
  const porConfirmar = String(trabalho.confirmar || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 12);
  const avisosHtml = (porConfirmar.length ? `<h4>Antes de cortar — pontos a confirmar</h4>${porConfirmar.map(l => `<p class="av">[A CONFIRMAR] ${esc(l)}</p>`).join('')}` : '') +
    (avisos.length ? `<h4>Avisos</h4>${avisos.map(a => `<p class="av">${esc(a)}</p>`).join('')}` : '') +
    (trabalho.notas ? `<h4>Notas para a oficina</h4><p>${esc(trabalho.notas).replace(/\n/g, '<br>')}</p>` : '');
  const e1 = new Set(), CAB = imagem3d ? 12 : 20, RESTO = 34;
  const topo1 = imagem3d ? `<figure class="a3-v a3-3d"><figcaption><b>Conjunto</b> s/ escala</figcaption><img src="${imagem3d}" alt="Vista 3D"></figure>` : '';
  nova('Conjunto e lista de posições', `<div class="a3-g1"><div>${topo1}<h3>Lista de posições (peças a fabricar)</h3>${tabelaPosicoes(posicoes.slice(0, CAB))}
<p class="a3-n"><b>Peso do metal ≈ ${dec(kg, 1)} kg</b> · superfície a tratar ≈ ${dec(superficieM2(res), 1)} m²${posicoes.length > CAB ? ' · a lista continua na folha seguinte' : ''}. Comprimentos em mm, pela ponta mais comprida; 90° = corte em esquadria.</p>
${avisosHtml ? `<div class="a3-avisos">${avisosHtml}</div>` : ""}</div>
<aside class="a3-notas">${notas}</aside></div>`, e1);
  for (let i = CAB; i < posicoes.length; i += RESTO)
    nova('Lista de posições (continuação)', `<h3>Lista de posições (continuação)</h3>${tabelaPosicoes(posicoes.slice(i, i + RESTO))}`);

  // 2 — vistas e pormenores (no trabalho livre: o rascunho fotografado, porque não há desenho automático)
  const noRascunho = res.livre ? fotos.slice(0, 2) : [];
  if (res.livre) nova('Rascunho e fotografias', `<h3>Rascunho e fotografias</h3>${noRascunho.length
    ? `<div class="a3-rasc n${noRascunho.length}">${noRascunho.map(f => `<figure><img src="${esc(f.src)}" alt="">${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ''}</figure>`).join('')}</div>`
    : '<p class="a3-n">Trabalho livre: a aplicação não desenha esta peça. Junte a fotografia do rascunho com as medidas (separador Medidas, «Juntar fotos») para ela sair nesta folha.</p>'}
<p class="a3-n">As posições (P1, P2…, CH1…) são as da lista de posições da folha 1.</p>`);
  fotos = fotos.slice(noRascunho.length);
  const e2 = new Set(), pe = pormenorAlmofada(res) || pormenorDegrau(res) || pormenorRasgo(res) || pormenorPe(res), vao = pormenorVao(res);
  const alc = alcadoSVG(res, { fino: true, refs: refDe }), pla = plantaSVG(res, { fino: true });
  const topo = tub || res.cotasLateral ? null : vistaTopoSVG(res, { fino: true });
  let corpo2;
  if (tub) corpo2 = `${vista('Isométrico', alc, 392, 150, new Set(), 'Isométrico sem escala; cotas ao eixo, em mm.')}${vista('Planta', pla, 392, 60, e2)}`;
  else if (res.cotasLateral) {   // telheiro: alçado frontal, lateral e planta
    const refsL = new Map();
    const lat = { ...res, paineis: [], cotas: res.cotasLateral, pontos: (res.pontos || []).filter(p => p.sl).map(p => ({ ...p, s: p.sl })),
      pecas: res.pecas.filter(p => p.sl).map(p => { const c = { ...p, s: p.sl, ts: p.tl }; refsL.set(c, refDe.get(p)); return c; }) };
    corpo2 = `${vista('Alçado frontal', alc, 392, 92, e2)}<div class="a3-g3">${
      vista('Alçado lateral', alcadoSVG(lat, { fino: true, refs: refsL }), 125, 92, e2, `Pendente ${virg(res.pendente)} % · ${res.aguas === 2 ? 'cumeeira' : 'topo atrás'} a ≈ ${Math.round(res.alturaAlta)} mm.`)}${
      vista('Planta da estrutura', pla, 150, 92, e2, 'Sem a cobertura.')}${pe ? vista('Pormenor 1 — ' + pe.titulo.toLowerCase(), pe.svg, 90, 78, e2, pe.nota) : ''}</div>`;
  } else if (alto(alc)) {   // peça alta (portão, escada): alçado à esquerda, a toda a altura; o resto à direita
    const frente = res.escada && topo ? vista('Vista frontal (do pé da escada)', topo.svg, 180, 62, e2) : '';
    corpo2 = `<div class="a3-g2">${vista('Alçado', alc, 200, 212, e2)}<div>${vista('Planta', pla, 180, frente ? 38 : 45, e2)}${frente}${
      vao ? vista('Pormenor 1 — vão tipo', vao, 180, 70, e2, 'Vão livre entre montantes e folgas do enchimento.') : ''}${
      pe ? vista(`Pormenor ${vao ? 2 : 1} — ` + pe.titulo.toLowerCase(), pe.svg, 180, vao || frente ? 55 : 90, e2, pe.nota) : ''}</div></div>`;
  } else corpo2 = `${vista('Alçado', alc, 392, 112, e2)}<div class="a3-g3">${vista('Planta', pla, topo ? 130 : 150, 78, e2)}${
    topo ? vista(topo.largura < 400 ? 'Corte A-A' : 'Vista lateral', topo.svg, 40, 78, e2) : ''}${
    vao ? vista('Pormenor 1 — vão tipo', vao, topo ? 110 : 125, 78, e2, 'Vão livre entre montantes e folgas do enchimento.') : ''}${
    pe ? vista(`Pormenor ${vao ? 2 : 1} — ` + pe.titulo.toLowerCase(), pe.svg, vao ? 80 : 180, 70, e2, pe.nota) : ''}</div>`;
  if (!res.livre) nova(tub ? 'Isométrico e planta' : res.cotasLateral ? 'Alçados, planta e pormenores' : 'Alçado, planta e pormenores', corpo2, e2);

  // 2b — tubagem flangeada: troços, ligações com parafusaria e resumo de encomenda
  if (res.flangeada) {
    const fg = res.flangeada, pontas = t => t.ends.map(x => (typeof x === 'number' ? String(x) : '—')).join(' · ');
    const COR = { 'inox-inox': '#5e9732', 'inox-FFD': '#e69500', 'ferro-ferro': '#8c8c8c' }, NOME = { 'inox-inox': 'inox – inox', 'inox-FFD': 'inox – ferro fundido', 'ferro-ferro': 'ferro – ferro' };
    const aviso = '<p class="av"><b>MEDIDAS DE PROJETO – A CONFIRMAR EM OBRA.</b> Não fabricar nem encomendar troços por medida sem verificação no local.</p>';
    const tTrocos = `<h3>Troços a fabricar</h3><table class="a3-t"><tr><th>Troço</th><th>Descrição</th><th>DN</th><th class="n">Comprimento (mm)</th><th>Ligações</th></tr>
${fg.trocos.map(t => `<tr><td><b>${esc(t.id)}</b></td><td>${esc(t.nome)}</td><td>${esc(t.dn)}</td><td class="n">${esc(t.L)}</td><td>${esc(pontas(t))}${t.ends.filter(x => typeof x !== 'number').map(x => `<br><small>${esc(x.livre)}</small>`).join('')}</td></tr>`).join('')}</table>
<p class="a3-n">Tubo reto: comprimento de flange a flange. Peças com curva: medidas ao eixo (curvas de raio 1,5 × DN).</p>
${fg.equipamentos.length ? `<h3>Equipamentos na linha (fornecimento à parte)</h3><table class="a3-t"><tr><th>Equipamento</th><th>DN</th><th class="n">Face a face (mm)</th><th>Ligações</th></tr>
${fg.equipamentos.map(q => `<tr><td>${esc(q.nome)}</td><td>DN${q.dn} PN${fg.pn}</td><td class="n">${Math.round(q.comp)}</td><td>${q.ligs.join(' · ')}</td></tr>`).join('')}</table>` : ''}`;
    const linhaLig = l => `<tr><td><b style="color:${COR[l.tipo]}">${l.n}</b></td><td>${NOME[l.tipo]}</td><td>${esc(l.entre[0])} ↔ ${esc(l.entre[1])}</td><td>DN${l.dn} PN${l.pn}<br><small>Ø${l.flange.D} · K ${l.flange.K} · ${l.flange.n} furos Ø${l.flange.h}</small></td>
<td>${l.kit ? `<b>Kit de isolamento</b>: junta isolante + ${l.flange.n} mangas + ${2 * l.flange.n} anilhas isolantes` : 'Junta plana EPDM e=3 (água potável)'}</td><td><b>${l.parafuso.n} × M${l.parafuso.M} × ${l.parafuso.L}</b> A4-70<br><small>${l.parafuso.n} porcas + ${2 * l.parafuso.n} anilhas A4</small></td></tr>`;
    const cabLig = '<tr><th>N.º</th><th>Tipo</th><th>Entre</th><th>Flange EN 1092-1</th><th>Junta</th><th>Parafusaria</th></tr>';
    const PRIM = 12, RESTO = 20;
    nova('Troços e ligações', `<div class="a3-g1"><div>${aviso}${tTrocos}</div><aside class="a3-notas"><h4>Flanges</h4><p>Do lado do inox: flange solta EN 1092-1 tipo 02 PN${fg.pn} + colar de soldar tipo 32, no material da tubagem.</p><p>Do lado do ferro fundido ou do equipamento: flange EN 1092-2 PN${fg.pn}.</p>
<h4>Ligações</h4><p><b style="color:#5e9732">Inox – inox</b>: junta EPDM.</p><p><b style="color:#e69500">Inox – ferro fundido</b>: kit de isolamento, para não haver contacto entre os dois metais.</p><p><b style="color:#8c8c8c">Ferro – ferro</b>: junta EPDM.</p><p>Parafusaria A4-70 em todas.</p></aside></div>
<h3>Ligações, flanges e parafusaria</h3><table class="a3-t">${cabLig}${fg.ligacoes.slice(0, PRIM).map(linhaLig).join('')}</table>${fg.ligacoes.length > PRIM ? '<p class="a3-n">As ligações continuam na folha seguinte.</p>' : ''}`);
    for (let i = PRIM; i < fg.ligacoes.length; i += RESTO)
      nova('Ligações (continuação)', `<h3>Ligações, flanges e parafusaria (continuação)</h3><table class="a3-t">${cabLig}${fg.ligacoes.slice(i, i + RESTO).map(linhaLig).join('')}</table>`);
    // uma ficha por troço: o desenho só dessa peça e as suas ligações (duas fichas por folha)
    const fichas = fg.trocos.map(t => fichaTroco(res, t.id)).filter(Boolean);
    for (let i = 0; i < fichas.length; i += 2)
      nova(`Fichas dos troços ${fichas.slice(i, i + 2).map(x => x.troco.id).join(' e ')}`, `<div class="a3-fichas">${fichas.slice(i, i + 2).map(x => `<div><h3>Ficha do troço ${esc(x.troco.id)} — ${esc(x.troco.nome)}</h3>
<p class="a3-n">${esc(x.troco.dn)} · comprimento ${esc(x.troco.L)} mm${x.troco.angulos && x.troco.angulos.length ? ' · curvas: ' + x.troco.angulos.map(a => String(a).replace('.', ',') + '°').join(', ') : ''}</p>
${vista('Isométrico do troço', x.svg, 190, 95, new Set(), 'Sem escala; cotas ao eixo e à face das flanges, em mm.')}<div class="a3-flanges">${x.flanges.map(q => q.svg).join('')}</div>${tabelaLigacoes(x, 'a3-t')}</div>`).join('')}</div>`);
    const tb = (titulo, o, reserva = true) => (Object.keys(o).length ? `<h4>${titulo}</h4><table class="a3-t"><tr><th>Medida</th><th class="n">Quant.</th>${reserva ? '<th class="n">c/ reserva +10 %</th>' : ''}</tr>
${Object.entries(o).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v}</td>${reserva ? `<td class="n">${Math.ceil(v * 1.1)}</td>` : ''}</tr>`).join('')}</table>` : '');
    const dns = [...new Set(fg.ligacoes.map(l => l.dn))].sort((a, b) => a - b);
    nova('Resumo de encomenda', `<h3>Resumo de encomenda — flanges, juntas e parafusaria (${fg.ligacoes.length} ligações)</h3><div class="a3-g3">
<div>${tb('Parafusos sextavados A4-70 (ISO 4017) + porca ISO 4032 A4 + 2 anilhas ISO 7089 A4', fg.resumo.parafusos)}</div>
<div>${tb(`Flanges soltas EN 1092-1 tipo 02 PN${fg.pn} + colar tipo 32`, fg.resumo.flanges, false)}${tb('Juntas planas EPDM e=3 (água potável)', fg.resumo.juntas)}</div>
<div>${tb('Kits de isolamento (junta isolante + mangas + anilhas isolantes)', fg.resumo.kits)}</div></div>
<p class="av">PRESSUPOSTO — comprimento dos parafusos calculado com espessuras estimadas: flange inox tipo 02 + colar 32 = ${dns.map(x => `DN${x} ${T_INOX[x]}`).join(', ')} mm; flange de ferro fundido = ${dns.map(x => `DN${x} ${T_FFD[x]}`).join(', ')} mm; junta 3 mm; kit com 2 anilhas isolantes de 3 mm. Confirmar com as fichas técnicas antes de encomendar.</p>
<p class="a3-n">Mangas isolantes = n.º de parafusos de cada kit; anilhas isolantes = 2 × n.º de parafusos. A reserva é só indicativa.</p>`);
  }

  // 3 — aprovisionamento e corte (com continuação se não couber)
  const lado = `<aside class="a3-notas">${ap.chapas.length ? `<h4>Chapas e vidros</h4><table class="a3-t"><tr><th>Material</th><th class="n">Peças</th><th class="n">m²</th><th class="n">kg</th></tr>
${ap.chapas.map(c => `<tr><td>${esc(c.nome)}</td><td class="n">${c.qtd}</td><td class="n">${dec(c.m2)}</td><td class="n">${c.kg ? dec(c.kg, 1) : '—'}</td></tr>`).join('')}</table>` : ''}
${ap.compra.length ? `<h4>Ferragens e acessórios (compra)</h4><table class="a3-t"><tr><th>Descrição</th><th class="n">Qtd.</th><th>Un</th></tr>
${ap.compra.map(a => `<tr><td>${esc(a.nome)}</td><td class="n">${dec(a.qtd, a.qtd % 1 ? 2 : 0)}</td><td>${esc(a.un)}</td></tr>`).join('')}</table>` : ''}
<h4>Como ler</h4><p>Cada barra é uma vara. Os cortes levam a posição e o comprimento em mm. A cinzento, a sobra.</p>
<h4>Sequência de fabrico e montagem</h4><ol class="a3-seq">${sequenciaFabrico(trabalho, res).map(s => `<li>${esc(s)}</li>`).join('')}</ol></aside>`;
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
/** Só as cotas gerais (comprimento total, altura, troços): as de cada vão ou módulo ficam para a oficina. */
function cotasGerais(cotas = []) {
  const hs = cotas.filter(c => c.tipo === 'h'), max = Math.max(0, ...hs.map(c => c.nivel || 1));
  return cotas.filter(c => c.tipo !== 'h' || (c.nivel || 1) === max).map(c => (c.tipo === 'h' ? { ...c, nivel: 1 } : c));
}

/**
 * Desenho para o cliente aprovar: uma folha A4 por trabalho, com o 3D, o alçado e a planta só com as medidas gerais,
 * o material e o acabamento, e o espaço para a aprovação. Sem preços, lista de corte, posições nem notas da oficina.
 * itens: [{ trabalho, res, descricao, imagem (3D em data URL), fotos: [{ src }] (só no trabalho livre) }]
 */
export function folhaCliente(obra, itens, empresa) {
  return (itens || []).map(({ trabalho: t, res, descricao, imagem, fotos = [] }) => {
    const nome = t.nome || (TIPOS[t.tipo] || {}).nome || 'Trabalho';
    let corpo;
    if (res.livre) {
      corpo = fotos.length ? `<figure class="f-des"><img class="f-3d" src="${esc(fotos[0].src)}" alt="Rascunho"><figcaption>Rascunho</figcaption></figure>` : '';
    } else {
      const geral = { ...res, cotas: cotasGerais(res.cotas) };
      const tub = !!res.dn;
      corpo = `${imagem ? `<img class="f-3d" src="${imagem}" alt="Vista 3D">` : ''}
<figure class="f-des"><figcaption>${tub ? 'Isométrico' : 'Alçado'}</figcaption>${alcadoSVG(geral)}</figure>
<figure class="f-des f-planta"><figcaption>Planta</figcaption>${plantaSVG(geral)}</figure>`;
    }
    return `<article class="folha f-cliente">${cabecalho('Desenho para aprovação', obra, empresa)}
<h2>${esc(nome)} <small>${esc((TIPOS[t.tipo] || {}).nome || '')}</small></h2>
<p>${esc(descricao || '')}</p><p><strong>Material e acabamento:</strong> ${esc(descricaoMaterial(t))}.</p>
${corpo}
<p class="f-nota">Medidas em milímetros, sem escala. Desenho indicativo: as medidas finais são a confirmar em obra antes do fabrico.</p>
<table class="f-aprova"><tr><th colspan="2">Aprovação do cliente</th></tr><tr><td>Nome</td><td></td></tr><tr><td>Assinatura</td><td></td></tr><tr><td>Data</td><td></td></tr></table></article>`;
  }).join('');
}

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
