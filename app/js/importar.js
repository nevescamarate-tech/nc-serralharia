// Ecrãs de importação: desenho DXF com medição por toque, e articulado (Excel/CSV).
import * as store from './store.js';
import { lerDXF, eDWG, textoDeBytes, trocosDeMedicao } from './dxf.js';
import { lerCSV, lerXLSX, extrairLinhas, classificar, medidasDeLinha } from './articulado.js';
import { TIPOS } from './calc.js';
import { esc, dec } from './fmt.js';

const $ = (s, el = document) => el.querySelector(s);
const MAX_GUARDAR = 8e6;   // caracteres de DXF guardados no aparelho
const AVISO_DWG = 'Este ficheiro é um DWG, que a app ainda não lê. No programa de desenho use «Guardar como» DXF, ou converta-o com o ODA File Converter (gratuito), e carregue o DXF.';

// ====================== DESENHO ======================
export async function ecraDesenho(obraId, ctx) {
  const obra = await store.lerObra(obraId);
  if (!obra) return ctx.ir('#/');
  const guardado = await store.lerAnexo('dxf:' + obraId);
  ctx.ecra.innerHTML = `${ctx.topo('Desenho do projeto', `#/obra/${obra.id}`)}
<label class="b-sec ficheiro">Carregar desenho (DXF)<input type="file" id="d-fich" accept=".dxf,.dwg"></label>
<div id="d-msg"></div>
<div id="d-corpo" hidden>
<p class="dica">Toque nos pontos do desenho para medir. O toque agarra-se à ponta de linha mais próxima. Arraste para mover e afaste dois dedos para aproximar.</p>
<div class="tela"><canvas id="d-cv"></canvas></div>
<div class="barra"><button class="b-lig" id="d-desf">Desfazer ponto</button><button class="b-lig" id="d-limpa">Limpar medição</button><button class="b-lig" id="d-enq">Ver tudo</button></div>
<section class="bloco"><label class="campo"><span>Unidade do desenho</span><select id="d-un"><option value="1">Milímetros</option><option value="10">Centímetros</option><option value="1000">Metros</option><option value="25.4">Polegadas</option></select></label>
<div id="d-med" class="medidas"></div>
<div class="tipos"><button class="b-sec" data-criar="guarda">Criar guarda</button><button class="b-sec" data-criar="corrimao">Criar corrimão</button><button class="b-sec" data-criar="portao">Criar portão</button></div></section>
<details class="mais bloco"><summary>Camadas</summary><div id="d-cam" class="camadas"></div></details>
</div>`;
  const cv = $('#d-cv'), g = cv.getContext('2d');
  let des = null, fator = 1, ocultas = new Set(), pts = [], agarra = [], v = { cx: 0, cy: 0, k: 1 }, pedido = 0;

  const paraEcra = (x, y) => [(x - v.cx) * v.k + cv.clientWidth / 2, cv.clientHeight / 2 - (y - v.cy) * v.k];
  const paraMundo = (sx, sy) => [(sx - cv.clientWidth / 2) / v.k + v.cx, (cv.clientHeight / 2 - sy) / v.k + v.cy];
  function enquadra() {
    const l = des.limites, w = Math.max(l.x1 - l.x0, 1e-9), h = Math.max(l.y1 - l.y0, 1e-9);
    v = { cx: (l.x0 + l.x1) / 2, cy: (l.y0 + l.y1) / 2, k: Math.min(cv.clientWidth / w, cv.clientHeight / h) * 0.92 || 1 };
  }
  function pontosDeAgarrar() {
    agarra = [];
    for (const e of des.entidades) {
      if (ocultas.has(e.camada)) continue;
      if (e.tipo === 'linha') agarra.push([e.x1, e.y1], [e.x2, e.y2]);
      else if (e.tipo === 'poli') for (const p of e.pts) agarra.push(p);
      else if (e.tipo !== 'texto') agarra.push([e.x, e.y]);
    }
  }
  function pinta() { cancelAnimationFrame(pedido); pedido = requestAnimationFrame(desenha); }
  function desenha() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H || !des) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#222'; g.lineWidth = 1; g.beginPath();
    const textos = [];
    for (const e of des.entidades) {
      if (ocultas.has(e.camada)) continue;
      if (e.tipo === 'linha') { const [a, b] = paraEcra(e.x1, e.y1), [c, d] = paraEcra(e.x2, e.y2); g.moveTo(a, b); g.lineTo(c, d); }
      else if (e.tipo === 'poli') {
        e.pts.forEach((p, i) => { const [a, b] = paraEcra(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); });
        if (e.fechada) g.closePath();
      } else if (e.tipo === 'circulo') { const [a, b] = paraEcra(e.x, e.y), r = e.r * v.k; g.moveTo(a + r, b); g.arc(a, b, r, 0, Math.PI * 2); }
      else if (e.tipo === 'arco') {
        const [a, b] = paraEcra(e.x, e.y), r = e.r * v.k, a1 = e.a1 * Math.PI / 180, a2 = e.a2 * Math.PI / 180;
        g.moveTo(a + r * Math.cos(a1), b - r * Math.sin(a1)); g.arc(a, b, r, -a1, -a2, true);
      } else if (e.h * v.k >= 7 && textos.length < 1500) textos.push(e);
    }
    g.stroke();
    g.fillStyle = '#555';
    for (const e of textos) { const [a, b] = paraEcra(e.x, e.y); if (a < -200 || a > W || b < 0 || b > H + 40) continue; g.font = `${Math.min(e.h * v.k, 40)}px Helvetica, Arial, sans-serif`; g.fillText(e.t, a, b); }
    // medição
    if (pts.length) {
      g.strokeStyle = '#c0392b'; g.fillStyle = '#c0392b'; g.lineWidth = 2.5; g.beginPath();
      pts.forEach((p, i) => { const [a, b] = paraEcra(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); });
      g.stroke(); g.font = '600 13px Helvetica, Arial, sans-serif';
      pts.forEach((p, i) => {
        const [a, b] = paraEcra(p[0], p[1]); g.beginPath(); g.arc(a, b, 5, 0, Math.PI * 2); g.fill();
        if (i) { const [c, d] = paraEcra(pts[i - 1][0], pts[i - 1][1]), txt = dec(Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) * fator, 0);
          const tw = g.measureText(txt).width; g.fillStyle = '#fff'; g.fillRect((a + c) / 2 - tw / 2 - 3, (b + d) / 2 - 18, tw + 6, 17); g.fillStyle = '#c0392b'; g.fillText(txt, (a + c) / 2 - tw / 2, (b + d) / 2 - 5); }
      });
    }
  }
  function pintaMedidas() {
    const tr = trocosDeMedicao(pts, fator), total = tr.reduce((s, t) => s + t.comp, 0);
    $('#d-med').innerHTML = tr.length ? `<table class="tab">${tr.map((t, i) => `<tr><td>Troço ${i + 1}${i && t.viragem ? ` <small>(vira ${dec(Math.abs(t.viragem), 0)}° à ${t.viragem > 0 ? 'direita' : 'esquerda'})</small>` : ''}</td><td class="n">${dec(t.comp, 0)} mm</td></tr>`).join('')}
<tr class="soma"><td>Total</td><td class="n">${dec(total, 0)} mm</td></tr></table>` : '<p class="vazio">Ainda sem medições.</p>';
    ctx.ecra.querySelectorAll('[data-criar]').forEach(b => { b.disabled = !tr.length; });
  }
  function pintaCamadas() {
    $('#d-cam').innerHTML = des.camadas.map(c => `<label class="campo marca"><input type="checkbox" data-cam="${esc(c.nome)}" ${ocultas.has(c.nome) ? '' : 'checked'}><span>${esc(c.nome)} <small>(${c.total})</small></span></label>`).join('');
  }
  function guardaEstado(nome, texto) {
    if (texto.length > MAX_GUARDAR) return ctx.aviso('Desenho grande: fica aberto agora, mas não fica guardado no aparelho.');
    store.guardarAnexo('dxf:' + obraId, { nome, texto, fator }).catch(() => ctx.aviso('Não foi possível guardar o desenho no aparelho.'));
  }
  function abre(nome, texto, fatorGuardado) {
    const d = lerDXF(texto);
    if (d.erro) { $('#d-msg').innerHTML = `<p class="alerta">${esc(d.erro)}</p>`; return false; }
    des = d; pts = []; ocultas = new Set(d.camadas.filter(c => !c.visivel).map(c => c.nome));
    const l = d.limites, maior = Math.max(l.x1 - l.x0, l.y1 - l.y0);
    fator = fatorGuardado || d.fatorMM || (maior < 500 ? 1000 : 1);
    $('#d-un').value = String(fator); if ($('#d-un').value !== String(fator)) { $('#d-un').value = '1'; fator = 1; }
    $('#d-msg').innerHTML = `<p class="dica"><strong>${esc(nome)}</strong> · ${d.entidades.length} elementos, ${d.camadas.length} camadas.${d.fatorMM || fatorGuardado ? '' : ' <strong>Confirme a unidade do desenho</strong> antes de medir.'}${d.cortado ? ' Desenho muito grande: só parte foi lida.' : ''}</p>`;
    $('#d-corpo').hidden = false;
    pontosDeAgarrar(); enquadra(); pintaCamadas(); pintaMedidas(); pinta();
    return true;
  }

  // toque: arrastar move, dois dedos aproximam, toque curto mede
  const dedos = new Map(); let mexeu = false, distAnt = 0;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); dedos.set(e.pointerId, pos(e)); if (dedos.size === 1) mexeu = false; else mexeu = true; distAnt = 0; };
  cv.onpointermove = e => {
    if (!dedos.has(e.pointerId) || !des) return;
    const ant = dedos.get(e.pointerId), agora = pos(e); dedos.set(e.pointerId, agora);
    if (dedos.size === 1) {
      if (Math.hypot(agora[0] - ant[0], agora[1] - ant[1]) > 0) { v.cx -= (agora[0] - ant[0]) / v.k; v.cy += (agora[1] - ant[1]) / v.k; }
      if (Math.hypot(agora[0] - (cv._ini || agora)[0], agora[1] - (cv._ini || agora)[1]) > 8) mexeu = true;
    } else if (dedos.size === 2) {
      const [p1, p2] = [...dedos.values()], d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
      if (distAnt > 0 && d > 0) zoom(d / distAnt, mx, my);
      distAnt = d;
    }
    pinta();
  };
  cv.addEventListener('pointerdown', e => { if (dedos.size === 1) cv._ini = pos(e); });
  const larga = e => {
    const era = dedos.size; dedos.delete(e.pointerId); distAnt = 0;
    if (era === 1 && !mexeu && des && e.type === 'pointerup') {
      const [sx, sy] = pos(e); let melhor = null, dm = 22;
      for (const p of agarra) { const [a, b] = paraEcra(p[0], p[1]), d = Math.hypot(a - sx, b - sy); if (d < dm) { dm = d; melhor = p; } }
      pts.push(melhor ? [melhor[0], melhor[1]] : paraMundo(sx, sy)); pintaMedidas(); pinta();
    }
  };
  cv.onpointerup = larga; cv.onpointercancel = larga;
  function zoom(f, sx, sy) { const [wx, wy] = paraMundo(sx, sy); v.k = Math.min(Math.max(v.k * f, 1e-9), 1e9); const [nx, ny] = paraMundo(sx, sy); v.cx += wx - nx; v.cy += wy - ny; }
  cv.addEventListener('wheel', e => { if (!des) return; e.preventDefault(); const [sx, sy] = pos(e); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, sx, sy); pinta(); }, { passive: false });
  const obs = new ResizeObserver(pinta); obs.observe(cv);
  ctx.aoSair(() => { obs.disconnect(); cancelAnimationFrame(pedido); });

  $('#d-desf').onclick = () => { pts.pop(); pintaMedidas(); pinta(); };
  $('#d-limpa').onclick = () => { pts = []; pintaMedidas(); pinta(); };
  $('#d-enq').onclick = () => { if (des) { enquadra(); pinta(); } };
  $('#d-un').onchange = e => { fator = +e.target.value || 1; pintaMedidas(); pinta(); if (atual) guardaEstado(atual.nome, atual.texto); };
  $('#d-cam').onchange = e => { const c = e.target.dataset.cam; if (c === undefined) return; e.target.checked ? ocultas.delete(c) : ocultas.add(c); pontosDeAgarrar(); pinta(); };
  let atual = null;
  $('#d-fich').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (eDWG(f.name, bytes)) { $('#d-msg').innerHTML = `<p class="alerta">${esc(AVISO_DWG)}</p>`; return; }
    const texto = textoDeBytes(bytes);
    if (abre(f.name, texto)) { atual = { nome: f.name, texto }; guardaEstado(f.name, texto); }
  };
  ctx.ecra.querySelectorAll('[data-criar]').forEach(b => b.onclick = async () => {
    const tr = trocosDeMedicao(pts, fator); if (!tr.length) return;
    const tipo = b.dataset.criar, total = tr.reduce((s, t) => s + t.comp, 0);
    const medidas = tipo === 'guarda' ? { trocos: tr } : tipo === 'corrimao' ? { comp: total } : { largura: tr[0].comp };
    const t = await ctx.novoTrabalho(obra, tipo, { medidas, notas: `Medidas tiradas do desenho ${atual ? atual.nome : ''}.`.trim() });
    ctx.ir(`#/trabalho/${obra.id}/${t.id}`);
  });
  pintaMedidas();
  if (guardado && guardado.texto && abre(guardado.nome, guardado.texto, guardado.fator)) atual = { nome: guardado.nome, texto: guardado.texto };
}

// ====================== ARTICULADO ======================
const ETQ = { guarda: 'Guarda', corrimao: 'Corrimão', portao: 'Portão', outro: 'Serralharia' };

export async function ecraArticulado(obraId, ctx) {
  const obra = await store.lerObra(obraId);
  if (!obra) return ctx.ir('#/');
  let dados = (await store.lerAnexo('art:' + obraId)) || null, soSerr = true, limite = 200;
  ctx.ecra.innerHTML = `${ctx.topo('Articulado', `#/obra/${obra.id}`)}
<label class="b-sec ficheiro">Carregar articulado (Excel .xlsx ou CSV)<input type="file" id="a-fich" accept=".xlsx,.csv,.txt,.xls,.pdf"></label>
<div id="a-msg"></div><div id="a-corpo"></div>`;
  const guarda = () => store.guardarAnexo('art:' + obraId, dados).catch(() => ctx.aviso('Não foi possível guardar o articulado no aparelho.'));

  function pinta() {
    if (!dados) { $('#a-corpo').innerHTML = '<p class="vazio">Carregue o mapa de quantidades da obra. A app destaca as linhas de serralharia e cria os trabalhos a partir delas.</p>'; return; }
    const todas = dados.linhas.map((l, i) => ({ l, i, tipo: classificar(l.desc) })), serr = todas.filter(x => x.tipo);
    const lista = soSerr ? serr : todas;
    $('#a-msg').innerHTML = `<p class="dica"><strong>${esc(dados.nome)}</strong> · ${todas.length} linhas, ${serr.length} de serralharia.</p>
<label class="campo marca"><input type="checkbox" id="a-so" ${soSerr ? 'checked' : ''}><span>Mostrar só serralharia</span></label>`;
    $('#a-corpo').innerHTML = (lista.length ? lista.slice(0, limite).map(({ l, i, tipo }) => `<article class="cartao linha-art">
<strong>${l.art ? esc(l.art) + ' · ' : ''}${tipo ? `<span class="etq neutra">${ETQ[tipo]}</span>` : ''}${l.criado ? ' <span class="etq">trabalho criado</span>' : ''}</strong>
<span>${esc(l.desc)}</span><small>${l.qtd !== null ? dec(l.qtd, l.qtd % 1 ? 2 : 0) : '—'} ${esc(l.un)}</small>
<div class="criar"><select data-sel="${i}" aria-label="Tipo de trabalho">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${t.nome}</option>`).join('')}</select>
<button class="b-sec" data-linha="${i}">Criar trabalho</button></div></article>`).join('') : '<p class="vazio">Nenhuma linha de serralharia encontrada. Desligue o filtro para ver todas.</p>')
      + (lista.length > limite ? `<button class="b-sec largo" id="a-mais">Mostrar mais (${lista.length - limite})</button>` : '');
    $('#a-so').onchange = e => { soSerr = e.target.checked; limite = 200; pinta(); };
    const mais = $('#a-mais'); if (mais) mais.onclick = () => { limite += 200; pinta(); };
  }
  $('#a-corpo').onclick = async e => {
    const b = e.target.closest('[data-linha]'); if (!b) return;
    const i = +b.dataset.linha, l = dados.linhas[i], tipo = $(`[data-sel="${i}"]`).value;
    b.disabled = true;
    await ctx.novoTrabalho(obra, tipo, { nome: l.desc.slice(0, 60), medidas: medidasDeLinha(l, tipo),
      notas: `Articulado${l.art ? ' art. ' + l.art : ''}: ${l.desc}${l.qtd !== null ? ` — ${l.qtd} ${l.un}` : ''}` });
    l.criado = true; await guarda(); ctx.aviso('Trabalho criado na obra.'); pinta();
  };
  $('#a-fich').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const erro = m => { $('#a-msg').innerHTML = `<p class="alerta">${esc(m)}</p>`; };
    let linhas = [];
    if (/\.pdf$/i.test(f.name)) return erro('Articulados em PDF ainda não são lidos. Peça o mapa de quantidades em Excel ou exporte o PDF para Excel.');
    if (/\.xls$/i.test(f.name)) return erro('Ficheiros .xls antigos não são lidos. Abra-o no Excel e guarde como .xlsx.');
    if (/\.xlsx$/i.test(f.name)) {
      const r = await lerXLSX(await f.arrayBuffer());
      if (r.erro) return erro(r.erro);
      for (const folha of r.folhas) linhas.push(...extrairLinhas(folha.linhas));
    } else linhas = extrairLinhas(lerCSV(textoDeBytes(new Uint8Array(await f.arrayBuffer()))));
    if (!linhas.length) return erro('Não encontrei linhas de articulado neste ficheiro. Precisa de colunas de descrição, unidade e quantidade.');
    dados = { nome: f.name, linhas }; soSerr = true; limite = 200; await guarda(); pinta();
  };
  pinta();
}
