import { test, eq, ok } from './t.js';
import { MODELO, catalogoParaPrompt, construirPedido, medidasValidas, interpretarResposta, pedirSolucao, pedidoParaColar, interpretarColado, resumoProposta } from '../js/claude.js';
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
// --- sem chave: copiar o pedido para a conversa do Claude e colar a resposta ---
test('pedido para copiar: leva o catálogo, o que o serralheiro escreveu e o formato da resposta, sem chave nem dados da obra', () => {
  const p = pedidoParaColar('Varanda com 3,2 m, cliente quer vidro');
  for (const x of ['guarda — Guarda', 'comprimento_total', 'Varanda com 3,2 m, cliente quer vidro', '"solucao"', '"alternativas"', '"a_confirmar"', '"observacoes"', '```json']) ok(p.includes(x), 'falta ' + x);
  ok(/fotografia/i.test(p)); ok(!p.includes('abrigo —')); ok(!/sk-ant|x-api-key/.test(p));
  ok(pedidoParaColar('').length > 500, 'sem texto continua a dar um pedido utilizável');
});
test('resposta colada: lê o JSON dentro de um bloco de código, com conversa à volta', () => {
  const r = interpretarColado('Claro, aqui está a proposta:\n\n```json\n' + JSON.stringify(boa, null, 2) + '\n```\n\nSe quiser outra alternativa, diga {assim}.');
  ok(r.ok); eq(r.solucao.tipo, 'guarda'); eq(r.solucao.medidas, { trocos: [{ comp: 3200, desnivel: 0, viragem: 0 }], altura: 1100, enchimento: 'vidro' });
  eq(r.alternativas.length, 1); eq(r.aConfirmar, ['Comprimento real da varanda']); eq(r.observacoes, 'Altura mínima a confirmar.');
});
test('resposta colada: aceita JSON sem bloco e com aspas curvas do telemóvel', () => {
  ok(interpretarColado(JSON.stringify(boa)).ok);
  const curvas = JSON.stringify(boa).replace(/"/g, (m, i) => (i % 2 ? '”' : '“'));
  const r = interpretarColado('Resposta: ' + curvas); ok(r.ok, r.erro); eq(r.solucao.nome, 'Guarda da varanda');
});
test('resposta colada má: vazio, texto sem JSON, JSON partido e tipo desconhecido dão erro claro, sem rebentar', () => {
  ok(/cole/i.test(interpretarColado('').erro)); ok(/cole/i.test(interpretarColado(null).erro));
  ok(/não foi possível/i.test(interpretarColado('Olá, não consigo ver a fotografia.').erro));
  ok(interpretarColado('```json\n{"solucao": {"tipo": "guarda", \n```').erro);
  ok(interpretarColado(JSON.stringify({ ...boa, solucao: { ...boa.solucao, tipo: 'foguetao' } })).erro);
  ok(interpretarColado('[1,2,3]').erro); ok(interpretarColado('{}').erro);
});
test('a resposta colada e a resposta da API dão exatamente o mesmo resultado', () => {
  eq(interpretarColado('```json\n' + JSON.stringify(boa) + '\n```'), interpretarResposta(resposta(boa)));
});

// --- trabalho livre: quando nenhum tipo serve, o Claude devolve a lista de peças ---
const livre = { solucao: { tipo: 'livre', nome: 'Suporte de máquina', razao: 'Não cabe em nenhum tipo.', medidas: [],
  pecas: [{ nome: 'Pernas', perfil: 'tq60x3', comp: '850', qtd: '4', c1: '90', c2: '90' }, { nome: 'Travessas', perfil: 'tret60x40x2', comp: 1200, qtd: 2, c1: 45, c2: 45 }, { nome: 'Inventada', perfil: 'hea200', comp: '500', qtd: '1' }, { nome: 'Sem medida', perfil: 'tq40x2', comp: '', qtd: '2' }],
  chapas: [{ nome: 'Tampo', tipo: 'chapa', esp: '5', larg: '1300', alt: '700', qtd: '1' }, { nome: 'Má', tipo: 'titânio', esp: '5', larg: '10', alt: '10', qtd: '1' }],
  outros: [{ nome: 'Rodas com travão', qtd: '4' }] }, alternativas: [], a_confirmar: ['Peso da máquina'], observacoes: '' };
test('o catálogo explica o trabalho livre: quando usar, os códigos de perfil e os tipos de chapa', () => {
  const c = catalogoParaPrompt();
  for (const p of ['livre — Trabalho livre', 'tq60x3', 'tret60x40x2', 'barra40x5', 'lacrimada', 'pecas', 'chapas', 'outros', 'ponta mais comprida']) ok(c.includes(p), 'falta ' + p);
  ok(/não couber em nenhum/i.test(c)); ok(!c.includes('tu50x2'), 'os tubos de tubagem não entram na lista do trabalho livre');
  const s = construirPedido({ texto: 'x' }).output_config.format.schema.properties.solucao;
  ok(s.properties.tipo.enum.includes('livre')); for (const k of ['pecas', 'chapas', 'outros']) { eq(s.properties[k].type, 'array'); ok(s.required.includes(k)); }
  ok(pedidoParaColar('x').includes('"pecas"'));
});
test('proposta de trabalho livre: fica a lista de peças válida, e o que a app não conhece é posto de lado e dito', () => {
  const r = interpretarColado(JSON.stringify(livre)); ok(r.ok, r.erro);
  eq(r.solucao.tipo, 'livre');
  eq(r.solucao.medidas.pecas, [{ nome: 'Pernas', perfil: 'tq60x3', comp: 850, qtd: 4, c1: 90, c2: 90 }, { nome: 'Travessas', perfil: 'tret60x40x2', comp: 1200, qtd: 2, c1: 45, c2: 45 }]);
  eq(r.solucao.medidas.chapas, [{ nome: 'Tampo', tipo: 'chapa', esp: 5, larg: 1300, alt: 700, qtd: 1 }]);
  eq(r.solucao.medidas.outros, [{ nome: 'Rodas com travão', qtd: 4, preco: '' }]); eq(r.solucao.medidas.ferragens, []);
  eq(r.solucao.ignorados.length, 3); ok(r.solucao.ignorados.some(x => /Inventada/.test(x) && /hea200/.test(x)));
  const res = calcular({ tipo: 'livre', medidas: r.solucao.medidas }); eq(res.pecas.length, 6); eq(res.paineis.length, 1); eq(res.avisos, []);
  eq(interpretarResposta(resposta(livre)).solucao.medidas, r.solucao.medidas);
});
test('trabalho livre sem nenhuma peça válida não é proposta que sirva', () => {
  ok(interpretarColado(JSON.stringify({ ...livre, solucao: { ...livre.solucao, pecas: [{ nome: 'x', perfil: 'nada', comp: '5', qtd: '1' }], chapas: [] } })).erro);
  ok(interpretarColado(JSON.stringify({ ...livre, solucao: { tipo: 'livre', nome: 'x', razao: '', medidas: [] } })).erro);
});
test('resumo de uma proposta para o ecrã: medidas normais e lista do trabalho livre, sem «[object Object]»', () => {
  const g = resumoProposta(interpretarColado(JSON.stringify(boa)).solucao);
  eq(g, [['Comprimento', '3200 mm'], ['Altura da guarda', '1100 mm'], ['Enchimento', 'Vidro laminado']]);
  const l = resumoProposta(interpretarColado(JSON.stringify(livre)).solucao);
  eq(l, [['Pernas', '4 × Tubo quadrado 60×60×3 de 850 mm'], ['Travessas', '2 × Tubo retangular 60×40×2 de 1200 mm, cortes 45°/45°'], ['Tampo', '1 × Chapa lisa 5 mm de 1300 × 700 mm'], ['Rodas com travão', '4 un (preço por indicar)']]);
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
