import { test, eq, ok } from './t.js';
import { MODELO, catalogoParaPrompt, construirPedido, medidasValidas, interpretarResposta, pedirSolucao } from '../js/claude.js';
import { calcular } from '../js/calc.js';

const IMG = 'data:image/jpeg;base64,/9j/AAAA';
const resposta = d => ({ type: 'message', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(d) }] });
const boa = { solucao: { tipo: 'guarda', nome: 'Guarda da varanda', razao: 'Varanda sem proteção.', medidas: [{ campo: 'comprimento_total', valor: '3200' }, { campo: 'altura', valor: '1100' }, { campo: 'enchimento', valor: 'vidro' }, { campo: 'inventado', valor: '5' }, { campo: 'fixacao', valor: 'colada' }] },
  alternativas: [{ tipo: 'gradeamento', nome: 'Gradeamento', razao: 'Mais barato.', medidas: [{ campo: 'comp', valor: '3 200' }] }, { tipo: 'abrigo', nome: 'x', razao: '', medidas: [] }],
  a_confirmar: ['Comprimento real da varanda'], observacoes: 'Altura mínima a confirmar.' };
const falso = (estado, corpo) => { const chamadas = []; const f = async (url, o) => { chamadas.push({ url, o }); const e = Array.isArray(estado) ? estado[Math.min(chamadas.length - 1, estado.length - 1)] : estado;
  return { ok: e >= 200 && e < 300, status: e, json: async () => (typeof corpo === 'function' ? corpo(chamadas.length) : corpo) }; }; f.chamadas = chamadas; return f; };

test('o catálogo enviado ao Claude lista os tipos visíveis e os seus campos, sem o abrigo', () => {
  const c = catalogoParaPrompt();
  for (const p of ['guarda — Guarda', 'escada — Escada reta', 'comprimento_total', 'enchimento', 'desnivel']) ok(c.includes(p), 'falta ' + p);
  ok(!c.includes('abrigo —'));
});
test('pedido com foto: bloco de imagem antes do texto, modelo e saída em JSON com os tipos da app', () => {
  const p = construirPedido({ texto: 'Varanda com 3,2 m', imagem: IMG });
  eq(p.model, MODELO); eq(p.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/AAAA' } });
  eq(p.messages[0].content[1].text, 'Varanda com 3,2 m');
  const s = p.output_config.format.schema; eq(p.output_config.format.type, 'json_schema'); eq(s.additionalProperties, false);
  ok(s.properties.solucao.properties.tipo.enum.includes('guarda')); ok(!s.properties.solucao.properties.tipo.enum.includes('abrigo'));
  ok(!('temperature' in p) && !('thinking' in p)); ok(p.max_tokens >= 4000);
});
test('pedido só com texto não leva imagem; imagem inválida é ignorada', () => {
  eq(construirPedido({ texto: 'Portão de 3 m' }).messages[0].content.length, 1);
  eq(construirPedido({ texto: 'x', imagem: 'data:text/html;base64,AAAA' }).messages[0].content.length, 1);
  ok(construirPedido({}).messages[0].content[0].text.length > 10);
});
test('medidas: só passam campos e opções que a app conhece; o comprimento vira um troço', () => {
  const { medidas, ignorados } = medidasValidas('guarda', boa.solucao.medidas);
  eq(medidas, { trocos: [{ comp: 3200, desnivel: 0, viragem: 0 }], altura: 1100, enchimento: 'vidro' });
  eq(ignorados, ['inventado', 'fixacao']);
  eq(medidasValidas('portao', [{ campo: 'motor', valor: 'sim' }, { campo: 'largura', valor: '3,5' }, { campo: 'altura', valor: '-4' }]).medidas, { motor: true, largura: 3.5 });
  eq(medidasValidas('xpto', [{ campo: 'a', valor: '1' }]).medidas, {}); eq(medidasValidas('guarda', null).medidas, {});
});
test('a proposta do Claude dá um trabalho que a app calcula', () => {
  const r = interpretarResposta(resposta(boa));
  ok(r.ok); eq(r.solucao.tipo, 'guarda'); eq(r.alternativas.length, 1); eq(r.alternativas[0].medidas, { comp: 3200 }); eq(r.aConfirmar.length, 1);
  ok(calcular({ tipo: r.solucao.tipo, medidas: r.solucao.medidas }).pecas.length > 0);
});
test('respostas más não rebentam: recusa, corte, texto que não é JSON, tipo desconhecido, erro', () => {
  ok(/recusou/.test(interpretarResposta({ stop_reason: 'refusal', content: [] }).erro));
  ok(/cortada/.test(interpretarResposta({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] }).erro));
  ok(interpretarResposta({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'olá' }] }).erro);
  ok(interpretarResposta(resposta({ ...boa, solucao: { ...boa.solucao, tipo: 'foguetao' } })).erro);
  ok(interpretarResposta({ type: 'error', error: { message: 'x' } }).erro); ok(interpretarResposta(null).erro);
});
test('envio: cabeçalhos certos, chave só no cabeçalho, e nunca no endereço', async () => {
  const f = falso(200, resposta(boa)), r = await pedirSolucao(' sk-teste ', { texto: 'x', imagem: IMG }, f);
  ok(r.ok); eq(f.chamadas.length, 1);
  const { url, o } = f.chamadas[0];
  eq(url, 'https://api.anthropic.com/v1/messages'); eq(o.method, 'POST'); eq(o.headers['x-api-key'], 'sk-teste');
  eq(o.headers['anthropic-dangerous-direct-browser-access'], 'true'); ok(o.headers['anthropic-version']);
  ok(!o.body.includes('sk-teste')); eq(JSON.parse(o.body).fallbacks, 'default');
});
test('envio: um 400 repete uma vez sem o reforço; erros dão mensagens claras; sem chave não chama', async () => {
  const f = falso([400, 200], resposta(boa)), r = await pedirSolucao('k', { texto: 'x' }, f);
  ok(r.ok); eq(f.chamadas.length, 2); ok(!('fallbacks' in JSON.parse(f.chamadas[1].o.body))); ok(!f.chamadas[1].o.headers['anthropic-beta']);
  ok(/chave/.test((await pedirSolucao('k', {}, falso(401, { type: 'error', error: { message: 'invalid x-api-key' } }))).erro));
  ok(/Limite|saldo/.test((await pedirSolucao('k', {}, falso(429, {}))).erro));
  ok(/indisponível/.test((await pedirSolucao('k', {}, falso(529, {}))).erro));
  ok(/ligação/.test((await pedirSolucao('k', {}, async () => { throw new Error('rede'); })).erro));
  const n = falso(200, {}); ok((await pedirSolucao('  ', {}, n)).erro); eq(n.chamadas.length, 0);
});
