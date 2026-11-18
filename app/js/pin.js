// Bloqueio da app com PIN, um por pessoa. Guarda só um resumo com sal (PBKDF2), nunca o PIN.
// Protege de quem pega no aparelho; não cifra as obras guardadas. Todos os PIN dão o mesmo acesso.
import { kv } from './store.js';

export const MAX_PINS = 4;
const VOLTAS = 150000;
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const deHex = s => new Uint8Array((String(s).match(/../g) || []).map(x => parseInt(x, 16)));
const valido = pin => typeof pin === 'string' && /^\d{4,8}$/.test(pin);
const ERRO_FORMATO = 'O PIN tem de ter 4 a 8 algarismos.';

async function resumo(pin, sal) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: VOLTAS }, chave, 256));
}
async function novoRegisto(nome, pin) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { nome, s: hex(sal), h: await resumo(pin, sal) };
}
function igual(a, b) {
  let dif = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length);
  return dif === 0;
}
/** Lista guardada; converte o PIN único das versões anteriores da app. */
async function ler() {
  const l = await kv.ler('pins');
  if (Array.isArray(l)) return l.filter(p => p && p.h && p.s);
  const antigo = await kv.ler('pin');
  return antigo && antigo.h && antigo.s ? [{ nome: 'Utilizador 1', s: antigo.s, h: antigo.h }] : [];
}
async function gravar(l) { await kv.guardar('pins', l.length ? l : null); await kv.guardar('pin', null); }
async function indiceDe(pin, lista) {
  if (typeof pin !== 'string' || !pin) return -1;
  for (let i = 0; i < lista.length; i++) if (igual(await resumo(pin, deHex(lista[i].s)), lista[i].h)) return i;
  return -1;
}

export async function temPin() { return (await ler()).length > 0; }
export async function listarPins() { return (await ler()).map(p => ({ nome: p.nome })); }
/** Nome da pessoa a quem pertence o PIN, ou null. */
export async function quemE(pin) { const l = await ler(), i = await indiceDe(pin, l); return i < 0 ? null : l[i].nome; }
export async function verificarPin(pin) { return (await quemE(pin)) !== null; }

export async function adicionarPin(nome, pin) {
  const n = String(nome ?? '').trim().slice(0, 30);
  if (!n) return { ok: false, erro: 'Indique o nome da pessoa.' };
  if (!valido(pin)) return { ok: false, erro: ERRO_FORMATO };
  const l = await ler();
  if (l.length >= MAX_PINS) return { ok: false, erro: `Já existem ${MAX_PINS} PIN, que é o máximo.` };
  if (await indiceDe(pin, l) >= 0) return { ok: false, erro: 'Esse PIN já está a ser usado por outra pessoa.' };
  l.push(await novoRegisto(n, pin)); await gravar(l);
  return { ok: true };
}
export async function mudarPin(indice, pin) {
  const l = await ler();
  if (!l[indice]) return { ok: false, erro: 'Pessoa não encontrada.' };
  if (!valido(pin)) return { ok: false, erro: ERRO_FORMATO };
  const dono = await indiceDe(pin, l);
  if (dono >= 0 && dono !== indice) return { ok: false, erro: 'Esse PIN já está a ser usado por outra pessoa.' };
  l[indice] = await novoRegisto(l[indice].nome, pin); await gravar(l);
  return { ok: true };
}
/** Sem índice remove todos os PIN; com índice remove só o dessa pessoa. */
export async function removerPin(indice) {
  if (indice === undefined) return gravar([]);
  const l = await ler(); l.splice(indice, 1); return gravar(l);
}
/** Define o primeiro PIN (ou substitui o primeiro), como nas versões anteriores. */
export async function definirPin(pin, nome = 'Utilizador 1') {
  if (!valido(pin)) return { ok: false, erro: ERRO_FORMATO };
  const l = await ler();
  if (!l.length) return adicionarPin(nome, pin);
  return mudarPin(0, pin);
}
