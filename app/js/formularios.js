// Formulários de medidas, definidos por tipo de trabalho.
import { PERFIS, DIAMETROS, ESPESSURAS } from './catalogo.js';
import { esc } from './fmt.js';

const N = (id, rotulo, o = {}) => ({ id, rotulo, tipo: 'num', un: 'mm', ...o });
const S = (id, rotulo, opcoes, o = {}) => ({ id, rotulo, tipo: 'sel', opcoes, ...o });
const P = (id, rotulo, formas, o = {}) => ({ id, rotulo, tipo: 'perfil', formas, ...o });
const TUBOS = ['tq', 'tret', 'tr'], FINOS = ['varao', 'vq', 'barra', 'tq'];

export const CAMPOS = {
  guarda: [
    { id: 'trocos', tipo: 'trocos' },
    N('altura', 'Altura da guarda'),
    S('enchimento', 'Enchimento', { varoes: 'Varões verticais', barras: 'Barras horizontais', vidro: 'Vidro laminado', chapa: 'Chapa', nenhum: 'Sem enchimento' }),
    S('fixacao', 'Fixação', { topo: 'Ao topo do pavimento (sapata)', lateral: 'Lateral (à testa da laje)' }),
    P('pPrumo', 'Perfil do prumo', TUBOS, { av: true }),
    P('pCorrimao', 'Perfil do corrimão', TUBOS, { av: true }),
    P('pTravessa', 'Perfil das travessas', TUBOS.concat('barra'), { av: true, se: m => ['varoes', 'chapa'].includes(m.enchimento) }),
    P('pVarao', 'Perfil dos varões / barras', FINOS, { av: true, se: m => ['varoes', 'barras'].includes(m.enchimento) }),
    N('nBarras', 'Número de barras', { un: '', av: true, se: m => m.enchimento === 'barras' }),
    N('maxPrumos', 'Afastamento máximo entre prumos', { av: true }),
    N('vaoMax', 'Vão livre máximo entre varões', { av: true, se: m => m.enchimento === 'varoes' }),
    N('baixo', 'Altura livre por baixo', { av: true }),
  ],
  corrimao: [
    N('comp', 'Comprimento (na horizontal)'),
    N('desnivel', 'Desnível (subida)', { livre: true }),
    N('altura', 'Altura do corrimão'),
    S('montagem', 'Montagem', { parede: 'Na parede, com suportes', prumos: 'Sobre prumos' }),
    S('extremidade', 'Extremidades', { tampa: 'Tampa', curva: 'Curva a 90° para a parede' }),
    P('tubo', 'Tubo do corrimão', ['tr', 'tq', 'tret'], { av: true }),
    P('pPrumo', 'Perfil do prumo', TUBOS, { av: true, se: m => m.montagem === 'prumos' }),
    N('maxSuportes', 'Afastamento máximo entre suportes', { av: true }),
  ],
  portao: [
    N('largura', 'Largura do vão'),
    N('altura', 'Altura do portão'),
    S('tipo', 'Tipo', { batente1: 'De batente, 1 folha', batente2: 'De batente, 2 folhas', correr: 'De correr' }),
    S('enchimento', 'Enchimento', { varoes: 'Varões verticais', chapa: 'Chapa lisa', laminas: 'Lâminas horizontais', almofadas: 'Almofadas em chapa quinada' }),
    N('nAlmofadas', 'Número de almofadas por folha (0 = automático)', { un: '', livre: true, se: m => m.enchimento === 'almofadas' }),
    { id: 'tardoz', rotulo: 'Chapa de trás rebitada', tipo: 'bool', se: m => m.enchimento === 'almofadas' },
    { id: 'isolamento', rotulo: 'Isolamento XPS no interior', tipo: 'bool', se: m => m.enchimento === 'almofadas' },
    N('relevo', 'Relevo das almofadas', { av: true, se: m => m.enchimento === 'almofadas' }),
    { id: 'pilares', rotulo: 'Com pilares novos', tipo: 'bool' },
    { id: 'motor', rotulo: 'Preparação para motor', tipo: 'bool' },
    P('pAro', 'Perfil do aro', TUBOS, { av: true }),
    P('pTravessa', 'Perfil das travessas', TUBOS, { av: true }),
    P('pVarao', 'Perfil dos varões', FINOS, { av: true, se: m => m.enchimento === 'varoes' }),
    P('pLamina', 'Perfil das lâminas', ['tret', 'barra'], { av: true, se: m => m.enchimento === 'laminas' }),
    P('pPilar', 'Perfil dos pilares', ['tq', 'tret'], { av: true, se: m => m.pilares }),
    N('vaoMax', 'Vão livre máximo entre varões', { av: true, se: m => m.enchimento === 'varoes' }),
    N('folgaLado', 'Folga lateral', { av: true }),
    N('folgaChao', 'Folga ao pavimento', { av: true }),
    N('sobreposicao', 'Sobreposição da folha de correr', { av: true, se: m => m.tipo === 'correr' }),
  ],
};

const PONTA = { livre: 'Livre (sem acessório)', flange: 'Flange', tampao: 'Tampão' };
CAMPOS.tubagem = [
  S('dn', 'Diâmetro nominal', Object.fromEntries(Object.entries(DIAMETROS).map(([dn, d]) => [dn, `DN${dn} (Ø${String(d.de).replace('.', ',')} mm)`]))),
  S('esp', 'Espessura da parede', Object.fromEntries(ESPESSURAS.map(e => [e, String(e).replace('.', ',') + ' mm']))),
  { id: 'trocos', tipo: 'trocos' },
  S('ini', 'Ponta inicial', PONTA),
  S('fim', 'Ponta final', PONTA),
  N('maxSuportes', 'Afastamento máximo entre abraçadeiras', { av: true }),
];

function campoNum(id, rotulo, valor, un, extra = '') {
  return `<label class="campo"><span>${esc(rotulo)}</span><span class="entrada"><input type="text" inputmode="decimal" autocomplete="off" data-id="${id}" value="${esc(valor ?? '')}" ${extra}>${un ? `<i>${un}</i>` : ''}</span></label>`;
}
function campoHTML(c, m) {
  if (c.se && !c.se(m)) return '';
  const v = m[c.id];
  if (c.tipo === 'num') return campoNum(c.id, c.rotulo, v, c.un);
  if (c.tipo === 'bool') return `<label class="campo marca"><input type="checkbox" data-id="${c.id}" ${v ? 'checked' : ''}><span>${esc(c.rotulo)}</span></label>`;
  let ops = '';
  if (c.tipo === 'sel') ops = Object.entries(c.opcoes).map(([k, n]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('');
  else ops = Object.values(PERFIS).filter(p => c.formas.includes(p.forma)).map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
  return `<label class="campo"><span>${esc(c.rotulo)}</span><select data-id="${c.id}">${ops}</select></label>`;
}
const DIRS_TUBO = { dir: 'Para a direita', esq: 'Para a esquerda', cima: 'Para cima', baixo: 'Para baixo', frente: 'Para a frente (afasta-se)', tras: 'Para trás (aproxima-se)' };
function trocosTuboHTML(m) {
  const lista = Array.isArray(m.trocos) && m.trocos.length ? m.trocos : [{ comp: '', dir: 'dir', tes: 0 }];
  return `<fieldset class="trocos"><legend>Percurso da tubagem (medidas eixo a eixo, de canto a canto)</legend>${lista.map((t, i) => `<div class="troco" data-i="${i}">
<div class="troco-cab"><strong>Troço ${i + 1}</strong>${lista.length > 1 ? `<button type="button" class="b-lig" data-tirar="${i}" aria-label="Remover troço ${i + 1}">Remover</button>` : ''}</div>
${campoNum('', 'Comprimento', t.comp, 'mm', `data-troco="${i}" data-k="comp"`)}
<label class="campo"><span>Direção</span><select data-troco="${i}" data-k="dir">${Object.entries(DIRS_TUBO).map(([k, n]) => `<option value="${k}" ${k === (t.dir || 'dir') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
${campoNum('', 'Tês (derivações) neste troço', t.tes || '', 'un', `data-troco="${i}" data-k="tes"`)}
</div>`).join('')}<button type="button" class="b-sec" data-juntar>+ Juntar troço</button></fieldset>`;
}
function trocosHTML(m, tipo) {
  if (tipo === 'tubagem') return trocosTuboHTML(m);
  const lista = Array.isArray(m.trocos) && m.trocos.length ? m.trocos : [{ comp: '' }];
  return `<fieldset class="trocos"><legend>Troços da guarda</legend>${lista.map((t, i) => `<div class="troco" data-i="${i}">
<div class="troco-cab"><strong>Troço ${i + 1}</strong>${lista.length > 1 ? `<button type="button" class="b-lig" data-tirar="${i}" aria-label="Remover troço ${i + 1}">Remover</button>` : ''}</div>
${campoNum('', 'Comprimento (na horizontal)', t.comp, 'mm', `data-troco="${i}" data-k="comp"`)}
${campoNum('', 'Desnível (subida; 0 se for plano)', t.desnivel || '', 'mm', `data-troco="${i}" data-k="desnivel"`)}
${i > 0 ? campoNum('', 'Viragem no canto (+ direita, − esquerda)', t.viragem || '', '°', `data-troco="${i}" data-k="viragem"`) : ''}
</div>`).join('')}<button type="button" class="b-sec" data-juntar>+ Juntar troço</button></fieldset>`;
}

/** Desenha o formulário em `el` e chama onChange(medidas) a cada alteração. */
export function desenharFormulario(el, tipo, medidas, onChange) {
  const campos = CAMPOS[tipo] || [];
  function pinta() {
    const base = campos.filter(c => !c.av).map(c => c.tipo === 'trocos' ? trocosHTML(medidas, tipo) : campoHTML(c, medidas)).join('');
    const av = campos.filter(c => c.av).map(c => campoHTML(c, medidas)).join('');
    const aberto = el.querySelector('details') && el.querySelector('details').open;
    el.innerHTML = `${base}<details class="mais" ${aberto ? 'open' : ''}><summary>Perfis e regras</summary>${av}</details>`;
  }
  pinta();
  el.oninput = e => {
    const t = e.target;
    if (t.dataset.troco !== undefined) {
      if (!Array.isArray(medidas.trocos) || !medidas.trocos.length) medidas.trocos = [{ comp: '' }];
      medidas.trocos[+t.dataset.troco][t.dataset.k] = t.value;
    } else if (t.dataset.id && t.type !== 'checkbox' && t.tagName !== 'SELECT') medidas[t.dataset.id] = t.value;
    else return;
    onChange(medidas);
  };
  el.onchange = e => {
    const t = e.target;
    if (t.dataset.troco !== undefined && t.tagName === 'SELECT') { medidas.trocos[+t.dataset.troco][t.dataset.k] = t.value; onChange(medidas); return; }
    if (!t.dataset.id) return;
    if (t.type === 'checkbox') medidas[t.dataset.id] = t.checked;
    else if (t.tagName === 'SELECT') medidas[t.dataset.id] = t.value;
    else return;
    pinta(); onChange(medidas);
  };
  el.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.juntar !== undefined) medidas.trocos = [...(medidas.trocos || [{ comp: '' }]), tipo === 'tubagem' ? { comp: '', dir: 'cima', tes: 0 } : { comp: '', desnivel: 0, viragem: 90 }];
    else if (t.dataset.tirar !== undefined) medidas.trocos.splice(+t.dataset.tirar, 1);
    else return;
    pinta(); onChange(medidas);
  };
}

CAMPOS.telheiro = [
  N('comp', 'Comprimento (ao comprido da frente)'),
  N('largura', 'Largura (profundidade, no sentido da água)'),
  N('altura', 'Altura livre à frente (lado baixo)'),
  N('pendente', 'Pendente (0 para pérgula plana)', { un: '%', livre: true }),
  S('aguas', 'Águas', { uma: 'Uma água (cai para a frente)', duas: 'Duas águas (cumeeira a meio)' }),
  S('apoio', 'Apoio', { pilares: 'Duas filas de pilares', parede: 'Encostado à parede (pilares só à frente)' }),
  S('cobertura', 'Cobertura', { sandwich: 'Painel sandwich', trapezoidal: 'Chapa trapezoidal', ripado: 'Ripado (pérgula, sem chapa)', nenhuma: 'Só a estrutura' }),
  P('pPilar', 'Perfil dos pilares', ['tq', 'tret', 'tr'], { av: true }),
  P('pViga', 'Perfil das vigas', ['tret', 'tq'], { av: true }),
  P('pMadre', 'Perfil das madres / ripas', ['tret', 'tq', 'tr', 'tu'], { av: true, se: m => m.cobertura !== 'nenhuma' }),
  N('vaoMax', 'Vão máximo entre pilares', { av: true }),
  N('maxMadres', 'Afastamento máximo das madres / ripas', { av: true, se: m => m.cobertura !== 'nenhuma' }),
  N('beiral', 'Beiral (saliência a toda a volta)', { av: true, livre: true }),
];

CAMPOS.grade = [
  N('largura', 'Largura da grade'),
  N('altura', 'Altura da grade'),
  N('qtd', 'Quantidade de grades iguais', { un: 'un', livre: true }),
  P('pAro', 'Perfil do aro', ['tret', 'tq', 'barra'], { av: true }),
  P('pBarra', 'Perfil dos varões', ['tr', 'varao', 'vq', 'tq'], { av: true }),
  N('vaoMax', 'Vão livre máximo entre varões', { av: true }),
];

CAMPOS.escada = [
  N('desnivel', 'Desnível total (de piso acabado a piso acabado)'),
  N('largura', 'Largura útil (entre banzos)'),
  N('cobertor', 'Cobertor (profundidade do degrau)'),
  S('estrutura', 'Estrutura', { banzos: 'Dois banzos laterais', central: 'Viga central com suportes' }),
  S('degrau', 'Degraus', { lacrimada: 'Chapa lacrimada quinada', gradil: 'Gradil eletrossoldado' }),
  N('patamar', 'Patamar de chegada, comprimento (0 = sem patamar)', { livre: true }),
  N('patamarLargura', 'Largura do patamar (0 = igual à escada; maior = em L)', { livre: true, se: m => +m.patamar > 0 }),
  S('patamarLado', 'O patamar alarga para', { dir: 'a direita de quem sobe', esq: 'a esquerda de quem sobe' }, { se: m => +m.patamar > 0 && +m.patamarLargura > +m.largura }),
  S('guarda', 'Guarda de barras verticais', { nenhuma: 'Sem guarda', um: 'De um lado', dois: 'Dos dois lados' }),
  N('guardaAltura', 'Altura da guarda', { av: true, se: m => m.guarda !== 'nenhuma' }),
  N('guardaPasso', 'Distância entre eixos das barras da guarda', { av: true, se: m => m.guarda !== 'nenhuma' }),
  P('pGuarda', 'Perfil das barras da guarda', ['barra', 'vq', 'varao', 'tq'], { av: true, se: m => m.guarda !== 'nenhuma' }),
  P('pPilar', 'Perfil dos pilares do patamar', ['tq'], { av: true, se: m => +m.patamar > 0 }),
  N('espelhoMax', 'Espelho máximo (altura do degrau)', { av: true }),
  P('pBanzo', 'Perfil dos banzos', ['tret', 'tq'], { av: true }),
];

CAMPOS.gradeamento = [
  N('comp', 'Comprimento total'),
  N('altura', 'Altura acima do muro'),
  S('enchimento', 'Enchimento', { varoes: 'Varões verticais', barras: 'Barras horizontais' }),
  S('fixacao', 'Fixação dos prumos', { chumbado: 'Chumbados no muro', sapata: 'Com sapata e buchas' }),
  N('pontas', 'Pontas dos varões acima da travessa (0 = sem pontas)', { livre: true, se: m => m.enchimento !== 'barras' }),
  N('nBarras', 'Número de barras', { un: '', se: m => m.enchimento === 'barras' }),
  P('pPrumo', 'Perfil dos prumos', TUBOS, { av: true }),
  P('pTravessa', 'Perfil das travessas', TUBOS.concat('barra'), { av: true, se: m => m.enchimento !== 'barras' }),
  P('pVarao', 'Perfil dos varões / barras', FINOS, { av: true }),
  N('maxPrumos', 'Comprimento máximo de cada módulo', { av: true }),
  N('vaoMax', 'Vão livre máximo entre varões', { av: true, se: m => m.enchimento !== 'barras' }),
  N('baixo', 'Folga por baixo', { av: true, livre: true }),
  N('topo', 'Distância da travessa de cima ao topo do prumo', { av: true, livre: true }),
];

CAMPOS.abrigo = [
  N('comp', 'Comprimento (frente)'),
  N('largura', 'Largura (profundidade)'),
  N('altura', 'Altura à frente (lado alto)'),
  N('pendente', 'Pendente da cobertura, para trás', { un: '%', livre: true }),
  N('pes', 'Altura livre por baixo da base (0 = assente no chão)', { livre: true }),
  { id: 'porta', rotulo: 'Com porta na frente', tipo: 'bool' },
  N('portaL', 'Largura da porta', { se: m => m.porta }),
  N('portaH', 'Altura da porta', { se: m => m.porta }),
  { id: 'piso', rotulo: 'Piso em chapa lacrimada', tipo: 'bool' },
  S('revestimento', 'Paredes', { trapezoidal: 'Chapa trapezoidal', nenhum: 'Só a estrutura' }),
  S('cobertura', 'Cobertura', { sandwich: 'Painel sandwich', trapezoidal: 'Chapa trapezoidal', nenhuma: 'Sem cobertura' }),
  P('pPilar', 'Perfil dos pilares', ['tq'], { av: true }),
  P('pBase', 'Perfil do quadro de base', ['tret', 'tq'], { av: true }),
  P('pTopo', 'Perfil do topo e das travessas', ['tq', 'tret'], { av: true }),
];

CAMPOS.guardamuro = [
  N('comp', 'Comprimento total da guarda'),
  N('altura', 'Altura acima do muro (até ao topo do corrimão)'),
  N('passo', 'Distância entre eixos das barras'),
  N('modulo', 'Comprimento do módulo', { av: true }),
  N('rasgo', 'Rasgo no muro (largura = profundidade)', { av: true }),
  P('pCorrimao', 'Tubo do corrimão', ['tr', 'tq'], { av: true }),
  P('pBarra', 'Perfil das barras', ['tr', 'varao', 'vq'], { av: true }),
  P('pChata', 'Barra chata de base', ['barra'], { av: true }),
];
