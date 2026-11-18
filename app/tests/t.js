// Arnês de testes mínimo, para correr no browser.
export const testes = [];
export function test(nome, fn) { testes.push({ nome, fn }); }
export function ok(v, msg = 'esperava verdadeiro') { if (!v) throw new Error(msg); }
export function eq(a, b) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`esperava ${y}, obtive ${x}`);
}
export function perto(a, b, tol = 0.5) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`esperava ≈${b} (±${tol}), obtive ${a}`);
}
// Verdadeiro se não houver NaN/Infinity em nenhum número da estrutura.
export function semNaN(o) {
  let bom = true;
  JSON.stringify(o, (k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bom = false; return v; });
  return bom;
}
