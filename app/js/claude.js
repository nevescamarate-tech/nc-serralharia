// Ligação ao Claude (API da Anthropic), feita diretamente do aparelho com a chave do utilizador.
// A chave fica guardada só neste aparelho. A foto e o texto do pedido são enviados para a Anthropic.
import { TIPOS } from './calc.js';
import { CAMPOS } from './formularios.js';
import { PERFIS } from './catalogo.js';

export const MODELO = 'claude-opus-5-5';
const URL_API = 'https://api.anthropic.com/v1/messages', VERSAO_API = '2026-10-21', BETA_REFORCO = 'server-side-fallback-2026-07-01';
const tiposVisiveis = () => Object.entries(TIPOS).filter(([, t]) => !t.oculto);

/** Lista dos tipos de trabalho e dos campos de cada um, para o Claude saber o que a app consegue preparar. */
export function catalogoParaPrompt() {
  return tiposVisiveis().map(([id, t]) => {
    const campos = (CAMPOS[id] || []).filter(c => c.tipo !== 'perfil').map(c => {
      if (c.tipo === 'trocos') return id === 'tubagem' ? '  - trocos: não preencher (o percurso é introduzido à mão)' : '  - comprimento_total: comprimento em mm (a app cria um troço a direito)';
      if (c.tipo === 'sel') return `  - ${c.id}: ${c.rotulo} — um de: ${Object.keys(c.opcoes).join(', ')}`;
      if (c.tipo === 'bool') return `  - ${c.id}: ${c.rotulo} — sim ou nao`;
      return `  - ${c.id}: ${c.rotulo}${c.un ? ` (${c.un})` : ''}`;
    }).join('\n');
    return `${id} — ${t.nome}\n${campos}`;
  }).join('\n\n');
}

const ESQUEMA_SOLUCAO = { type: 'object', additionalProperties: false, required: ['tipo', 'nome', 'razao', 'medidas'],
  properties: { tipo: { type: 'string', enum: [] }, nome: { type: 'string' }, razao: { type: 'string' },
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
    system: `Trabalha para uma serralharia civil portuguesa (guardas, corrimãos, portões, grades, gradeamentos, escadas, telheiros, tubagem inox). Um serralheiro em obra envia uma fotografia do local e/ou uma descrição, por vezes com medidas. Proponha soluções que a aplicação da serralharia consegue preparar.

A aplicação só prepara estes tipos de trabalho, com estes campos (medidas sempre em milímetros):

${catalogoParaPrompt()}

Regras:
- Responda em português de Portugal, de forma curta e prática, como um preparador de obra experiente.
- A solução principal é a mais adequada; dê até duas alternativas realmente diferentes (outro tipo, outro enchimento ou outra fixação), só quando fizerem sentido.
- Em «medidas» use apenas os nomes de campo listados para o tipo escolhido, com o valor em texto (número em mm, ou uma das opções). Não invente campos.
- Use as medidas que o serralheiro indicar. Uma fotografia não mede com rigor: só estime uma medida quando houver uma referência clara na imagem, e nesse caso diga-o em «a_confirmar». Se não souber, deixe o campo de fora.
- Em «a_confirmar» liste as medidas e os pontos que têm de ser confirmados no local antes do fabrico (por exemplo o tipo de suporte para as fixações).
- Em «observacoes» refira riscos ou exigências relevantes (altura mínima de guarda, vãos máximos entre varões, necessidade de cálculo), sem afirmar conformidade regulamentar.
- Se a fotografia não mostrar um local onde caiba um destes trabalhos, diga-o em «observacoes» e proponha o tipo mais próximo.`,
    messages: [{ role: 'user', content: conteudo }],
    output_config: { format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['solucao', 'alternativas', 'a_confirmar', 'observacoes'],
      properties: { solucao, alternativas: { type: 'array', items: solucao }, a_confirmar: { type: 'array', items: { type: 'string' } }, observacoes: { type: 'string' } } } } },
  };
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

function arrumar(s) {
  if (!s || !TIPOS[s.tipo] || TIPOS[s.tipo].oculto) return null;
  const { medidas, ignorados } = medidasValidas(s.tipo, s.medidas);
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
  const solucao = arrumar(d && d.solucao);
  if (!solucao) return { erro: 'O Claude não propôs nenhum trabalho que a app consiga preparar.', observacoes: String((d && d.observacoes) || '') };
  return { ok: true, solucao, alternativas: (Array.isArray(d.alternativas) ? d.alternativas : []).map(arrumar).filter(Boolean).slice(0, 3),
    aConfirmar: (Array.isArray(d.a_confirmar) ? d.a_confirmar : []).map(String).slice(0, 12), observacoes: String(d.observacoes || '') };
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
