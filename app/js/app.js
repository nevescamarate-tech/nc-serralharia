// NC Serralharia — navegação e ecrãs.
import * as store from './store.js';
import { calcular, TIPOS } from './calc.js';
import { planoCorte } from './corte.js';
import { custo, listaMaterial, horasEstimadas, capitulos } from './custo.js';
import { alcadoSVG, plantaSVG } from './desenho2d.js';
import { desenharFormulario } from './formularios.js';
import { folhaPreparacao, folhaProposta, descricaoMaterial } from './folhas.js';
import { PERFIS, MATERIAIS, CORES_RAL, ACESSORIOS, PAINEIS, acabamentoDe } from './catalogo.js';
import { esc, dec, eur, dataPT, logoSVG } from './fmt.js';
import { num } from './modelos/util.js';
import { verificar, CARGAS_GUARDA, DEF_VERIF } from './verificacao.js';
import { temPin, quemE, esperaSegundos, registarFalha, limparFalhas } from './pin.js';
import { guardarFoto, lerFoto, apagarFotos, copiarFotos, MAX_FOTOS } from './fotos.js';

const $ = (s, el = document) => el.querySelector(s);
const ecra = $('#ecra'), clone = o => JSON.parse(JSON.stringify(o));
let vista = null;          // vista 3D aberta
let limpar = null;         // função de limpeza do ecrã atual

function ir(h) { location.hash = h; }
function topo(titulo, voltar) {
  return `<header class="topo">${voltar ? `<a class="voltar" href="${voltar}" aria-label="Voltar">‹</a>` : `<span class="marca-nc">${logoSVG({ texto: false, altura: 34 })}</span>`}
<h1>${esc(titulo)}</h1></header>`;
}
function aviso(msg) {
  const t = $('#aviso'); t.textContent = msg; t.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { t.hidden = true; }, 3500);
}

function falhaGravar() { aviso('Não foi possível guardar neste aparelho. Verifique o espaço livre.'); }

// ---------- cálculo de um trabalho ----------
function contas(trabalho) {
  const res = calcular(trabalho), pr = trabalho.precos;
  const plano = planoCorte(res.pecas, { vara: pr.vara, serra: pr.serra });
  return { res, plano, c: custo(trabalho, res, plano, pr) };
}
function descricao(trabalho, res) {
  const m = trabalho.medidas, mm = v => dec(num(v, 0) / 1000) + ' m';
  const ench = { varoes: 'varões verticais', barras: 'barras horizontais', vidro: 'vidro laminado', chapa: 'chapa', laminas: 'lâminas horizontais', almofadas: 'almofadas de chapa quinada', nenhum: '' };
  const e = ench[m.enchimento] ? `, com enchimento em ${ench[m.enchimento]}` : '';
  if (trabalho.tipo === 'guarda') return `Guarda com ${mm(res.comprimentoTotal)} de comprimento e ${mm(res.altura)} de altura${e}.`;
  if (trabalho.tipo === 'corrimao') return `Corrimão com ${mm(res.comprimentoTotal)} de comprimento, ${m.montagem === 'prumos' ? 'sobre prumos' : 'fixo à parede'}.`;
  if (trabalho.tipo === 'tubagem') { const n = ref => (res.acessorios.find(a => a.ref === ref) || { qtd: 0 }).qtd;
    return `Tubagem soldada DN${res.dn} (Ø${dec(res.de, 1)} × ${dec(res.esp, 1)} mm) com ${mm(res.comprimentoTotal)}, ${n('curva_inox')} curva(s), ${n('flange_inox')} flange(s) e ${n('te_inox')} tê(s).`; }
  if (trabalho.tipo === 'guardamuro') return `Guarda de barras verticais com ${mm(res.comprimentoTotal)} e ${mm(res.altura)} acima do muro, em ${res.guardaMuro.modulos} módulo(s), fixada em rasgo selado com grout.`;
  if (trabalho.tipo === 'abrigo') return `Abrigo em estrutura metálica com ${mm(res.comprimentoTotal)} × ${mm(res.largura)} e ${mm(res.altura)} de altura${m.porta ? ', com porta' : ''}${m.piso ? ', piso em chapa lacrimada' : ''}${m.revestimento === 'trapezoidal' ? ', paredes em chapa trapezoidal' : ''}${m.cobertura !== 'nenhuma' ? ' e cobertura' : ''}.`;
  if (trabalho.tipo === 'gradeamento') return `Gradeamento de muro com ${mm(res.comprimentoTotal)} em ${res.modulos} módulo(s) e ${mm(res.altura)} de altura, em ${m.enchimento === 'barras' ? 'barras horizontais' : 'varões verticais'}.`;
  if (trabalho.tipo === 'escada') return `Escada reta com ${res.escada.degraus} degraus em ${res.escada.gradil ? 'gradil' : 'chapa lacrimada'} (espelho ${dec(res.escada.espelho, 0)} mm, cobertor ${dec(res.escada.cobertor, 0)} mm), ${mm(res.largura)} de largura e ${mm(res.altura)} de desnível${res.escada.central ? ', sobre viga central' : ''}${res.escada.patamar ? ', com patamar de ' + mm(res.escada.patamar) + (res.escada.emL ? ' × ' + mm(res.escada.patamarLargura) + ' em L' : '') : ''}${res.escada.guardas ? ', com guarda de barras verticais ' + (res.escada.guardas === 2 ? 'dos dois lados' : 'de um lado') : ''}.`;
  if (trabalho.tipo === 'grade') return `${res.unidades > 1 ? res.unidades + ' grades fixas' : 'Grade fixa'} de ${mm(res.largura)} × ${mm(res.altura)}, em varões verticais, com patas de fixação.`;
  if (trabalho.tipo === 'telheiro') { const cb = { sandwich: 'cobertura em painel sandwich', trapezoidal: 'cobertura em chapa trapezoidal', ripado: 'ripado', nenhuma: 'sem cobertura' }[m.cobertura] || '';
    return `${+res.pendente ? 'Telheiro' + (res.aguas === 2 ? ' de duas águas' : '') : 'Pérgula'} com ${mm(res.comprimentoTotal)} × ${mm(res.largura)} e ${mm(res.altura)} de altura livre, ${cb}${m.apoio === 'parede' ? ', encostado à parede' : ''}.`; }
  const tp = { batente1: 'de batente com 1 folha', batente2: 'de batente com 2 folhas', correr: 'de correr' }[m.tipo] || '';
  return `Portão ${tp}, ${mm(m.largura)} × ${mm(res.altura)}${e}${m.motor ? ', preparado para motor' : ''}.`;
}

/** Junta um trabalho novo à obra e guarda. extra: { nome, notas, medidas } vindos de um desenho ou articulado. */
async function novoTrabalho(obra, tipo, extra = {}) {
  const precos = await store.lerPrecos();
  const t = { id: store.novoId(), tipo, nome: extra.nome || '', medidas: { ...clone(TIPOS[tipo].def), ...(extra.medidas || {}) },
    material: tipo === 'tubagem' ? 'inox304' : 'aco', acabamento: tipo === 'tubagem' ? 'nenhum' : tipo === 'telheiro' || tipo === 'escada' ? 'galvanizado' : 'pintado', cor: CORES_RAL[1].hex, corNome: CORES_RAL[1].ral, margem: precos.margem,
    horasOficina: null, horasMontagem: tipo === 'telheiro' ? 16 : tipo === 'escada' ? 8 : 4, semDeslocacao: obra.trabalhos.length > 0, notas: extra.notas || '', confirmar: extra.confirmar || '', precos, alterado: Date.now() };
  obra.trabalhos.push(t); obra.alterado = Date.now();
  await store.guardarObra(obra).catch(falhaGravar);
  return t;
}

// ---------- ecrã: obras ----------
async function ecraObras() {
  const obras = await store.listarObras(), dias = await store.diasSemCopia();
  ecra.innerHTML = `<header class="capa">${logoSVG({ altura: 150 })}</header>
${dias > 7 ? `<p class="faixa">Há alterações sem cópia de segurança há ${dias} dias. <a href="#/definicoes">Guardar cópia</a></p>` : ''}
<section class="lista">${obras.length ? obras.map(o => `<a class="cartao" href="#/obra/${o.id}"><strong>${esc(o.nome || 'Obra sem nome')}</strong>
<span>${esc(o.cliente || '')}</span><small>${o.trabalhos.length} trabalho(s) · ${esc(dataPT(o.data))}</small></a>`).join('')
    : '<p class="vazio">Ainda não há obras. Crie a primeira para começar a tirar medidas.</p>'}</section>
<button class="b-pri" id="nova">+ Nova obra</button>
<nav class="rodape"><a href="#/precos">Tabela de preços</a><a href="#/definicoes">Definições e cópias</a></nav>`;
  $('#nova').onclick = async () => {
    const n = (await store.listarObras()).length + 1, hoje = new Date();
    const o = { id: store.novoId(), cliente: '', nome: '', morada: '', numero: `${hoje.getFullYear()}/${String(n).padStart(3, '0')}`,
      data: hoje.toISOString().slice(0, 10), validade: 30, condicoes: '', trabalhos: [], alterado: Date.now() };
    await store.guardarObra(o); ir(`#/obra/${o.id}`);
  };
}

// ---------- ecrã: obra ----------
async function ecraObra(id) {
  const obra = await store.lerObra(id);
  if (!obra) return ir('#/');
  const guarda = () => { obra.alterado = Date.now(); return store.guardarObra(obra).catch(falhaGravar); };
  const linhas = obra.trabalhos.map(t => ({ t, ...contas(t) }));
  const comMedidas = linhas.filter(l => l.res.pecas.length);   // só estes entram no total e na proposta
  const total = comMedidas.reduce((s, l) => s + l.c.venda, 0), iva = comMedidas.reduce((s, l) => s + l.c.iva, 0);
  const campo = (k, rot, tipo = 'text') => `<label class="campo"><span>${rot}</span><input type="${tipo}" data-k="${k}" value="${esc(obra[k])}"></label>`;
  ecra.innerHTML = `${topo(obra.nome || 'Nova obra', '#/')}
<section class="bloco" id="dados">${campo('cliente', 'Cliente')}${campo('nome', 'Obra')}${campo('morada', 'Morada')}
<details class="mais"><summary>Dados da proposta</summary>${campo('numero', 'Número')}${campo('data', 'Data', 'date')}
<label class="campo"><span>Validade (dias)</span><input type="text" inputmode="numeric" data-k="validade" value="${esc(obra.validade)}"></label>
<label class="campo"><span>Condições</span><textarea data-k="condicoes" rows="3">${esc(obra.condicoes)}</textarea></label></details></section>
<h2>Trabalhos</h2>
<section class="lista">${linhas.length ? linhas.map(({ t, c, res }) => `<a class="cartao" href="#/trabalho/${obra.id}/${t.id}">
<strong>${esc(t.nome || TIPOS[t.tipo].nome)}</strong><span>${esc(TIPOS[t.tipo].nome)} · ${esc(descricaoMaterial(t))}</span>
<small>${res.pecas.length ? eur(c.venda) + ' sem IVA' : 'Faltam medidas'}</small></a>`).join('') : '<p class="vazio">Sem trabalhos. Escolha o tipo para começar.</p>'}</section>
<div class="tipos">${Object.entries(TIPOS).filter(([, t]) => !t.oculto).map(([k, t]) => `<button class="b-sec" data-tipo="${k}">+ ${t.nome}</button>`).join('')}</div>
<div class="tipos dois"><a class="b-sec" href="#/desenho/${obra.id}">Medir num desenho (DXF)</a><a class="b-sec" href="#/articulado/${obra.id}">Ler articulado (Excel)</a></div>
<a class="b-pri b-claude" href="#/claude/${obra.id}">Pedir solução ao Claude (foto ou descrição)</a>
${linhas.length ? `<section class="bloco totais"><div><span>Total sem IVA</span><strong>${eur(total)}</strong></div><div><span>Total com IVA</span><strong>${eur(total + iva)}</strong></div>
<button class="b-pri" id="proposta">Proposta para o cliente</button></section>` : ''}
<button class="b-sec largo" id="duplicar">Duplicar obra</button>
<button class="b-per" id="apagar">Apagar obra</button>`;
  $('#dados').oninput = e => { const k = e.target.dataset.k; if (!k) return; obra[k] = e.target.value; guarda(); if (k === 'nome') $('.topo h1').textContent = obra.nome || 'Nova obra'; };
  ecra.querySelectorAll('[data-tipo]').forEach(b => b.onclick = async () => {
    const t = await novoTrabalho(obra, b.dataset.tipo); ir(`#/trabalho/${obra.id}/${t.id}`);
  });
  const bp = $('#proposta');
  if (bp) bp.onclick = async () => {
    const { imagem3d } = await import('./vista3d.js');
    const ls = comMedidas.map(({ t, c, res }) => ({ nome: t.nome || TIPOS[t.tipo].nome, descricao: descricao(t, res),
      acabamento: descricaoMaterial(t), venda: c.venda, iva: c.iva, imagem: imagem3d(res, t, 640, 380) }));
    if (!ls.length) return aviso('Nenhum trabalho tem medidas.');
    mostrarFolha(folhaProposta(obra, ls, await store.lerEmpresa(), await store.lerPrecos()));
  };
  $('#duplicar').onclick = async () => {
    const c = clone(obra);
    c.id = store.novoId(); c.nome = (obra.nome || 'Obra') + ' (cópia)'; c.alterado = Date.now();
    for (const t of c.trabalhos) { t.id = store.novoId(); t.fotos = await copiarFotos(t.fotos); }
    await store.guardarObra(c).catch(falhaGravar); ir(`#/obra/${c.id}`);
  };
  $('#apagar').onclick = async () => {
    if (!confirm(`Apagar a obra «${obra.nome || 'sem nome'}» e os seus ${obra.trabalhos.length} trabalho(s)? Não pode ser desfeito.`)) return;
    await store.apagarObra(obra.id); ir('#/');
  };
}

// ---------- ecrã: trabalho ----------
async function ecraTrabalho(obraId, tid, sep = 'medidas') {
  const obra = await store.lerObra(obraId), t = obra && obra.trabalhos.find(x => x.id === tid);
  if (!t) return ir('#/');
  let pend = null, sujo = false, r = contas(t);
  const grava = () => { sujo = false; t.alterado = obra.alterado = Date.now(); return store.guardarObra(obra).catch(falhaGravar); };
  const guarda = () => { sujo = true; clearTimeout(pend); pend = setTimeout(grava, 350); };
  const seps = { medidas: 'Medidas', desenho: 'Desenho', tres: '3D', custo: 'Custo' };
  ecra.innerHTML = `${topo(t.nome || TIPOS[t.tipo].nome, `#/obra/${obra.id}`)}
<label class="campo linha-nome"><span>Nome do trabalho</span><input id="nome" value="${esc(t.nome)}" placeholder="ex.: ${{ guarda: 'varanda do 1.º andar', corrimao: 'escada interior', portao: 'entrada principal', tubagem: 'linha de água da cozinha', telheiro: 'telheiro do logradouro', grade: 'grades das janelas do rés-do-chão', escada: 'escada de acesso ao terraço', gradeamento: 'muro da frente', abrigo: 'abrigo do equipamento', guardamuro: 'guarda do muro da ribeira' }[t.tipo]}"></label>
<nav class="seps" role="tablist">${Object.entries(seps).map(([k, n]) => `<button role="tab" data-sep="${k}" aria-selected="${k === sep}">${n}</button>`).join('')}</nav>
<div id="avisos"></div>
<div class="trab"><section id="p-medidas" class="painel"><form id="form" class="bloco" onsubmit="return false"></form>
<label class="campo notas"><span>Notas para a oficina</span><textarea id="notas" rows="3">${esc(t.notas)}</textarea></label>
<label class="campo notas"><span>Antes de cortar: pontos a confirmar (um por linha)</span><textarea id="confirmar" rows="3" placeholder="ex.: tipo de suporte para as buchas">${esc(t.confirmar || "")}</textarea></label>
<h3>Fotos</h3><div id="fotos" class="fotos"></div>
<label class="b-sec ficheiro">+ Juntar fotos<input type="file" id="f-foto" accept="image/*" multiple></label>
<button class="b-per" id="apagar-t">Apagar este trabalho</button></section>
<section id="p-desenho" class="painel"><h3>${t.tipo === 'tubagem' ? 'Isométrico' : 'Alçado'}</h3><div class="des" id="alcado"></div><h3>Planta</h3><div class="des" id="planta"></div>
<div id="verif"></div>
<label class="campo notas"><span>Revisão do desenho</span><input id="rev" value="${esc(t.rev || "00")}" maxlength="4" style="max-width:120px"></label>
<button class="b-pri" id="prep">Preparação para a oficina (folhas A3)</button></section>
<section id="p-tres" class="painel"><div id="tres" class="tres"></div><button class="b-lig" id="centrar">Centrar vista</button><div class="bloco" id="acab"></div></section>
<section id="p-custo" class="painel"></section></div>`;

  function pintaAvisos() {
    const l = [...r.res.avisos, ...r.plano.avisos];
    if (r.c.semPreco.length) l.push('Sem preço na tabela: ' + r.c.semPreco.map(x => (ACESSORIOS[x] || MATERIAIS[x] || PAINEIS[x] || {}).nome || x).join(', ') + '.');
    $('#avisos').innerHTML = l.map(a => `<p class="alerta">${esc(a)}</p>`).join('');
  }
  function pintaVerif() {
    const caixa = $('#verif'); if (!caixa) return;
    const v = verificar(t, r.res);
    if (!v) { caixa.innerHTML = ''; return; }
    const vf = { ...DEF_VERIF, ...(t.verif || {}) }, guardaLike = ['guarda', 'gradeamento', 'guardamuro'].includes(t.tipo) || (t.tipo === 'escada' && r.res.escada.guardas);
    const campoG = guardaLike ? `<label class="campo"><span>Carga horizontal no corrimão</span><select data-vf="guarda">${CARGAS_GUARDA.map(([k, n]) => `<option value="${k}" ${+k === +vf.guarda ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : '';
    const campoN = (k, rot) => `<label class="campo"><span>${rot}</span><span class="entrada"><input type="text" inputmode="decimal" data-vf="${k}" value="${esc(String(vf[k]).replace('.', ','))}"><i>kN/m²</i></span></label>`;
    caixa.innerHTML = `<h3>Verificação simples <span class="etq ${v.ok ? 'neutra' : ''}">${v.ok ? 'passa' : 'não passa'}</span></h3>
<section class="bloco">${campoG}${t.tipo === 'telheiro' ? campoN('cobertura', 'Sobrecarga na cobertura (neve ou uso)') : ''}${t.tipo === 'escada' ? campoN('escada', 'Sobrecarga no lanço') : ''}</section>
<table class="tab"><tr><th>Peça</th><th>Perfil</th><th class="n">Esforço</th><th class="n">Aproveit.</th><th class="n">Flecha</th></tr>
${v.linhas.map(l => `<tr><td>${esc(l.elemento)}</td><td>${esc(l.perfil)}</td><td class="n">${esc(l.esforco)}</td><td class="n"><strong class="${l.ok ? '' : 'mau'}">${dec(l.ratio)}</strong></td><td class="n">${l.flecha === undefined ? '—' : `<span class="${l.flechaOk ? '' : 'mau'}">${dec(l.flecha, 1)} / ${dec(l.limite, 1)} mm</span>`}</td></tr>
${l.sugestao ? `<tr><td colspan="5" class="alerta">Não chega. Sugestão: ${esc(l.sugestao)}.</td></tr>` : ''}`).join('')}</table>
<p class="dica">Aproveitamento até 1,00 passa. ${v.notas.map(esc).join(' ')}</p>`;
    caixa.onchange = e => {
      const k = e.target.dataset.vf; if (!k) return;
      const n = +String(e.target.value).replace(',', '.');
      if (!(n > 0) || n > 50) { aviso('Valor inválido.'); return pintaVerif(); }
      t.verif = { ...(t.verif || {}), [k]: n }; pintaVerif(); guarda();
    };
  }
  function pintaDesenho() { $('#alcado').innerHTML = alcadoSVG(r.res); $('#planta').innerHTML = plantaSVG(r.res); pintaVerif(); }
  function pintaAcab() {
    const mat = MATERIAIS[t.material], ac = acabamentoDe(t.material, t.acabamento);
    $('#acab').innerHTML = `<label class="campo"><span>Material</span><select id="s-mat">${Object.entries(MATERIAIS).map(([k, m]) => `<option value="${k}" ${k === t.material ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></label>
<label class="campo"><span>Acabamento</span><select id="s-ac">${mat.acabamentos.map(a => `<option value="${a.id}" ${a.id === ac.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label>
${ac.comCor ? `<div class="campo"><span>Cor</span><div class="cores">${CORES_RAL.map(c => `<button type="button" class="cor" style="background:${c.hex}" data-cor="${c.hex}" data-nome="${c.ral}" aria-pressed="${c.hex === t.cor}" title="${c.ral} ${esc(c.nome)}"></button>`).join('')}
<label class="cor livre" title="Outra cor"><input type="color" id="c-livre" value="${esc(t.cor)}"></label></div><small id="cor-nome">${esc(t.corNome || '')}</small></div>` : ''}`;
    $('#s-mat').onchange = e => { t.material = e.target.value; t.acabamento = MATERIAIS[t.material].acabamentos[0].id; refresca(true); };
    $('#s-ac').onchange = e => { t.acabamento = e.target.value; refresca(true); };
    $('#acab').querySelectorAll('.cor[data-cor]').forEach(b => b.onclick = () => { t.cor = b.dataset.cor; t.corNome = b.dataset.nome; refresca(true); });
    const livre = $('#c-livre'); if (livre) livre.oninput = () => { t.cor = livre.value; t.corNome = 'Cor ' + livre.value; pinta3D(); guarda(); };
  }
  async function pinta3D() {
    if (!$('#p-tres').classList.contains('ativo')) return;
    try {
      if (!vista) { const { criarVista } = await import('./vista3d.js'); if (!$('#tres')) return; vista = criarVista($('#tres')); }
      vista.mostrar(r.res, t);
    } catch (e) { $('#tres').innerHTML = '<p class="vazio">Este aparelho não consegue mostrar o 3D.</p>'; }
  }
  function pintaCusto() {
    const c = r.c, mat = listaMaterial(r.res, t.material);
    const num = (id, rot, val, un, ph = '') => `<label class="campo"><span>${rot}</span><span class="entrada"><input type="text" inputmode="decimal" id="${id}" value="${esc(val ?? '')}" placeholder="${ph}"><i>${un}</i></span></label>`;
    $('#p-custo').innerHTML = `<h3>Lista de material</h3><table class="tab"><tr><th>Material</th><th class="n">Qtd.</th><th class="n">Total</th><th class="n">kg</th></tr>
${mat.map(l => `<tr><td>${esc(l.nome)}</td><td class="n">${l.qtd}</td><td class="n">${l.painel ? dec(l.m2) + ' m²' : dec(l.mTotal) + ' m'}</td><td class="n">${l.kg ? dec(l.kg, 1) : '—'}</td></tr>`).join('') || '<tr><td colspan="4">Sem medidas.</td></tr>'}</table>
<h3>Varas a comprar</h3><table class="tab"><tr><th>Perfil</th><th class="n">Varas</th><th class="n">Sobra</th></tr>
${r.plano.porPerfil.map(g => `<tr><td>${esc((PERFIS[g.perfil] || {}).nome || g.perfil)}</td><td class="n">${g.nVaras}</td><td class="n">${dec(g.desperdicio / 1000)} m</td></tr>`).join('')}</table>
<h3>Custo ${t.precos.exemplo ? '<span class="etq">preços de exemplo</span>' : ''}</h3>
<table class="tab"><tr><th>Parcela</th><th class="n">Qtd.</th><th class="n">Preço</th><th class="n">Total</th></tr>
${capitulos(c).map(k => `<tr class="cap"><td colspan="3">${k.n}. ${esc(k.nome)}<span class="pct">${dec(k.pct, 0)} %</span></td><td class="n">${dec(k.total)}</td></tr>` +
  k.linhas.map(l => `<tr class="sub"><td>${esc(l.desc)}</td><td class="n">${dec(l.qtd, l.un === 'un' ? 0 : 2)} ${l.un}</td><td class="n">${dec(l.pu)}</td><td class="n">${dec(l.total)}</td></tr>`).join('')).join('')}
<tr class="soma"><td colspan="3">Custo total</td><td class="n">${eur(c.total)}</td></tr></table>
<div class="bloco">${num('i-ho', 'Horas de oficina', t.horasOficina, 'h', 'estimativa: ' + dec(horasEstimadas(r.res), 1))}${num('i-hm', 'Horas de montagem', t.horasMontagem, 'h')}
<label class="campo marca"><input type="checkbox" id="i-desl" ${t.semDeslocacao ? '' : 'checked'}><span>Incluir deslocação neste trabalho</span></label>
${num('i-mg', 'Margem', t.margem, '%')}</div>
<section class="bloco totais"><div><span>Preço de venda sem IVA</span><strong>${eur(c.venda)}</strong></div>
<div><span>IVA ${dec(t.precos.iva, 0)}%</span><strong>${eur(c.iva)}</strong></div><div class="grande"><span>Total com IVA</span><strong>${eur(c.vendaIva)}</strong></div></section>
<button class="b-sec" id="comparar">Comparar com outras soluções</button><div id="solucoes"></div>
<button class="b-sec" id="excel">Exportar custo para Excel</button>
<button class="b-sec" id="atual">Atualizar preços pela tabela atual</button>`;
    const liga = (id, k, vazioNulo, minimo = 0) => { $(id).onchange = e => { const v = e.target.value.trim().replace(',', '.'); t[k] = v === '' ? (vazioNulo ? null : 0) : (Number.isFinite(+v) && +v >= minimo ? +v : t[k]); refresca(); }; };
    liga('#i-ho', 'horasOficina', true); liga('#i-hm', 'horasMontagem'); liga('#i-mg', 'margem', false, -100);
    $('#i-desl').onchange = e => { t.semDeslocacao = !e.target.checked; refresca(); };
    $('#atual').onclick = async () => { t.precos = await store.lerPrecos(); refresca(); aviso('Preços atualizados.'); };
    $('#comparar').onclick = async () => {
      if (!r.res.pecas.length) return aviso('Introduza primeiro as medidas.');
      const { compararSolucoes } = await import('./solucoes.js');
      const lista = compararSolucoes(t), atual = lista.find(x => x.atual), caixa = $('#solucoes');
      if (!caixa) return;
      caixa.innerHTML = `<h3>Outras soluções para as mesmas medidas</h3><table class="tab"><tr><th>Solução</th><th class="n">kg</th><th class="n">Preço sem IVA</th><th class="n">Diferença</th><th></th></tr>
${lista.map((s, i) => `<tr class="${s.atual ? 'cap' : ''}"><td>${esc(s.rotulo)}${s.passa === false ? ' <span class="etq">não passa na verificação</span>' : ''}</td><td class="n">${dec(s.kg, 0)}</td><td class="n">${eur(s.venda)}</td>
<td class="n">${s.atual ? 'atual' : (atual ? (s.venda >= atual.venda ? '+' : '−') + dec(Math.abs(s.venda - atual.venda), 0) + ' €' : '')}</td><td class="n">${s.atual ? '' : `<button type="button" class="b-lig" data-usar="${i}">Usar</button>`}</td></tr>`).join('')}</table>
<p class="dica">Mesmas medidas, margem e horas de montagem. Cada solução recalcula o material, o corte e o acabamento.</p>`;
      caixa.onclick = e => {
        const b = e.target.closest('[data-usar]'); if (!b) return;
        const s = lista[+b.dataset.usar];
        t.medidas = s.medidas; t.material = s.material; t.acabamento = s.acabamento;
        desenharFormulario($('#form'), t.tipo, t.medidas, () => { r = contas(t); pintaAvisos(); pintaDesenho(); pintaCusto(); guarda(); });
        refresca(true); aviso('Solução aplicada: ' + s.rotulo + '.');
      };
      caixa.scrollIntoView({ block: 'nearest' });
    };
    $('#excel').onclick = async () => {
      if (!r.res.pecas.length) return aviso('Introduza primeiro as medidas.');
      const [{ criarXLSX }, { livroCusto }] = await Promise.all([import('./xlsx.js'), import('./livro.js')]);
      const a = document.createElement('a'), nome = (t.nome || TIPOS[t.tipo].nome).replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'trabalho';
      a.href = URL.createObjectURL(new Blob([criarXLSX(livroCusto(obra, t, r.res, r.c))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `Custo ${nome}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); aviso('Excel guardado.');
    };
  }
  function refresca(acab) {
    r = contas(t); pintaAvisos(); pintaDesenho(); pintaCusto(); if (acab) pintaAcab(); pinta3D(); guarda();
  }
  const largo = () => matchMedia('(min-width: 1100px)').matches;
  function mudaSep(k) {
    if (k === 'medidas' && largo()) k = 'desenho';   // no computador as medidas estão sempre à vista
    ecra.querySelectorAll('.painel').forEach(p => p.classList.toggle('ativo', p.id === 'p-' + k));
    ecra.querySelectorAll('.seps button').forEach(b => b.setAttribute('aria-selected', b.dataset.sep === k));
    history.replaceState(null, '', `#/trabalho/${obra.id}/${t.id}/${k}`);
    if (k === 'tres') pinta3D();
  }
  desenharFormulario($('#form'), t.tipo, t.medidas, () => { r = contas(t); pintaAvisos(); pintaDesenho(); pintaCusto(); guarda(); });
  $('#nome').oninput = e => { t.nome = e.target.value; $('.topo h1').textContent = t.nome || TIPOS[t.tipo].nome; guarda(); };
  ecra.querySelectorAll('.seps button').forEach(b => b.onclick = () => mudaSep(b.dataset.sep));
  $('#notas').oninput = e => { t.notas = e.target.value; guarda(); };
  $('#rev').oninput = e => { t.rev = e.target.value.trim(); guarda(); };
  $('#confirmar').oninput = e => { t.confirmar = e.target.value; guarda(); };
  // fotos
  if (!Array.isArray(t.fotos)) t.fotos = [];
  async function pintaFotos() {
    const caixa = $('#fotos'); if (!caixa) return;
    const dados = await Promise.all(t.fotos.map(f => lerFoto(f.id)));
    if (!$('#fotos')) return;
    caixa.innerHTML = t.fotos.map((f, i) => `<figure>${dados[i] ? `<img src="${dados[i]}" alt="Foto ${i + 1}">` : '<p class="vazio">Foto em falta</p>'}
<input data-leg="${i}" value="${esc(f.legenda)}" placeholder="Legenda" aria-label="Legenda da foto ${i + 1}">
<button type="button" class="b-lig" data-tirar-foto="${i}">Remover</button></figure>`).join('');
  }
  $('#fotos').oninput = e => { const i = e.target.dataset.leg; if (i !== undefined) { t.fotos[+i].legenda = e.target.value; guarda(); } };
  $('#fotos').onclick = async e => {
    const b = e.target.closest('[data-tirar-foto]'); if (!b) return;
    const [f] = t.fotos.splice(+b.dataset.tirarFoto, 1); await apagarFotos([f]); guarda(); pintaFotos();
  };
  $('#f-foto').onchange = async e => {
    const fich = [...e.target.files]; e.target.value = '';
    let falhou = 0;
    for (const f of fich) {
      if (t.fotos.length >= MAX_FOTOS) { aviso(`Máximo de ${MAX_FOTOS} fotos por trabalho.`); break; }
      try { const nova = await guardarFoto(f); if (nova) t.fotos.push(nova); else falhou++; } catch (err) { falhou++; }
    }
    if (falhou) aviso(`${falhou} ficheiro(s) não puderam ser guardados como foto.`);
    guarda(); pintaFotos();
  };
  pintaFotos();
  $('#apagar-t').onclick = async () => {
    if (!confirm(`Apagar o trabalho «${t.nome || TIPOS[t.tipo].nome}»? Não pode ser desfeito.`)) return;
    clearTimeout(pend); sujo = false;
    await apagarFotos(t.fotos); obra.trabalhos = obra.trabalhos.filter(x => x.id !== t.id); obra.alterado = Date.now();
    await store.guardarObra(obra).catch(falhaGravar); ir(`#/obra/${obra.id}`);
  };
  $('#centrar').onclick = () => vista && vista.enquadrar();
  $('#prep').onclick = async () => {
    if (!r.res.pecas.length) return aviso('Introduza primeiro as medidas.');
    const { imagem3d } = await import('./vista3d.js');
    const fotos = [];
    for (const f of t.fotos || []) { const src = await lerFoto(f.id); if (src) fotos.push({ src, legenda: f.legenda }); }
    mostrarFolha(folhaPreparacao(obra, t, r.res, r.plano, imagem3d(r.res, t), await store.lerEmpresa(), fotos));
  };
  pintaAvisos(); pintaDesenho(); pintaAcab(); pintaCusto(); mudaSep(seps[sep] ? sep : 'medidas');
  limpar = () => { clearTimeout(pend); if (sujo) grava(); if (vista) { vista.destruir(); vista = null; } };
}

// ---------- folhas ----------
function ajustaFolha() {
  // as folhas A3 têm medidas reais (420 mm); no ecrã encolhem até caberem na janela
  const f = $('#folha'), a3 = f.querySelector('.a3');
  f.style.zoom = a3 ? Math.min(1, (window.innerWidth - 24) / (420 * 96 / 25.4)).toFixed(3) : '';
}
window.addEventListener('resize', () => { if (document.body.classList.contains('com-folha')) ajustaFolha(); });
function mostrarFolha(html) {
  $('#folha').innerHTML = html; ajustaFolha(); document.body.classList.add('com-folha'); window.scrollTo(0, 0);
}
$('#f-fechar').onclick = () => { document.body.classList.remove('com-folha'); $('#folha').innerHTML = ''; };
$('#f-imprimir').onclick = () => window.print();

// ---------- ecrã: preços ----------
async function ecraPrecos() {
  const p = await store.lerPrecos();
  const lin = (cam, rot, un) => { const v = cam.split('.').reduce((o, k) => (o || {})[k], p);
    return `<label class="campo"><span>${esc(rot)}</span><span class="entrada"><input type="text" inputmode="decimal" data-c="${cam}" value="${esc(String(v ?? '').replace('.', ','))}"><i>${un}</i></span></label>`; };
  ecra.innerHTML = `${topo('Tabela de preços', '#/')}
${p.exemplo ? '<p class="faixa">Estes são valores de exemplo. Substitua-os pelos seus; ficam guardados neste aparelho.</p>' : ''}
<form id="fp" onsubmit="return false">
<h2>Perfis, por kg</h2><section class="bloco">${Object.entries(MATERIAIS).map(([k, m]) => lin('kg.' + k, m.nome, '€/kg')).join('')}</section>
<h2>Chapa e vidro</h2><section class="bloco">${lin('m2.vidro', 'Vidro laminado', '€/m²')}${lin('m2.chapa_aco', 'Chapa de aço', '€/m²')}${lin('m2.chapa_inox', 'Chapa de inox', '€/m²')}${lin('m2.chapa_aluminio', 'Chapa de alumínio', '€/m²')}${lin('m2.sandwich', 'Painel sandwich de cobertura', '€/m²')}${lin('m2.trapezoidal', 'Chapa trapezoidal de cobertura', '€/m²')}${lin('m2.xps', 'Isolamento XPS 40 mm', '€/m²')}${lin('m2.lacrimada', 'Chapa lacrimada', '€/m²')}${lin('m2.gradil', 'Gradil eletrossoldado', '€/m²')}</section>
<h2>Mão de obra</h2><section class="bloco">${lin('horaOficina', 'Hora de oficina', '€/h')}${lin('horaMontagem', 'Hora de montagem', '€/h')}${lin('deslocacao', 'Deslocação', '€')}${lin('consumiveis', 'Consumíveis de oficina, sobre o material', '%')}</section>
<h2>Acabamentos</h2><section class="bloco">${lin('acabamento.pintado', 'Pintura', '€/m²')}${lin('acabamento.lacado', 'Lacagem', '€/m²')}${lin('acabamento.galvanizado', 'Galvanização', '€/kg')}${lin('acabamento.escovado', 'Inox escovado', '€/m²')}${lin('acabamento.polido', 'Inox polido', '€/m²')}${lin('acabamento.anodizado', 'Anodização', '€/m²')}${lin('acabamento.decapado', 'Decapagem e passivação', '€/m²')}</section>
<h2>Acessórios e ferragens</h2><section class="bloco">${Object.entries(ACESSORIOS).map(([k, a]) => lin('acessorios.' + k, a.nome, '€/' + a.un)).join('')}</section>
<h2>Regras</h2><section class="bloco">${lin('margem', 'Margem por omissão', '%')}${lin('iva', 'IVA', '%')}${lin('vara', 'Comprimento da vara', 'mm')}${lin('serra', 'Espessura do corte', 'mm')}
<label class="campo"><span>Cobrança do material</span><select data-c="materialModo"><option value="varas" ${p.materialModo === 'varas' ? 'selected' : ''}>Varas inteiras</option><option value="util" ${p.materialModo === 'util' ? 'selected' : ''}>Comprimento usado + desperdício</option></select></label>
${lin('desperdicio', 'Desperdício', '%')}</section></form>
<button class="b-per" id="repor">Repor valores de exemplo</button>`;
  $('#fp').onchange = async e => {
    const cam = e.target.dataset.c; if (!cam) return;
    const ks = cam.split('.'), ult = ks.pop(), alvo = ks.reduce((o, k) => o[k], p);
    if (e.target.tagName === 'SELECT') alvo[ult] = e.target.value;
    else { const v = +e.target.value.replace(',', '.'); if (e.target.value.trim() === '' || !Number.isFinite(v) || v < 0 || (ult === 'vara' && v < 500)) { e.target.classList.add('erro'); return aviso('Valor inválido.'); } e.target.classList.remove('erro'); alvo[ult] = v; }
    p.exemplo = false; await store.guardarPrecos(p); aviso('Guardado. Vale para os trabalhos novos.');
  };
  $('#repor').onclick = async () => { if (confirm('Repor todos os preços com os valores de exemplo?')) { await store.guardarPrecos(null); ecraPrecos(); } };
}

// ---------- ecrã: definições ----------
async function ecraDefinicoes() {
  const e = await store.lerEmpresa();
  const campo = (k, rot) => `<label class="campo"><span>${rot}</span><input data-k="${k}" value="${esc(e[k])}"></label>`;
  ecra.innerHTML = `${topo('Definições', '#/')}
<h2>Dados para as folhas</h2><section class="bloco" id="emp">${campo('morada', 'Morada')}${campo('telefone', 'Telefone')}${campo('email', 'E-mail')}${campo('nif', 'NIF')}${campo('desenhou', 'Desenhou (nome nas folhas de preparação)')}</section>
<h2>Cópia de segurança</h2><section class="bloco"><p>As obras ficam guardadas só neste aparelho. Guarde uma cópia com regularidade; o mesmo ficheiro serve para passar as obras para outro aparelho. A cópia leva também as fotos, os desenhos e os articulados.</p>
<button class="b-pri" id="exp">Guardar cópia num ficheiro</button>
<label class="b-sec ficheiro">Carregar cópia de um ficheiro<input type="file" id="imp" accept=".json,application/json"></label></section>`;
  ecra.insertAdjacentHTML('beforeend', `<h2>Acesso com PIN</h2><section class="bloco"><p>A app só abre com um dos PIN de acesso, e volta a pedi-lo depois de 5 minutos em segundo plano. Os PIN são fixos e iguais em todos os aparelhos; não podem ser criados nem alterados aqui. Para os trocar é preciso publicar uma versão nova da app.</p></section>`);
  // Ligação ao Claude: a chave é escrita pelo utilizador e fica só neste aparelho (não entra na cópia de segurança)
  const temChave = !!(await store.kv.ler('claudeChave'));
  ecra.insertAdjacentHTML('beforeend', `<h2>Ligação ao Claude</h2><section class="bloco"><p>Com uma chave da API do Claude (Anthropic), a app propõe soluções a partir de uma fotografia ou de uma descrição, no botão «Pedir solução ao Claude» de cada obra. A chave cria-se em console.anthropic.com, numa conta sua com pagamento por utilização; cada pedido custa alguns cêntimos.</p>
<label class="campo"><span>Chave da API (fica só neste aparelho)</span><input type="password" id="ch-claude" autocomplete="off" placeholder="${temChave ? 'já existe uma chave guardada' : 'sk-ant-…'}"></label>
<button class="b-sec" id="ch-guardar">Guardar chave</button><button class="b-lig" id="ch-apagar" ${temChave ? '' : 'hidden'}>Apagar a chave deste aparelho</button>
<p class="dica">A fotografia e o texto de cada pedido são enviados para a Anthropic. Quem tiver acesso a este aparelho desbloqueado pode usar a chave: guarde-a só em aparelhos seus.</p></section>`);
  $('#ch-guardar').onclick = async () => {
    const v = $('#ch-claude').value.trim();
    if (v.length < 20) return aviso('Cole a chave completa.');
    await store.kv.guardar('claudeChave', v); aviso('Chave guardada neste aparelho.'); ecraDefinicoes();
  };
  $('#ch-apagar').onclick = async () => { if (confirm('Apagar a chave do Claude deste aparelho?')) { await store.kv.guardar('claudeChave', null); ecraDefinicoes(); } };
  $('#emp').oninput = ev => { const k = ev.target.dataset.k; if (k) { e[k] = ev.target.value; store.guardarEmpresa(e); } };
  $('#exp').onclick = async () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([await store.exportar()], { type: 'application/json' }));
    a.download = `nc-serralharia-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000); aviso('Cópia guardada.');
  };
  $('#imp').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const txt = await f.text(), an = await store.analisarImport(txt); ev.target.value = '';
    if (!an.ok) return alert(an.erro + ' Nada foi alterado.');
    const comObras = (an.novas || an.atualizadas) && confirm(`O ficheiro tem ${an.novas} obra(s) nova(s) e ${an.atualizadas} mais recente(s) do que as deste aparelho. Juntar?`);
    const comPrecos = an.temPrecos && confirm('O ficheiro traz também a tabela de preços e os dados da empresa. Substituir os deste aparelho pelos do ficheiro?');
    if (!comObras && !comPrecos) return aviso(an.novas || an.atualizadas || an.temPrecos ? 'Nada foi alterado.' : 'O ficheiro não tem nada de novo.');
    if (comObras) await store.aplicarImport(txt, { comPrecos });
    else { const d = JSON.parse(txt); await store.guardarPrecos(d.precos); if (d.empresa) await store.guardarEmpresa(d.empresa); }
    aviso('Dados carregados.'); ecraDefinicoes();
  };
}

// ---------- navegação ----------
async function rota() {
  if (limpar) { try { limpar(); } catch (e) { /* segue */ } limpar = null; }
  document.body.classList.remove('com-folha');
  const [, a, b, c, d] = location.hash.split('/');
  try {
    if (a === 'obra') await ecraObra(b);
    else if (a === 'trabalho') await ecraTrabalho(b, c, d);
    else if (a === 'desenho' || a === 'articulado') { const m = await import('./importar.js'); await (a === 'desenho' ? m.ecraDesenho : m.ecraArticulado)(b, { ecra, topo, aviso, ir, novoTrabalho, aoSair: f => { limpar = f; } }); }
    else if (a === 'claude') { const m = await import('./assistente.js'); await m.ecraClaude(b, { ecra, topo, aviso, ir, novoTrabalho }); }
    else if (a === 'precos') await ecraPrecos();
    else if (a === 'definicoes') await ecraDefinicoes();
    else await ecraObras();
  } catch (e) {
    console.error(e);
    ecra.innerHTML = `${topo('Erro', '#/')}<p class="alerta">Não foi possível abrir este ecrã. Os dados guardados não foram alterados.</p>`;
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', rota);
window.addEventListener('pagehide', () => { if (limpar) { try { limpar(); } catch (e) { /* segue */ } } });
// ---------- bloqueio com PIN ----------
// A app só abre com um dos PIN fixos (js/acesso.js). Não há criação de PIN dentro da app.
const MIN_FORA = 5;            // minutos em segundo plano até voltar a pedir o PIN
let saiuEm = 0;
function trancar() {
  return new Promise(feito => {
    const f = $('#tranca'), campo = $('#tranca-pin'), msg = $('#tranca-msg'), botao = f.querySelector('button');
    $('#tranca-logo').innerHTML = logoSVG({ altura: 150 });
    document.body.classList.add('trancado'); f.hidden = false; campo.value = ''; msg.hidden = true;
    setTimeout(() => campo.focus(), 50);
    const diz = t => { msg.textContent = t; msg.hidden = false; };
    const tempo = s => (s > 90 ? Math.ceil(s / 60) + ' minutos' : s + ' segundos');
    f.onsubmit = async e => {
      e.preventDefault();
      if (botao.disabled) return;
      const falta = await esperaSegundos();
      if (falta > 0) return diz(`Demasiadas tentativas. Aguarde ${tempo(falta)}.`);
      botao.disabled = true; botao.textContent = 'A verificar…';
      let quem = null;
      try { quem = await quemE(campo.value); } finally { botao.disabled = false; botao.textContent = 'Entrar'; }
      if (quem !== null) { await limparFalhas(); f.hidden = true; document.body.classList.remove('trancado'); feito(); return; }
      campo.value = '';
      const espera = await registarFalha();
      diz(espera > 0 ? `PIN errado. Aguarde ${tempo(espera)} antes de tentar outra vez.` : 'PIN errado.');
    };
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { saiuEm = Date.now(); return; }
  if (saiuEm && Date.now() - saiuEm > MIN_FORA * 60000 && $('#tranca').hidden && temPin()) trancar();
});

await store.abrir();
if (temPin()) await trancar();
rota();
// No computador de desenvolvimento (localhost) o modo sem rede fica desligado, salvo com ?sw=1, para ver sempre a versão mais recente.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && location.protocol !== 'file:' && (!local || location.search.includes('sw=1'))) navigator.serviceWorker.register('./sw.js').catch(() => {});
