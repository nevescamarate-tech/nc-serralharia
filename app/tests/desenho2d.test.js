import { test, ok, eq } from './t.js';
import { alcadoSVG, plantaSVG } from '../js/desenho2d.js';
import { calcGuarda } from '../js/modelos/guarda.js';
import { calcPortao } from '../js/modelos/portao.js';

const conta = (s, re) => (s.match(re) || []).length;

test('alçado da guarda de 3000 tem as cotas 3000 e 1100', () => {
  const svg = alcadoSVG(calcGuarda({ trocos: [{ comp: 3000 }] }));
  ok(svg.startsWith('<svg')); ok(svg.includes('>3000<'), 'falta 3000'); ok(svg.includes('>1100<'), 'falta 1100');
});
test('alçado desenha pelo menos uma forma por peça', () => {
  const r = calcGuarda({ trocos: [{ comp: 3000 }] });
  ok(conta(alcadoSVG(r), /<polygon /g) >= r.pecas.length);
});
test('alçado do portão tem largura e altura do vão', () => {
  const svg = alcadoSVG(calcPortao({ largura: 3000, altura: 1800, tipo: 'batente2' }));
  ok(svg.includes('>3000<')); ok(svg.includes('>1800<'));
});
test('planta de dois troços mostra os dois comprimentos', () => {
  const svg = plantaSVG(calcGuarda({ trocos: [{ comp: 2000 }, { comp: 1500, viragem: 90 }] }));
  ok(svg.includes('>2000<')); ok(svg.includes('>1500<'));
});
test('resultado vazio: SVG válido com «sem medidas», sem NaN', () => {
  for (const f of [alcadoSVG, plantaSVG]) {
    const svg = f(calcGuarda({}));
    ok(svg.startsWith('<svg')); ok(/sem medidas/i.test(svg)); ok(!svg.includes('NaN'));
  }
});

// --- vista de topo (corte transversal / vista do pé) ---
test('vista de topo de uma guarda: corte estreito com a altura cotada, sem repetir os varões todos', async () => {
  const { vistaTopoSVG } = await import('../js/desenho2d.js');
  const r = calcGuarda({ trocos: [{ comp: 3000 }] }), v = vistaTopoSVG(r);
  ok(v.svg.startsWith('<svg')); ok(v.svg.includes('>1100<')); ok(v.largura < 200, 'guarda a direito é estreita: ' + v.largura);
  ok(conta(v.svg, /class="pc"/g) < 12, 'peças repetidas não se desenham duas vezes');
});
test('vista de topo de uma escada: vê-se a largura entre banzos e os degraus atravessados', async () => {
  const { vistaTopoSVG } = await import('../js/desenho2d.js');
  const { calcEscada } = await import('../js/modelos/escada.js');
  const v = vistaTopoSVG(calcEscada({ desnivel: 1620, largura: 1220, cobertor: 300 }));
  ok(v.largura > 1220 && v.largura < 1400); ok(v.svg.includes('>1620<')); ok(conta(v.svg, /class="pf"/g) === 8, 'um retângulo por degrau');
});
test('vista de topo: tubagem e trabalhos vazios não têm', async () => {
  const { vistaTopoSVG } = await import('../js/desenho2d.js');
  const { calcTubagem } = await import('../js/modelos/tubagem.js');
  eq(vistaTopoSVG(calcTubagem({ dn: 50, trocos: [{ comp: 2000, dir: 'dir' }] })), null);
  eq(vistaTopoSVG(calcGuarda({ trocos: [{ comp: '' }] })), null); eq(vistaTopoSVG(null), null);
});
