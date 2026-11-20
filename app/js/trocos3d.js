// Tubagem flangeada no separador 3D: troço a troço, vistas, camadas e a ficha do troço escolhido.
import { esc } from './fmt.js';
import { fichaTroco, tabelaLigacoes } from './fichas.js';

/** Monta (ou refaz) a barra e a ficha por baixo do 3D. Chamar depois de cada vista.mostrar(res). */
export function painelTrocos(caixa, vista, res) {
  const fg = res && res.flangeada;
  if (!caixa || !fg) { if (caixa) caixa.innerHTML = ''; return; }
  const ids = fg.trocos.map(t => t.id), ver = { tro: caixa.dataset.tro !== '0', lig: caixa.dataset.lig !== '0' };
  caixa.innerHTML = `<div class="fl-barra"><select id="fl-sel" aria-label="Troço"><option value="">Troço a troço: escolher…</option>${fg.trocos.map(t => `<option value="${esc(t.id)}">${esc(t.id)} — ${esc(t.nome)}</option>`).join('')}</select>
<button type="button" class="b-sec" data-nav="-1">◀ Anterior</button><button type="button" class="b-sec" data-nav="1">Seguinte ▶</button><button type="button" class="b-sec" data-nav="0">Mostrar tudo</button></div>
<div class="fl-barra"><span class="dica">Vistas:</span><button type="button" class="b-sec" data-v="iso">3D</button><button type="button" class="b-sec" data-v="planta">Planta</button><button type="button" class="b-sec" data-v="frente">De frente</button><button type="button" class="b-sec" data-v="lado">De lado</button>
<label><input type="checkbox" data-c="tro" ${ver.tro ? 'checked' : ''}> Nome dos troços</label><label><input type="checkbox" data-c="lig" ${ver.lig ? 'checked' : ''}> N.º das ligações</label></div>
<p class="dica">Clicar num troço, no 3D ou na etiqueta, abre a sua ficha. Ligações: <b style="color:#5e9732">inox – inox</b> · <b style="color:#e69500">inox – ferro fundido (kit de isolamento)</b> · <b style="color:#8c8c8c">ferro – ferro</b>.</p>
<div id="fl-ficha"></div>`;
  const sel = caixa.querySelector('#fl-sel'), ficha = caixa.querySelector('#fl-ficha');
  function abre(id) {
    if (!ids.includes(id)) id = '';
    caixa.dataset.sel = id; sel.value = id; vista.destacar(id || null);
    const f = id ? fichaTroco(res, id) : null;
    ficha.innerHTML = f ? `<h3>Ficha do troço ${esc(f.troco.id)} — ${esc(f.troco.nome)}</h3>
<p class="dica">${esc(f.troco.dn)} · comprimento ${esc(f.troco.L)} mm${f.troco.angulos.length ? ' · curvas: ' + f.troco.angulos.map(a => String(a).replace('.', ',') + '°').join(', ') : ''}. Medidas de projeto, a confirmar em obra.</p>
${f.svg}${f.flanges.length ? `<h3>Furação das flanges</h3><div class="fl-flanges">${f.flanges.map(x => x.svg).join('')}</div>` : ''}${tabelaLigacoes(f)}` : '';
  }
  vista.camadas(ver); vista.aoClicar = abre;
  sel.onchange = () => abre(sel.value);
  caixa.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) return vista.vistaDe(b.dataset.v);
    if (b.dataset.nav === '0') return abre('');
    if (b.dataset.nav) { const i = ids.indexOf(caixa.dataset.sel || ''), n = ids.length; abre(ids[i < 0 ? (b.dataset.nav === '1' ? 0 : n - 1) : (i + +b.dataset.nav + n) % n]); }
  };
  caixa.onchange = e => { const c = e.target.dataset.c; if (!c) return; caixa.dataset[c] = e.target.checked ? '1' : '0'; vista.camadas({ [c]: e.target.checked }); };
  abre(caixa.dataset.sel || '');
}
