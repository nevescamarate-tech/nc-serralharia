// Ligação ao Claude (API da Anthropic), feita diretamente do aparelho com a chave do utilizador.
// A chave fica guardada só neste aparelho. A foto e o texto do pedido são enviados para a Anthropic.
import { TIPOS } from './calc.js';
import { CAMPOS } from './formularios.js';
import { PERFIS } from './catalogo.js';
import { TIPOS_CHAPA } from './modelos/livre.js';

export const MODELO = 'claude-opus-5-5';
const URL_API = 'https://api.anthropic.com/v1/messages', VERSAO_API = '2026-10-21', BETA_REFORCO = 'server-side-fallback-2026-07-01';
const tiposVisiveis = () => Object.entries(TIPOS).filter(([, t]) => !t.oculto && !t.semClaude);

// Trabalho livre: o que o Claude precisa de saber para devolver uma lista de peças que a app aceita.
const perfisLivre = () => Object.values(PERFIS).filter(p => p.forma !== 'tu');
function catalogoLivre() {
  return `livre — ${TIPOS.livre.nome}
  Use só quando o trabalho não couber em nenhum dos outros tipos. Neste tipo «medidas» fica vazio e a lista vai em «pecas», «chapas» e «outros»:
  - pecas: uma linha por peça diferente, com nome, perfil, comp (comprimento em mm, pela ponta mais comprida), qtd, c1 e c2 (corte de cada ponta em graus: 90 = esquadria, 45 = meia-esquadria)
    perfil é um destes códigos: ${perfisLivre().map(p => `${p.id} (${p.nome})`).join(', ')}
  - chapas: nome, tipo (um de: ${Object.entries(TIPOS_CHAPA).map(([k, n]) => `${k} = ${n}`).join(', ')}), esp (espessura em mm), larg e alt (em mm), qtd
  - outros: nome e qtd de cada ferragem ou artigo de compra (rodas, dobradiças, fechos, motor…); o preço é o serralheiro que o põe
  Nos outros tipos, «pecas», «chapas» e «outros» ficam vazios.`;
}
const TXT = { type: 'string' }, linhaDe = (...campos) => ({ type: 'array', items: { type: 'object', additionalProperties: false, required: campos, properties: Object.fromEntries(campos.map(c => [c, TXT])) } });

/** Lista dos tipos de trabalho e dos campos de cada um, para o Claude saber o que a app consegue preparar. */
export function catalogoParaPrompt() {
  return tiposVisiveis().map(([id, t]) => {
    if (id === 'livre') return catalogoLivre();
    const campos = (CAMPOS[id] || []).filter(c => c.tipo !== 'perfil').map(c => {
      if (c.tipo === 'trocos') return id === 'tubagem' ? '  - trocos: não preencher (o percurso é introduzido à mão)' : '  - comprimento_total: comprimento em mm (a app cria um troço a direito)';
      if (c.tipo === 'sel') return `  - ${c.id}: ${c.rotulo} — um de: ${Object.keys(c.opcoes).join(', ')}`;
      if (c.tipo === 'bool') return `  - ${c.id}: ${c.rotulo} — sim ou nao`;
      return `  - ${c.id}: ${c.rotulo}${c.un ? ` (${c.un})` : ''}`;
    }).join('\n');
    return `${id} — ${t.nome}\n${campos}`;
  }).join('\n\n');
}

const ESQUEMA_SOLUCAO = { type: 'object', additionalProperties: false, required: ['tipo', 'nome', 'razao', 'medidas', 'pecas', 'chapas', 'outros'],
  properties: { tipo: { type: 'string', enum: [] }, nome: TXT, razao: TXT, pecas: linhaDe('nome', 'perfil', 'comp', 'qtd', 'c1', 'c2'), chapas: linhaDe('nome', 'tipo', 'esp', 'larg', 'alt', 'qtd'), outros: linhaDe('nome', 'qtd'),
    medidas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['campo', 'valor'], properties: { campo: { type: 'string' }, valor: { type: 'string' } } } } } };

/** Corpo do pedido à API. imagem: data URL JPEG/PNG ou vazio. */
export function construirPedido({ texto = '', imagem = '' } = {}) {
  const ids = tiposVisiveis().map(([id]) => id);
  const solucao = { ...ESQUEMA_SOLUCAO, properties: { ...ESQUEMA_SOLUCAO.properties, tipo: { type: 'string', enum: ids } } };
  const conteudo = [];
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(imagem || '');
  if (m) conteudo.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  conteudo.push({ type: 'text', text: (texto || '').trim() || 'Proponha a solução de serralharia adequada ao que se vê na fotografia.' });
  return {
    model: MODELO, max_tokens: 16000,
    system: instrucoes(),
    messages: [{ role: 'user', content: conteudo }],
    output_config: { format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['solucao', 'alternativas', 'a_confirmar', 'observacoes'],
      properties: { solucao, alternativas: { type: 'array', items: solucao }, a_confirmar: { type: 'array', items: { type: 'string' } }, observacoes: { type: 'string' } } } } },
  };
}

/** O que o Claude precisa de saber para propor trabalhos que a app prepara. Serve a ligação direta e o copiar e colar. */
function instrucoes() {
  return `Trabalha para uma serralharia civil portuguesa (guardas, corrimãos, portões, grades, gradeamentos, escadas, telheiros, tubagem inox). Um serralheiro em obra envia uma fotografia do local e/ou uma descrição, por vezes com medidas. Proponha soluções que a aplicação da serralharia consegue preparar.

A aplicação só prepara estes tipos de trabalho, com estes campos (medidas sempre em milímetros):

${catalogoParaPrompt()}

Regras:
- Responda em português de Portugal, de forma curta e prática, como um preparador de obra experiente.
- A solução principal é a mais adequada; dê até duas alternativas realmente diferentes (outro tipo, outro enchimento ou outra fixação), só quando fizerem sentido.
- Em «medidas» use apenas os nomes de campo listados para o tipo escolhido, com o valor em texto (número em mm, ou uma das opções). Não invente campos.
- Use as medidas que o serralheiro indicar. Uma fotografia não mede com rigor: só estime uma medida quando houver uma referência clara na imagem, e nesse caso diga-o em «a_confirmar». Se não souber, deixe o campo de fora.
- Em «a_confirmar» liste as medidas e os pontos que têm de ser confirmados no local antes do fabrico (por exemplo o tipo de suporte para as fixações).
- Em «observacoes» refira riscos ou exigências relevantes (altura mínima de guarda, vãos máximos entre varões, necessidade de cálculo), sem afirmar conformidade regulamentar.
- Se a fotografia não mostrar um local onde caiba um destes trabalhos, diga-o em «observacoes» e proponha o tipo mais próximo.`;
}

const EXEMPLO_LIVRE = { tipo: 'livre', nome: 'Suporte de máquina', razao: 'Não cabe em nenhum dos outros tipos.', medidas: [],
  pecas: [{ nome: 'Pernas', perfil: 'tq60x3', comp: '850', qtd: '4', c1: '90', c2: '90' }, { nome: 'Travessas', perfil: 'tret60x40x2', comp: '1200', qtd: '2', c1: '45', c2: '45' }],
  chapas: [{ nome: 'Tampo', tipo: 'chapa', esp: '5', larg: '1300', alt: '700', qtd: '1' }], outros: [{ nome: 'Rodas com travão', qtd: '4' }] };
const EXEMPLO_RESPOSTA ={ solucao: { tipo: 'guarda', nome: 'Guarda da varanda', razao: 'Porque é esta a solução indicada.', medidas: [{ campo: 'comprimento_total', valor: '3200' }, { campo: 'altura', valor: '1100' }, { campo: 'enchimento', valor: 'vidro' }] },
  alternativas: [{ tipo: 'guarda', nome: 'Guarda de varões', razao: 'Mais económica.', medidas: [{ campo: 'comprimento_total', valor: '3200' }, { campo: 'enchimento', valor: 'varoes' }] }],
  a_confirmar: ['Comprimento real da varanda', 'Tipo de suporte para as fixações'], observacoes: 'Riscos ou exigências a ter em conta.' };

/** Sem chave: texto para colar numa conversa do Claude (com a fotografia junta à mão). A resposta volta por interpretarColado. */
export function pedidoParaColar(texto = '') {
  const pedido = String(texto || '').trim() || 'Proponha a solução de serralharia adequada ao que se vê na fotografia.';
  return `${instrucoes()}

Formato da resposta: responda apenas com um bloco de código JSON, sem mais texto, exatamente com esta estrutura (o exemplo serve só para mostrar o formato; «alternativas» pode ficar vazio):

\`\`\`json
${JSON.stringify(EXEMPLO_RESPOSTA, null, 2)}
\`\`\`

Quando o tipo for «livre», a solução leva as listas em vez de «medidas», assim:

${JSON.stringify(EXEMPLO_LIVRE)}

Se juntei uma fotografia a esta mensagem, é a fotografia do local.

Pedido do serralheiro:
${pedido}`;
}

/** Converte os pares campo/valor do Claude nas medidas do tipo, deitando fora o que a app não conhece. */
export function medidasValidas(tipo, pares) {
  const campos = CAMPOS[tipo] || [], out = {}, ignorados = [];
  for (const par of Array.isArray(pares) ? pares : []) {
    const campo = String((par && par.campo) || '').trim(), bruto = String((par && par.valor) ?? '').trim();
    const numero = parseFloat(bruto.replace(/\s/g, '').replace(',', '.'));
    if (campo === 'comprimento_total' && campos.some(c => c.tipo === 'trocos') && tipo !== 'tubagem') {
      if (numero > 0 && numero < 1e6) out.trocos = [{ comp: numero, desnivel: 0, viragem: 0 }]; else ignorados.push(campo); continue;
    }
    const c = campos.find(x => x.id === campo);
    if (!c || c.tipo === 'trocos') { ignorados.push(campo); continue; }
    if (c.tipo === 'num') { if (Number.isFinite(numero) && numero >= 0 && numero < 1e6) out[campo] = numero; else ignorados.push(campo); }
    else if (c.tipo === 'bool') out[campo] = /^(sim|true|1|s)$/i.test(bruto);
    else if (c.tipo === 'sel') { if (Object.prototype.hasOwnProperty.call(c.opcoes, bruto)) out[campo] = bruto; else ignorados.push(campo); }
    else if (c.tipo === 'perfil') { if (PERFIS[bruto]) out[campo] = bruto; else ignorados.push(campo); }
  }
  return { medidas: out, ignorados };
}

const numero = v => parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
/** Listas de um trabalho livre vindas do Claude: só ficam as linhas que a app sabe calcular. */
export function medidasLivre(s) {
  const lista = v => (Array.isArray(v) ? v.slice(0, 60) : []), nome = x => String((x && x.nome) || '').trim().slice(0, 60), ignorados = [];
  const qtd = x => { const n = Math.round(numero(x && x.qtd)); return n > 0 && n <= 500 ? n : 1; };
  const corte = v => { const g = numero(v); return g >= 10 && g <= 90 ? g : 90; };
  const pecas = [], chapas = [], outros = [];
  for (const x of lista(s && s.pecas)) {
    const comp = numero(x && x.comp);
    if (!x || !PERFIS[x.perfil]) { ignorados.push(`peça «${nome(x) || '?'}»: perfil ${String((x && x.perfil) || '?').slice(0, 30)} não existe na app`); continue; }
    if (!(comp > 0 && comp <= 100000)) { ignorados.push(`peça «${nome(x) || '?'}»: sem comprimento`); continue; }
    pecas.push({ nome: nome(x), perfil: x.perfil, comp, qtd: qtd(x), c1: corte(x.c1), c2: corte(x.c2) });
  }
  for (const x of lista(s && s.chapas)) {
    const esp = numero(x && x.esp), larg = numero(x && x.larg), alt = numero(x && x.alt);
    if (!x || !TIPOS_CHAPA[x.tipo] || !(esp > 0 && esp <= 200) || !(larg > 0 && larg <= 20000) || !(alt > 0 && alt <= 20000)) { ignorados.push(`chapa «${nome(x) || '?'}»: tipo ou medidas que a app não conhece`); continue; }
    chapas.push({ nome: nome(x), tipo: x.tipo, esp, larg, alt, qtd: qtd(x) });
  }
  for (const x of lista(s && s.outros)) if (nome(x)) outros.push({ nome: nome(x), qtd: qtd(x), preco: '' });
  return { medidas: { pecas, chapas, ferragens: [], outros }, ignorados };
}

/** Linhas [rótulo, valor] de uma proposta, para mostrar no ecrã antes de criar o trabalho. */
export function resumoProposta(s) {
  if (!s || !s.medidas) return [];
  if (s.tipo === 'livre') {
    const m = s.medidas, ang = x => (+x.c1 === 90 && +x.c2 === 90 ? '' : `, cortes ${x.c1}°/${x.c2}°`), mm = v => String(v).replace('.', ',');
    return [...(m.pecas || []).map(x => [x.nome || 'Peça', `${x.qtd} × ${(PERFIS[x.perfil] || {}).nome || x.perfil} de ${mm(x.comp)} mm${ang(x)}`]),
      ...(m.chapas || []).map(x => [x.nome || 'Chapa', `${x.qtd} × ${TIPOS_CHAPA[x.tipo] || x.tipo} ${mm(x.esp)} mm de ${mm(x.larg)} × ${mm(x.alt)} mm`]),
      ...(m.outros || []).map(x => [x.nome, `${x.qtd} un${x.preco === '' ? ' (preço por indicar)' : ''}`])];
  }
  const campos = CAMPOS[s.tipo] || [];
  return Object.entries(s.medidas).map(([k, v]) => {
    if (k === 'trocos') return ['Comprimento', `${Math.round(v[0].comp)} mm`];
    const c = campos.find(x => x.id === k) || {};
    const val = c.tipo === 'sel' ? c.opcoes[v] || v : c.tipo === 'bool' ? (v ? 'sim' : 'não') : `${v}${c.un === undefined ? ' mm' : c.un ? ' ' + c.un : ''}`;
    return [c.rotulo || k, String(val)];
  });
}

function arrumar(s) {
  if (!s || !TIPOS[s.tipo] || TIPOS[s.tipo].oculto || TIPOS[s.tipo].semClaude) return null;
  const { medidas, ignorados } = s.tipo === 'livre' ? medidasLivre(s) : medidasValidas(s.tipo, s.medidas);
  if (s.tipo === 'livre' && !medidas.pecas.length && !medidas.chapas.length) return null;
  return { tipo: s.tipo, nome: String(s.nome || TIPOS[s.tipo].nome).slice(0, 80), razao: String(s.razao || ''), medidas, ignorados };
}
/** Lê a resposta da API. Devolve { ok, solucao, alternativas, aConfirmar, observacoes } ou { erro }. */
export function interpretarResposta(r) {
  if (!r || typeof r !== 'object') return { erro: 'Resposta vazia do Claude.' };
  if (r.type === 'error' || r.error) return { erro: 'O Claude devolveu um erro: ' + ((r.error && r.error.message) || 'sem detalhe') };
  if (r.stop_reason === 'refusal') return { erro: 'O Claude recusou este pedido. Tente outra fotografia ou descreva o trabalho por palavras.' };
  if (r.stop_reason === 'max_tokens') return { erro: 'A resposta do Claude ficou cortada. Tente outra vez com um pedido mais curto.' };
  const texto = (Array.isArray(r.content) ? r.content : []).filter(b => b && b.type === 'text').map(b => b.text).join('');
  let d;
  try { d = JSON.parse(texto); } catch (e) { return { erro: 'Não foi possível ler a resposta do Claude.' }; }
  return lerDados(d);
}
function lerDados(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { erro: 'Não foi possível ler a resposta do Claude.' };
  const solucao = arrumar(d && d.solucao);
  if (!solucao) return { erro: 'O Claude não propôs nenhum trabalho que a app consiga preparar.', observacoes: String((d && d.observacoes) || '') };
  return { ok: true, solucao, alternativas: (Array.isArray(d.alternativas) ? d.alternativas : []).map(arrumar).filter(Boolean).slice(0, 3),
    aConfirmar: (Array.isArray(d.a_confirmar) ? d.a_confirmar : []).map(String).slice(0, 12), observacoes: String(d.observacoes || '') };
}

/** Lê uma resposta copiada de uma conversa do Claude: procura o JSON no meio do texto. Devolve o mesmo que interpretarResposta. */
export function interpretarColado(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return { erro: 'Cole aqui a resposta do Claude.' };
  const falha = { erro: 'Não foi possível ler a resposta. Copie a resposta inteira do Claude, incluindo o bloco que começa por { e acaba em }.' };
  const bloco = /```(?:json)?\s*([\s\S]*?)```/i.exec(t), candidatos = [];
  if (bloco) candidatos.push(bloco[1]);
  const i = t.indexOf('{'); if (i >= 0) for (let j = t.lastIndexOf('}'); j > i; j = t.lastIndexOf('}', j - 1)) { candidatos.push(t.slice(i, j + 1)); if (candidatos.length > 6) break; }
  for (const c of candidatos) for (const s of [c, c.replace(/[“”„]/g, '"')]) {
    let d; try { d = JSON.parse(s); } catch (e) { continue; }
    if (d && typeof d === 'object' && !Array.isArray(d)) return lerDados(d);
  }
  return falha;
}

const ERROS = { 401: 'A chave do Claude não é válida. Confirme-a em Definições.', 403: 'Esta chave não tem permissão para usar o Claude.',
  413: 'A fotografia é grande demais. Tente outra.', 429: 'Limite de pedidos atingido ou saldo esgotado na conta do Claude. Tente mais tarde.' };
/** Envia o pedido. Devolve o mesmo que interpretarResposta. */
export async function pedirSolucao(chave, dados, buscar = (...a) => fetch(...a)) {
  if (!chave || !String(chave).trim()) return { erro: 'Falta a chave do Claude. Introduza-a em Definições.' };
  const corpo = construirPedido(dados);
  const cab = beta => ({ 'content-type': 'application/json', 'x-api-key': String(chave).trim(), 'anthropic-version': VERSAO_API,
    'anthropic-dangerous-direct-browser-access': 'true', ...(beta ? { 'anthropic-beta': BETA_REFORCO } : {}) });
  const envia = reforco => buscar(URL_API, { method: 'POST', headers: cab(reforco), body: JSON.stringify(reforco ? { ...corpo, fallbacks: 'default' } : corpo) });
  let resp;
  try {
    resp = await envia(true);
    if (resp.status === 400) resp = await envia(false);   // conta ou região sem o reforço: repete sem ele
  } catch (e) { return { erro: 'Sem ligação ao Claude. Verifique a rede e tente outra vez.' }; }
  let json = null;
  try { json = await resp.json(); } catch (e) { /* corpo vazio */ }
  if (!resp.ok) return { erro: ERROS[resp.status] || (resp.status >= 500 ? 'O serviço do Claude está indisponível de momento. Tente daqui a pouco.' : 'O Claude não aceitou o pedido: ' + ((json && json.error && json.error.message) || resp.status)) };
  return interpretarResposta(json);
}
