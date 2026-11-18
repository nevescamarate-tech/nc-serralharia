// Otimização de corte em varas comerciais: maior primeiro, na primeira vara onde caiba.

export function planoCorte(pecas, { vara = 6000, serra = 3 } = {}) {
  if (!(vara > 0)) vara = 6000;
  if (!(serra >= 0)) serra = 3;
  const avisos = [];
  const grupos = new Map();
  for (const p of pecas || []) {
    if (!(p.L > 0)) continue;
    if (!grupos.has(p.perfil)) grupos.set(p.perfil, []);
    grupos.get(p.perfil).push(p);
  }
  const porPerfil = [];
  for (const [perfil, lista] of grupos) {
    const ordenadas = [...lista].sort((a, b) => b.L - a.L);
    const varas = [];
    let extra = 0, totalUtil = 0;
    for (const p of ordenadas) {
      totalUtil += p.L;
      const corte = { L: p.L, ang: p.ang || [0, 0], grupo: p.grupo };
      if (p.L > vara) {
        const n = Math.ceil(p.L / vara);
        avisos.push(`Peça de ${Math.round(p.L)} mm maior do que a vara de ${vara} mm: precisa de emenda (${n} varas).`);
        varas.push({ cortes: [corte], sobra: n * vara - p.L, emenda: true, n });
        extra += n - 1;
        continue;
      }
      let v = varas.find(x => !x.emenda && x.sobra >= p.L);
      if (!v) { v = { cortes: [], sobra: vara }; varas.push(v); }
      v.cortes.push(corte);
      v.sobra = Math.max(0, v.sobra - p.L - serra);
    }
    const nVaras = varas.length + extra;
    porPerfil.push({ perfil, varas, nVaras, totalUtil, desperdicio: nVaras * vara - totalUtil });
  }
  return { porPerfil, avisos };
}
