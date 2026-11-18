// Bloqueio da app com PIN. Guarda só um resumo com sal (PBKDF2), nunca o PIN.
// Protege de quem pega no aparelho; não cifra as obras guardadas.
import { kv } from './store.js';

const VOLTAS = 150000;
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const deHex = s => new Uint8Array((s.match(/../g) || []).map(x => parseInt(x, 16)));

async function resumo(pin, sal) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: VOLTAS }, chave, 256));
}

export async function temPin() { const p = await kv.ler('pin'); return !!(p && p.h && p.s); }

export async function definirPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return { ok: false, erro: 'O PIN tem de ter 4 a 8 algarismos.' };
  const sal = crypto.getRandomValues(new Uint8Array(16));
  await kv.guardar('pin', { s: hex(sal), h: await resumo(pin, sal) });
  return { ok: true };
}

export async function verificarPin(pin) {
  const p = await kv.ler('pin');
  if (!p || !p.h || !p.s || typeof pin !== 'string' || !pin) return false;
  const h = await resumo(pin, deHex(p.s));
  let dif = h.length ^ p.h.length;
  for (let i = 0; i < h.length; i++) dif |= h.charCodeAt(i) ^ p.h.charCodeAt(i % p.h.length);
  return dif === 0;
}

export const removerPin = () => kv.guardar('pin', null);
