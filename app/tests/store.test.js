import { test, eq, ok } from './t.js';
import * as store from '../js/store.js';

async function limpo() {
  await store.abrir('nc-teste');
  for (const o of await store.listarObras()) await store.apagarObra(o.id);
}
const obra = (id, nome, alterado) => ({ id, nome, cliente: 'c', trabalhos: [], alterado });
const pacote = (obras, extra = {}) => JSON.stringify({ versao: 1, obras, ...extra });

test('guardar e ler uma obra', async () => {
  await limpo();
  await store.guardarObra(obra('a', 'Obra A', 100));
  const l = await store.listarObras();
  eq(l.length, 1); eq(l[0].nome, 'Obra A');
});
test('apagar uma obra', async () => {
  await limpo(); await store.guardarObra(obra('a', 'A', 1)); await store.apagarObra('a');
  eq((await store.listarObras()).length, 0);
});
test('importar texto que não é JSON: recusa e não mexe nos dados', async () => {
  await limpo(); await store.guardarObra(obra('a', 'A', 1));
  const r = await store.aplicarImport('abc');
  eq(r.ok, false); ok(r.erro); eq((await store.listarObras()).length, 1);
});
test('importar JSON sem versão ou sem obras: recusa', async () => {
  await limpo();
  eq((await store.aplicarImport('{"obras":[]}')).ok, false);
  eq((await store.aplicarImport('{"versao":1}')).ok, false);
  eq((await store.aplicarImport('[1,2]')).ok, false);
  eq((await store.aplicarImport(pacote([{ nome: 'sem id' }]))).ok, false);
});
test('importar junta obras novas às existentes', async () => {
  await limpo(); await store.guardarObra(obra('a', 'A', 1));
  const r = await store.aplicarImport(pacote([obra('b', 'B', 1)]));
  eq(r.ok, true); eq(r.novas, 1); eq((await store.listarObras()).length, 2);
});
test('importar versão mais antiga não substitui a do aparelho', async () => {
  await limpo(); await store.guardarObra(obra('a', 'Recente', 200));
  const r = await store.aplicarImport(pacote([obra('a', 'Antiga', 100)]));
  eq(r.atualizadas, 0); eq((await store.listarObras())[0].nome, 'Recente');
});
test('importar versão mais recente substitui', async () => {
  await limpo(); await store.guardarObra(obra('a', 'Antiga', 100));
  const r = await store.aplicarImport(pacote([obra('a', 'Recente', 200)]));
  eq(r.atualizadas, 1); eq((await store.listarObras())[0].nome, 'Recente');
});
test('analisar importação não altera nada', async () => {
  await limpo();
  const r = await store.analisarImport(pacote([obra('z', 'Z', 1)]));
  eq(r.ok, true); eq(r.novas, 1); eq((await store.listarObras()).length, 0);
});
test('exportar devolve tudo e volta a importar-se', async () => {
  await limpo(); await store.guardarObra(obra('a', 'A', 5));
  const txt = await store.exportar(); const d = JSON.parse(txt);
  eq(d.versao, 1); eq(d.obras.length, 1); ok(d.precos);
  await store.apagarObra('a');
  eq((await store.aplicarImport(txt)).novas, 1);
});
test('preços: devolve os de exemplo até serem guardados', async () => {
  await limpo();
  const p = await store.lerPrecos(); ok(p.kg.aco > 0);
  p.kg.aco = 9; p.exemplo = false; await store.guardarPrecos(p);
  eq((await store.lerPrecos()).kg.aco, 9);
  await store.guardarPrecos(null);
});
test('identificadores novos são únicos', () => ok(store.novoId() !== store.novoId()));

// --- revisão final ---
test('importar obra sem lista de trabalhos ou com trabalho incompleto: recusa', async () => {
  await limpo();
  eq((await store.aplicarImport(JSON.stringify({ versao: 1, obras: [{ id: 'x' }] }))).ok, false);
  const mau = { ...obra('y', 'Y', 1), trabalhos: [{ id: 't', tipo: 'guarda' }] };
  eq((await store.aplicarImport(pacote([mau]))).ok, false);
  const tipo = { ...obra('y', 'Y', 1), trabalhos: [{ id: 't', tipo: 'foguetao', medidas: {}, precos: {} }] };
  eq((await store.aplicarImport(pacote([tipo]))).ok, false);
  eq((await store.aplicarImport(pacote([obra('a"><img src=x>', 'Z', 1)]))).ok, false);
  eq((await store.listarObras()).length, 0);
});
test('importar com preços: só substitui a tabela quando pedido', async () => {
  await limpo(); await store.guardarPrecos(null);
  const txt = pacote([], { precos: { kg: { aco: 3 } }, empresa: { morada: 'Rua B' } });
  eq((await store.analisarImport(txt)).temPrecos, true);
  await store.aplicarImport(txt);
  ok((await store.lerPrecos()).kg.aco !== 3);
  await store.aplicarImport(txt, { comPrecos: true });
  eq((await store.lerPrecos()).kg.aco, 3); eq((await store.lerEmpresa()).morada, 'Rua B');
  await store.guardarPrecos(null); await store.guardarEmpresa(null);
});

// --- cópia de segurança com os tipos novos e com os anexos ---
const trab = (id, tipo, fotos) => ({ id, tipo, nome: 'T', medidas: {}, precos: {}, ...(fotos ? { fotos } : {}) });
test('a cópia de segurança aceita todos os tipos de trabalho da app, incluindo os novos', async () => {
  await limpo();
  const { TIPOS } = await import('../js/calc.js');
  const o = { ...obra('n', 'Novos', 5), trabalhos: Object.keys(TIPOS).map((t, i) => trab('t' + i, t)) };
  const r = await store.aplicarImport(pacote([o]));
  eq(r.ok, true); eq((await store.lerObra('n')).trabalhos.length, Object.keys(TIPOS).length);
  eq((await store.aplicarImport(pacote([{ ...obra('m', 'M', 5), trabalhos: [trab('x', 'foguetao')] }]))).ok, false);
});
test('fotos, desenho e articulado vão na cópia e voltam ao carregar', async () => {
  await limpo();
  const FOTO = 'data:image/jpeg;base64,/9j/AAAA';
  await store.guardarObra({ ...obra('a', 'A', 5), trabalhos: [trab('t1', 'guarda', [{ id: 'f1', legenda: 'canto' }])] });
  await store.guardarAnexo('foto:f1', FOTO); await store.guardarAnexo('dxf:a', { nome: 'p.dxf', texto: '0\nEOF', fator: 1 }); await store.guardarAnexo('art:a', { linhas: [] });
  const txt = await store.exportar(), d = JSON.parse(txt);
  eq(d.anexos['foto:f1'], FOTO); eq(d.anexos['dxf:a'].nome, 'p.dxf'); ok(d.anexos['art:a']);
  await store.apagarObra('a'); eq(await store.lerAnexo('foto:f1'), undefined);
  eq((await store.aplicarImport(txt)).novas, 1);
  eq(await store.lerAnexo('foto:f1'), FOTO); eq((await store.lerAnexo('dxf:a')).nome, 'p.dxf');
  await store.apagarObra('a');
});
test('anexos estranhos numa cópia são ignorados: outra obra, chave inválida, foto que não é imagem', async () => {
  await limpo();
  const o = { ...obra('a', 'A', 5), trabalhos: [trab('t1', 'guarda', [{ id: 'f1', legenda: '' }, { id: 'f2', legenda: '' }])] };
  const txt = pacote([o], { anexos: { 'foto:f1': 'data:text/html;base64,AAAA', 'foto:f2': 'data:image/png;base64,AAAA', 'foto:zz': 'data:image/png;base64,AAAA', 'dxf:outra': { nome: 'x' }, 'precos': { kg: {} }, 'tentativas': null, 'dxf:a': 'texto' } });
  eq((await store.aplicarImport(txt)).ok, true);
  eq(await store.lerAnexo('foto:f1'), undefined); eq(await store.lerAnexo('foto:f2'), 'data:image/png;base64,AAAA');
  eq(await store.lerAnexo('foto:zz'), undefined); eq(await store.lerAnexo('dxf:outra'), undefined); eq(await store.lerAnexo('dxf:a'), undefined);
  eq((await store.aplicarImport(pacote([obra('b', 'B', 1)], { anexos: [1, 2] }))).ok, true);
  await store.apagarObra('a'); await store.apagarObra('b');
});
test('uma obra que já está em dia no aparelho não vê as fotos trocadas pelas do ficheiro', async () => {
  await limpo();
  await store.guardarObra({ ...obra('a', 'A', 50), trabalhos: [trab('t1', 'guarda', [{ id: 'f1', legenda: '' }])] });
  await store.guardarAnexo('foto:f1', 'data:image/png;base64,MINHA');
  const antiga = { ...obra('a', 'A', 10), trabalhos: [trab('t1', 'guarda', [{ id: 'f1', legenda: '' }])] };
  await store.aplicarImport(pacote([antiga], { anexos: { 'foto:f1': 'data:image/png;base64,OUTRA' } }));
  eq(await store.lerAnexo('foto:f1'), 'data:image/png;base64,MINHA');
  await store.apagarObra('a');
});
