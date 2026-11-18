// Bloqueio da app com PIN fixos (js/acesso.js). No código ficam só resumos com sal (PBKDF2-SHA256).
// É uma barreira contra curiosos: o código da app é público, por isso não trava quem saiba alterá-lo.
import { kv } from './store.js';
import { SAL, VOLTAS, ACESSOS } from './acesso.js';

const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const deHex = s => new Uint8Array((String(s).match(/../g) || []).map(x => parseInt(x, 16)));

/** Resumo de um PIN (hex). Por omissão usa o sal e o número de voltas da app. */
export async function resumoPin(pin, salHex = SAL, voltas = VOLTAS) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(salHex), iterations: voltas }, chave, 256));
}
function igual(a, b) {
  let dif = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length);
  return dif === 0;
}
/** Nome do acesso a que o PIN pertence, ou null. Só aceita 4 a 12 algarismos. */
export async function quemE(pin, lista = ACESSOS, salHex = SAL, voltas = VOLTAS) {
  if (typeof pin !== 'string' || !/^\d{4,12}$/.test(pin)) return null;
  const h = await resumoPin(pin, salHex, voltas);
  let nome = null;
  for (const a of lista) if (a && typeof a.h === 'string' && igual(h, a.h)) nome = a.nome;
  return nome;
}
export async function verificarPin(...args) { return (await quemE(...args)) !== null; }
export function temPin() { return ACESSOS.length > 0; }

// Tentativas falhadas: ficam guardadas no aparelho, para recarregar a página não as apagar.
// A cada 5 falhas seguidas há uma espera, que duplica: 30 s, 1 min, 2 min… até 1 hora.
const POR_BLOCO = 5, BASE_S = 30, MAX_S = 3600;
export async function esperaSegundos(agora = Date.now()) {
  const t = await kv.ler('tentativas');
  return t && t.ate > agora ? Math.ceil((t.ate - agora) / 1000) : 0;
}
/** Regista uma falha e devolve os segundos de espera que ela causou (0 se ainda não há espera). */
export async function registarFalha(agora = Date.now()) {
  const t = (await kv.ler('tentativas')) || { n: 0, ate: 0 };
  t.n = (t.n || 0) + 1;
  let espera = 0;
  if (t.n % POR_BLOCO === 0) { espera = Math.min(MAX_S, BASE_S * 2 ** (t.n / POR_BLOCO - 1)); t.ate = agora + espera * 1000; }
  await kv.guardar('tentativas', t);
  return espera;
}
export const limparFalhas = () => kv.guardar('tentativas', null);
