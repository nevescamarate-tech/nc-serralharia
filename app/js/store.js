// Dados no aparelho: IndexedDB, com memória + localStorage como recurso.
import { PRECOS_EXEMPLO } from './catalogo.js';

let db = null, nomeBD = 'nc-serralharia';
let mem = null;   // recurso se o IndexedDB não estiver disponível

const clone = o => JSON.parse(JSON.stringify(o));
const pedido = req => new Promise((ok, ko) => { req.onsuccess = () => ok(req.result); req.onerror = () => ko(req.error); });

export function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function abrir(nome = 'nc-serralharia') {
  nomeBD = nome; db = null; mem = null;
  try {
    const req = indexedDB.open(nome, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('obras', { keyPath: 'id' });
      req.result.createObjectStore('kv');
    };
    db = await pedido(req);
  } catch (e) {
    mem = { obras: {}, kv: {} };
    try { Object.assign(mem, JSON.parse(localStorage.getItem(nome) || '{}')); } catch (e2) { /* sem armazenamento */ }
    mem.obras = mem.obras || {}; mem.kv = mem.kv || {};
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* opcional */ }
}
function gravaMem() { try { localStorage.setItem(nomeBD, JSON.stringify(mem)); } catch (e) { /* cheio ou bloqueado */ } }
async function pronto() { if (!db && !mem) await abrir(nomeBD); }
const tx = (loja, modo = 'readonly') => db.transaction(loja, modo).objectStore(loja);

async function kvLer(chave) {
  await pronto();
  return mem ? mem.kv[chave] : pedido(tx('kv').get(chave));
}
async function kvGuardar(chave, valor) {
  await pronto();
  if (mem) { if (valor == null) delete mem.kv[chave]; else mem.kv[chave] = valor; gravaMem(); return; }
  await pedido(valor == null ? tx('kv', 'readwrite').delete(chave) : tx('kv', 'readwrite').put(valor, chave));
}

export async function listarObras() {
  await pronto();
  const l = mem ? Object.values(mem.obras) : await pedido(tx('obras').getAll());
  return clone(l).sort((a, b) => (b.alterado || 0) - (a.alterado || 0));
}
export async function lerObra(id) {
  await pronto();
  const o = mem ? mem.obras[id] : await pedido(tx('obras').get(id));
  return o ? clone(o) : null;
}
export async function guardarObra(obra) {
  await pronto();
  const o = clone(obra);
  if (mem) { mem.obras[o.id] = o; gravaMem(); } else await pedido(tx('obras', 'readwrite').put(o));
  if (!(await kvLer('primeiroUso'))) await kvGuardar('primeiroUso', Date.now());
  await kvGuardar('porCopiar', true);
}
export async function apagarObra(id) {
  await pronto();
  if (mem) { delete mem.obras[id]; gravaMem(); } else await pedido(tx('obras', 'readwrite').delete(id));
  await kvGuardar('anexo:dxf:' + id, null); await kvGuardar('anexo:art:' + id, null);
}

/** Preços guardados, completados com os de exemplo no que faltar. */
export async function lerPrecos() {
  const g = await kvLer('precos'), d = clone(PRECOS_EXEMPLO);
  if (!g) return d;
  const r = { ...d, ...g };
  for (const k of ['kg', 'm2', 'acessorios', 'acabamento']) r[k] = { ...d[k], ...(g[k] || {}) };
  return r;
}
export const guardarPrecos = p => kvGuardar('precos', p);
export async function lerEmpresa() { return (await kvLer('empresa')) || { nome: 'NC Serralharia', morada: '', nif: '', telefone: '', email: '' }; }
export const guardarEmpresa = e => kvGuardar('empresa', e);

export async function exportar() {
  const dados = { versao: 1, exportado: new Date().toISOString(), obras: await listarObras(), precos: await lerPrecos(), empresa: await lerEmpresa() };
  await kvGuardar('ultimaCopia', Date.now()); await kvGuardar('porCopiar', null);
  return JSON.stringify(dados, null, 1);
}

function validar(texto) {
  let d;
  try { d = JSON.parse(texto); } catch (e) { return { erro: 'O ficheiro não é uma cópia de segurança válida.' }; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.versao !== 'number' || !Array.isArray(d.obras))
    return { erro: 'O ficheiro não tem o formato da NC Serralharia.' };
  if (d.versao > 1) return { erro: 'O ficheiro foi criado por uma versão mais recente da app.' };
  const idBom = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v), obj = v => v && typeof v === 'object' && !Array.isArray(v);
  const trabalhoBom = t => obj(t) && idBom(t.id) && TIPOS_VALIDOS.includes(t.tipo) && obj(t.medidas) && obj(t.precos);
  if (!d.obras.every(o => obj(o) && idBom(o.id) && Array.isArray(o.trabalhos) && o.trabalhos.every(trabalhoBom)))
    return { erro: 'O ficheiro tem obras ou trabalhos incompletos.' };
  return { d };
}
const TIPOS_VALIDOS = ['guarda', 'corrimao', 'portao'];
const temObjeto = v => !!v && typeof v === 'object' && !Array.isArray(v);
async function comparar(d) {
  const novas = [], atualizadas = []; let iguais = 0;
  for (const o of d.obras) {
    const atual = await lerObra(o.id);
    if (!atual) novas.push(o);
    else if ((o.alterado || 0) > (atual.alterado || 0)) atualizadas.push(o);
    else iguais++;
  }
  return { novas, atualizadas, iguais };
}
/** Diz o que a importação faria, sem alterar nada. */
export async function analisarImport(texto) {
  const { d, erro } = validar(texto);
  if (erro) return { ok: false, erro };
  const c = await comparar(d);
  return { ok: true, novas: c.novas.length, atualizadas: c.atualizadas.length, iguais: c.iguais, temPrecos: temObjeto(d.precos) };
}
/**
 * Junta as obras do ficheiro às do aparelho; em conflito fica a mais recente.
 * Com comPrecos, substitui também a tabela de preços e os dados da empresa pelos do ficheiro.
 */
export async function aplicarImport(texto, { comPrecos = false } = {}) {
  const { d, erro } = validar(texto);
  if (erro) return { ok: false, erro };
  const c = await comparar(d);
  for (const o of [...c.novas, ...c.atualizadas]) await guardarObra(o);
  if (comPrecos) {
    if (temObjeto(d.precos)) await guardarPrecos(d.precos);
    if (temObjeto(d.empresa)) await guardarEmpresa(d.empresa);
  }
  return { ok: true, novas: c.novas.length, atualizadas: c.atualizadas.length, iguais: c.iguais };
}

/** Dias desde a última cópia de segurança com alterações por copiar (0 se estiver em dia). */
export async function diasSemCopia() {
  if (!(await kvLer('porCopiar'))) return 0;
  const desde = (await kvLer('ultimaCopia')) || (await kvLer('primeiroUso'));
  return desde ? Math.floor((Date.now() - desde) / 864e5) : 0;
}

/** Anexos de uma obra (desenho DXF, articulado). Ficam só neste aparelho e não entram na cópia de segurança. */
export const guardarAnexo = (chave, valor) => kvGuardar('anexo:' + chave, valor);
export const lerAnexo = chave => kvLer('anexo:' + chave);

/** Valores soltos guardados no aparelho (definições internas, como o PIN). Não entram na cópia de segurança. */
export const kv = { ler: kvLer, guardar: kvGuardar };
