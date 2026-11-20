// Formulários de medidas, definidos por tipo de trabalho.
import { PERFIS, DIAMETROS, ESPESSURAS, ACESSORIOS, FORMAS, perfilProximo } from './catalogo.js';
import { TIPOS_CHAPA } from './modelos/livre.js';
import { ITENS, PONTAS, ANGULOS } from './modelos/flangeada.js';
import { esc } from './fmt.js';
import { pergunta } from './pergunta.js';

const N = (id, rotulo, o = {}) => ({ id, rotulo, tipo: 'num', un: 'mm', ...o });
const S = (id, rotulo, opcoes, o = {}) => ({ id, rotulo, tipo: 'sel', opcoes, ...o });
const P = (id, rotulo, formas, o = {}) => ({ id, rotulo, tipo: 'perfil', formas, ...o });
const TUBOS = ['tq', 'tret', 'tr'], FINOS = ['varao', 'vq', 'barra', 'tq'];
const TODOS = ['tr', 'tq', 'tret', 'barra', 'varao', 'vq'];   // tubo redondo, quadrado, retangular, barra chata, varão maciço redondo e quadrado
const AFAST_V = 'Afastamento livre entre varões / ripas (máximo; reparte por igual)', AFAST_H = 'Afastamento livre entre barras (vazio = pelo número de barras)';
const POSICAO = { face: 'De face (vê-se a face larga)', cutelo: 'Ao alto, de cutelo (vê-se a face estreita)' };
const ripaChata = id => ['tret', 'barra'].includes((PERFIS[id] || {}).forma);

export const CAMPOS = {
  guarda: [
    { id: 'trocos', tipo: 'trocos' },
    N('altura', 'Altura da guarda'),
    S('enchimento', 'Enchimento', { varoes: 'Varões verticais', barras: 'Barras horizontais', vidro: 'Vidro laminado', chapa: 'Chapa', nenhum: 'Sem enchimento' }),
    S('fixacao', 'Fixação', { topo: 'Ao topo do pavimento (sapata)', lateral: 'Lateral (à testa da laje)' }),
    P('pCorrimao', 'Corrimão', TODOS),
    P('pPrumo', 'Prumos', TODOS),
    P('pTravessa', 'Perfil das travessas', TUBOS.concat('barra'), { av: true, se: m => ['varoes', 'chapa'].includes(m.enchimento) }),
    N('vaoMax', AFAST_V, { se: m => m.enchimento === 'varoes' }),
    N('vaoBarras', AFAST_H, { livre: true, se: m => m.enchimento === 'barras' }),
    N('nBarras', 'Número de barras (se o afastamento ficar vazio)', { un: '', se: m => m.enchimento === 'barras' && !(+m.vaoBarras > 0) }),
    P('pVarao', 'Varões / ripas / barras', TODOS, { se: m => ['varoes', 'barras'].includes(m.enchimento) }),
    S('posicao', 'Posição da ripa', POSICAO, { se: m => ['varoes', 'barras'].includes(m.enchimento) && ripaChata(m.pVarao) }),
    N('maxPrumos', 'Afastamento máximo entre prumos', { av: true }),
    N('baixo', 'Altura livre por baixo', { av: true }),
  ],
  corrimao: [
    N('comp', 'Comprimento (na horizontal)'),
    N('desnivel', 'Desnível (subida)', { livre: true }),
    N('altura', 'Altura do corrimão'),
    S('montagem', 'Montagem', { parede: 'Na parede, com suportes', prumos: 'Sobre prumos' }),
    S('extremidade', 'Extremidades', { tampa: 'Tampa', curva: 'Curva a 90° para a parede' }),
    P('tubo', 'Corrimão', TODOS),
    P('pPrumo', 'Prumos', TODOS, { se: m => m.montagem === 'prumos' }),
    N('maxSuportes', 'Afastamento máximo entre suportes', { av: true }),
  ],
  portao: [
    N('largura', 'Largura do vão'),
    N('altura', 'Altura do portão'),
    S('tipo', 'Tipo', { batente1: 'De batente, 1 folha', batente2: 'De batente, 2 folhas', correr: 'De correr' }),
    S('enchimento', 'Enchimento', { varoes: 'Varões verticais', chapa: 'Chapa lisa', laminas: 'Lâminas horizontais', almofadas: 'Almofadas em chapa quinada' }),
    N('vaoMax', AFAST_V, { se: m => m.enchimento === 'varoes' }),
    N('vaoLaminas', 'Afastamento livre entre lâminas (vazio = juntas, 20 mm)', { livre: true, se: m => m.enchimento === 'laminas' }),
    N('nAlmofadas', 'Número de almofadas por folha (0 = automático)', { un: '', livre: true, se: m => m.enchimento === 'almofadas' }),
    { id: 'tardoz', rotulo: 'Chapa de trás rebitada', tipo: 'bool', se: m => m.enchimento === 'almofadas' },
    { id: 'isolamento', rotulo: 'Isolamento XPS no interior', tipo: 'bool', se: m => m.enchimento === 'almofadas' },
    N('relevo', 'Relevo das almofadas', { av: true, se: m => m.enchimento === 'almofadas' }),
    { id: 'pilares', rotulo: 'Com pilares novos', tipo: 'bool' },
    { id: 'motor', rotulo: 'Preparação para motor', tipo: 'bool' },
    P('pAro', 'Perfil do aro', TUBOS, { av: true }),
    P('pTravessa', 'Perfil das travessas', TUBOS, { av: true }),
    P('pVarao', 'Varões', TODOS, { se: m => m.enchimento === 'varoes' }),
    P('pLamina', 'Perfil das lâminas', ['tret', 'barra'], { av: true, se: m => m.enchimento === 'laminas' }),
    P('pPilar', 'Perfil dos pilares', ['tq', 'tret'], { av: true, se: m => m.pilares }),
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
  if (c.tipo === 'perfil' && c.formas.length > 1) {
    // dois passos: primeiro o tipo de material, depois a medida dentro desse tipo
    const forma = PERFIS[v] && c.formas.includes(PERFIS[v].forma) ? PERFIS[v].forma : c.formas[0];
    const tipos = Object.keys(FORMAS).filter(f => c.formas.includes(f)).map(f => `<option value="${f}" ${f === forma ? 'selected' : ''}>${esc(FORMAS[f])}</option>`).join('');
    const meds = Object.values(PERFIS).filter(p => p.forma === forma).map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
    return `<div class="campo-perfil"><label class="campo"><span>${esc(c.rotulo)} — tipo de material</span><select data-forma="${c.id}">${tipos}</select></label>
<label class="campo"><span>${esc(c.rotulo)} — medida</span><select data-id="${c.id}">${meds}</select></label></div>`;
  }
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
  if (tipo === 'livre') return formLivre(el, medidas, onChange);
  if (tipo === 'flangeada') return formFlangeada(el, medidas, onChange);
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
    if (t.dataset.forma) { medidas[t.dataset.forma] = perfilProximo(medidas[t.dataset.forma], t.value); pinta(); onChange(medidas); return; }
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
  S('sentido', 'Varões / ripas', { vertical: 'Na vertical (ao alto)', horizontal: 'Na horizontal (deitados)' }),
  N('vaoMax', 'Afastamento livre entre varões / ripas (máximo; reparte por igual)'),
  P('pBarra', 'Varões / ripas', TODOS),
  S('posicao', 'Posição da ripa', POSICAO, { se: m => ripaChata(m.pBarra) }),
  P('pAro', 'Perfil do aro', ['tret', 'tq', 'barra'], { av: true }),
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
  P('pGuarda', 'Barras da guarda', TODOS, { se: m => m.guarda !== 'nenhuma' }),
  P('pPilar', 'Perfil dos pilares do patamar', ['tq'], { av: true, se: m => +m.patamar > 0 }),
  N('espelhoMax', 'Espelho máximo (altura do degrau)', { av: true }),
  P('pBanzo', 'Perfil dos banzos', ['tret', 'tq'], { av: true }),
];

CAMPOS.gradeamento = [
  N('comp', 'Comprimento total'),
  N('altura', 'Altura acima do muro'),
  S('enchimento', 'Enchimento', { varoes: 'Varões verticais', barras: 'Barras horizontais' }),
  S('fixacao', 'Fixação dos prumos', { chumbado: 'Chumbados no muro', sapata: 'Com sapata e buchas' }),
  P('pPrumo', 'Prumos', TODOS),
  N('pontas', 'Pontas dos varões acima da travessa (0 = sem pontas)', { livre: true, se: m => m.enchimento !== 'barras' }),
  N('vaoMax', AFAST_V, { se: m => m.enchimento !== 'barras' }),
  N('vaoBarras', AFAST_H, { livre: true, se: m => m.enchimento === 'barras' }),
  N('nBarras', 'Número de barras (se o afastamento ficar vazio)', { un: '', se: m => m.enchimento === 'barras' && !(+m.vaoBarras > 0) }),
  P('pVarao', 'Varões / ripas / barras', TODOS),
  S('posicao', 'Posição da ripa', POSICAO, { se: m => ripaChata(m.pVarao) }),
  P('pTravessa', 'Perfil das travessas', TUBOS.concat('barra'), { av: true, se: m => m.enchimento !== 'barras' }),
  N('maxPrumos', 'Comprimento máximo de cada módulo', { av: true }),
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
  P('pCorrimao', 'Corrimão', TODOS),
  P('pBarra', 'Barras', TODOS),
  P('pChata', 'Barra chata de base', ['barra'], { av: true }),
];

// ---------- trabalho livre: listas escritas à mão ----------
CAMPOS.livre = [];
const LISTAS_LIVRE = {
  pecas: { titulo: 'Peças em perfil (comprimento pela ponta mais comprida)', um: 'Peça', juntar: '+ Juntar peça', nova: () => ({ nome: '', perfil: 'tq40x2', comp: '', qtd: 1, c1: 90, c2: 90 }) },
  chapas: { titulo: 'Chapas, vidros e painéis', um: 'Chapa', juntar: '+ Juntar chapa', nova: () => ({ nome: '', tipo: 'chapa', esp: 3, larg: '', alt: '', qtd: 1 }) },
  ferragens: { titulo: 'Ferragens da tabela de preços', um: 'Ferragem', juntar: '+ Juntar ferragem', nova: () => ({ ref: 'placa_base', qtd: 1 }) },
  outros: { titulo: 'Outros artigos de compra (com o preço que pagar)', um: 'Artigo', juntar: '+ Juntar outro artigo', nova: () => ({ nome: '', qtd: 1, preco: '' }) },
};
function formLivre(el, medidas, onChange) {
  for (const k of Object.keys(LISTAS_LIVRE)) if (!Array.isArray(medidas[k])) medidas[k] = [];
  if (!medidas.pecas.length && !medidas.chapas.length) medidas.pecas.push(LISTAS_LIVRE.pecas.nova());
  const txt = (l, i, k, rot, v, ph = '') => `<label class="campo"><span>${rot}</span><input type="text" autocomplete="off" data-l="${l}" data-i="${i}" data-k="${k}" value="${esc(v ?? '')}" placeholder="${ph}"></label>`;
  const n = (l, i, k, rot, v, un) => campoNum('', rot, v, un, `data-l="${l}" data-i="${i}" data-k="${k}"`);
  const sel = (l, i, k, rot, ops) => `<label class="campo"><span>${rot}</span><select data-l="${l}" data-i="${i}" data-k="${k}">${ops}</select></label>`;
  const perfis = v => Object.entries(FORMAS).map(([f, nome]) => `<optgroup label="${nome}">${Object.values(PERFIS).filter(p => p.forma === f).map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</optgroup>`).join('');
  const ops = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(x.nome || x)}</option>`).join('');
  const linha = {
    pecas: (x, i) => txt('pecas', i, 'nome', 'Nome da peça', x.nome, 'ex.: pernas') + sel('pecas', i, 'perfil', 'Perfil', perfis(x.perfil)) + n('pecas', i, 'comp', 'Comprimento', x.comp, 'mm') + n('pecas', i, 'qtd', 'Quantidade', x.qtd, 'un')
      + n('pecas', i, 'c1', 'Corte numa ponta (90 = esquadria)', x.c1 ?? 90, '°') + n('pecas', i, 'c2', 'Corte na outra ponta', x.c2 ?? 90, '°'),
    chapas: (x, i) => txt('chapas', i, 'nome', 'Nome', x.nome, 'ex.: tampo') + sel('chapas', i, 'tipo', 'Material', ops(TIPOS_CHAPA, x.tipo)) + n('chapas', i, 'esp', 'Espessura', x.esp, 'mm')
      + n('chapas', i, 'larg', 'Comprimento', x.larg, 'mm') + n('chapas', i, 'alt', 'Largura', x.alt, 'mm') + n('chapas', i, 'qtd', 'Quantidade', x.qtd, 'un'),
    ferragens: (x, i) => sel('ferragens', i, 'ref', 'Ferragem', ops(ACESSORIOS, x.ref)) + n('ferragens', i, 'qtd', 'Quantidade', x.qtd, 'un'),
    outros: (x, i) => txt('outros', i, 'nome', 'Descrição', x.nome, 'ex.: rodas com travão') + n('outros', i, 'qtd', 'Quantidade', x.qtd, 'un') + n('outros', i, 'preco', 'Preço de cada', x.preco, '€'),
  };
  function pinta() {
    el.innerHTML = Object.entries(LISTAS_LIVRE).map(([l, d]) => `<fieldset class="trocos"><legend>${d.titulo}</legend>${medidas[l].map((x, i) => `<div class="troco livre-l">
<div class="troco-cab"><strong>${d.um} ${i + 1}</strong><button type="button" class="b-lig" data-tirar-l="${l}" data-i="${i}" aria-label="Remover ${d.um.toLowerCase()} ${i + 1}">Remover</button></div>${linha[l](x || {}, i)}</div>`).join('')}
<button type="button" class="b-sec" data-juntar-l="${l}">${d.juntar}</button></fieldset>`).join('');
  }
  pinta();
  const escreve = e => {
    const t = e.target, l = t.dataset.l; if (!l || !medidas[l] || !medidas[l][+t.dataset.i]) return false;
    medidas[l][+t.dataset.i][t.dataset.k] = t.value; return true;
  };
  el.oninput = e => { if (e.target.tagName !== 'SELECT' && escreve(e)) onChange(medidas); };
  el.onchange = e => { if (e.target.tagName === 'SELECT' && escreve(e)) onChange(medidas); };
  el.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.juntarL) { if (medidas[b.dataset.juntarL].length >= 60) return; medidas[b.dataset.juntarL].push(LISTAS_LIVRE[b.dataset.juntarL].nova()); }
    else if (b.dataset.tirarL) medidas[b.dataset.tirarL].splice(+b.dataset.i, 1);
    else return;
    pinta(); onChange(medidas);
  };
}

// ---------- tubagem flangeada: a linha escreve-se peça a peça ----------
CAMPOS.flangeada = [];
function formFlangeada(el, medidas, onChange) {
  if (!Array.isArray(medidas.itens) || !medidas.itens.length) medidas.itens = [{ tipo: 'tubo', comp: '', dir: 'dir' }];
  if (!Array.isArray(medidas.linhas)) medidas.linhas = [];
  medidas.linhas = medidas.linhas.filter(x => x && typeof x === 'object');
  const linhaDe = ln => (ln ? medidas.linhas[ln - 1] : medidas);     // linha 0 = a primeira (as medidas de sempre); as outras estão em medidas.linhas
  const DNS = Object.fromEntries(Object.entries(DIAMETROS).map(([dn, d]) => [dn, `DN${dn} (Ø${String(d.de).replace('.', ',')} mm)`]));
  const ops = (o, v, vazio) => (vazio ? `<option value="">${vazio}</option>` : '') + Object.entries(o).map(([k, n]) => `<option value="${k}" ${String(k) === String(v ?? '') ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const selT = (ln, id, rot, o, v, vazio) => `<label class="campo"><span>${rot}</span><select data-ln="${ln}" data-id="${id}">${ops(o, v, vazio)}</select></label>`;
  const numT = (ln, id, rot, v, un) => campoNum('', rot, v, un, `data-ln="${ln}" data-id="${id}"`);
  const selI = (ln, i, k, rot, o, v, vazio) => `<label class="campo"><span>${rot}</span><select data-ln="${ln}" data-i="${i}" data-k="${k}">${ops(o, v, vazio)}</select></label>`;
  const numI = (ln, i, k, rot, v, un = 'mm') => campoNum('', rot, v, un, `data-ln="${ln}" data-i="${i}" data-k="${k}"`);
  const corpo = (ln, x, i, primeira) => {
    if (x.tipo === 'tubo') return numI(ln, i, 'comp', 'Comprimento (eixo a eixo; nas flanges, à face)', x.comp) + selI(ln, i, 'dir', 'Direção', primeira ? DIRS_TUBO : { segue: 'Segue a direito (ou a curva anterior)', ...DIRS_TUBO }, x.dir || (primeira ? 'dir' : 'segue'));
    if (x.tipo === 'curva') return selI(ln, i, 'ang', 'Ângulo da curva', ANGULOS, x.ang ?? 90) + (x.ang === 'outro' ? numI(ln, i, 'angOutro', 'Ângulo medido', x.angOutro, '°') : '') + selI(ln, i, 'para', 'Vira', DIRS_TUBO, x.para, 'escolher…');
    if (x.tipo === 'reducao') return selI(ln, i, 'dn2', 'Diâmetro de saída', DNS, x.dn2, 'escolher…') + numI(ln, i, 'comp', 'Comprimento da redução', x.comp);
    if (x.tipo === 'te') return selI(ln, i, 'dn2', 'Diâmetro do ramal', DNS, x.dn2, 'igual à linha') + selI(ln, i, 'dirR', 'O ramal sai', DIRS_TUBO, x.dirR || 'frente') + numI(ln, i, 'compR', 'Do eixo à flange do ramal', x.compR) + selI(ln, i, 'ramal', 'O ramal liga a', PONTAS, x.ramal || 'inox');
    if (x.tipo === 'flange') return '<p class="dica">Fecha o troço aqui com uma flange; a peça seguinte começa outro troço.</p>';
    return numI(ln, i, 'comp', 'Comprimento de face a face', x.comp);
  };
  const pecas = (ln, L, pegada) => `<fieldset class="trocos"><legend>Peças da linha, pela ordem em que estão montadas</legend>${L.itens.map((x, i) => `<div class="troco livre-l">
<div class="troco-cab"><strong>Peça ${i + 1}</strong><span><button type="button" class="b-lig" data-ln="${ln}" data-antes="${i}">+ Inserir antes</button> ${L.itens.length > 1 ? `<button type="button" class="b-lig" data-ln="${ln}" data-tirar-i="${i}" aria-label="Remover peça ${i + 1}">Remover</button>` : ''}</span></div>
${selI(ln, i, 'tipo', 'O que é', ITENS, (x || {}).tipo)}${corpo(ln, x || {}, i, i === 0 && !pegada)}</div>`).join('')}
<button type="button" class="b-sec" data-ln="${ln}" data-nova>+ Juntar peça</button></fieldset>`;
  function pinta() {
    const outras = medidas.linhas.map((L, k) => {
      const ln = k + 1, noRamal = L.comeca === 'lig';
      if (!Array.isArray(L.itens) || !L.itens.length) L.itens = [{ tipo: 'tubo', comp: '', dir: noRamal ? 'segue' : 'dir' }];
      return `<fieldset class="trocos outra-linha"><legend>Linha ${esc(L.letra || String.fromCharCode(65 + ln))}</legend><div class="troco livre-l">
<div class="troco-cab"><strong>Outra linha</strong><button type="button" class="b-lig" data-tirar-linha="${k}">Remover esta linha</button></div>
<label class="campo"><span>Letra</span><input type="text" data-ln="${ln}" data-id="letra" maxlength="3" value="${esc(L.letra ?? String.fromCharCode(65 + ln))}"></label>
${selT(ln, 'comeca', 'Começa', { lig: 'Numa ligação que já existe (ramal de um tê, fim de outra linha)', coord: 'Num ponto, pelas medidas ao início da primeira linha' }, L.comeca || 'coord')}
${noRamal ? numT(ln, 'lig', 'N.º dessa ligação', L.lig, '') : numT(ln, 'x', 'Para a direita', L.x, 'mm') + numT(ln, 'y', 'Para cima', L.y, 'mm') + numT(ln, 'z', 'Para trás (negativo = para a frente)', L.z, 'mm') + selT(ln, 'dn', 'Diâmetro nominal', DNS, L.dn, 'igual à primeira linha') + selT(ln, 'ini', 'No início, a linha', PONTAS, L.ini || 'ffd')}
${selT(ln, 'fim', 'No fim, a linha', PONTAS, L.fim || 'ffd')}</div>${pecas(ln, L, noRamal)}</fieldset>`;
    }).join('');
    el.innerHTML = `<label class="campo"><span>Letra da linha (dá nome aos troços: A1, A2…)</span><input type="text" data-ln="0" data-id="letra" maxlength="3" value="${esc(medidas.letra ?? 'A')}"></label>
${selT(0, 'dn', 'Diâmetro nominal', DNS, medidas.dn)}${selT(0, 'esp', 'Espessura da parede', Object.fromEntries(ESPESSURAS.map(e => [e, String(e).replace('.', ',') + ' mm'])), medidas.esp)}
${selT(0, 'pn', 'Pressão das flanges', { 10: 'PN10', 16: 'PN16' }, medidas.pn)}${numT(0, 'nIni', 'Número da primeira ligação', medidas.nIni ?? 1, '')}
${selT(0, 'ini', 'No início, a linha', PONTAS, medidas.ini)}${selT(0, 'fim', 'No fim, a linha', PONTAS, medidas.fim)}
${pecas(0, medidas, false)}${outras}
<button type="button" class="b-sec" data-nova-linha>+ Juntar outra linha (ramal ou linha à parte)</button>
<p class="dica">Para mudar de direção, ponha uma «Curva» com o ângulo tirado no local (90°, 45°, 30°, 22,5° ou outro) e diga para que lado vira; o tubo seguinte segue a curva. As válvulas e os outros equipamentos são flangeados dos dois lados e partem a linha em troços. Uma linha que nasce no ramal de um tê liga-se pelo número dessa ligação, que se vê no desenho.</p>`;
  }
  pinta();
  const alvo = t => { const L = linhaDe(+t.dataset.ln || 0); return L ? (t.dataset.i !== undefined ? L.itens[+t.dataset.i] : t.dataset.id ? L : null) : null; };
  el.oninput = e => {
    const t = e.target; if (t.tagName === 'SELECT' || t.dataset.ln === undefined) return;
    const o = alvo(t); if (!o) return;
    o[t.dataset.i !== undefined ? t.dataset.k : t.dataset.id] = t.value;
    onChange(medidas);
  };
  el.onchange = e => {
    const t = e.target; if (t.tagName !== 'SELECT' || t.dataset.ln === undefined) return;
    const o = alvo(t); if (!o) return;
    if (t.dataset.i !== undefined) {
      o[t.dataset.k] = t.value;
      if (t.dataset.k === 'tipo' && t.value === 'curva') { if (o.ang === undefined) o.ang = 90; if (!o.para) o.para = 'cima'; }   // a curva aparece logo no desenho
      if (t.dataset.k === 'tipo' || t.dataset.k === 'ang') pinta();
    } else { o[t.dataset.id] = t.value; if (t.dataset.id === 'comeca') pinta(); }
    onChange(medidas);
  };
  el.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const novo = () => ({ tipo: 'tubo', comp: '', dir: 'segue' }), L = linhaDe(+b.dataset.ln || 0);
    if (b.dataset.novaLinha !== undefined) { if (medidas.linhas.length < 11) medidas.linhas.push({ letra: String.fromCharCode(66 + medidas.linhas.length), comeca: 'lig', lig: '', fim: 'ffd', itens: [novo()] }); }
    else if (b.dataset.tirarLinha !== undefined) { if (!(await pergunta('Remover esta linha e as suas peças?', { sim: 'Remover' }))) return; medidas.linhas.splice(+b.dataset.tirarLinha, 1); }
    else if (!L) return;
    else if (b.dataset.nova !== undefined) { if (L.itens.length < 80) L.itens.push(novo()); }
    else if (b.dataset.antes !== undefined) { if (L.itens.length < 80) L.itens.splice(+b.dataset.antes, 0, novo()); }
    else if (b.dataset.tirarI !== undefined) L.itens.splice(+b.dataset.tirarI, 1);
    else return;
    pinta(); onChange(medidas);
  };
}
