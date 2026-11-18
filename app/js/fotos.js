// Fotos dos trabalhos: reduzidas antes de guardar, para não encher o aparelho.
// Ficam só neste aparelho (não entram na cópia de segurança).
import { guardarAnexo, lerAnexo, novoId } from './store.js';

export const MAX_FOTOS = 12;
const LADO = 1600, QUALIDADE = 0.8;

/** Reduz uma imagem para caber em `lado` píxeis e devolve um data URL JPEG. null se não for imagem. */
export async function reduzirFoto(ficheiro, lado = LADO) {
  if (!ficheiro || !/^image\//.test(ficheiro.type || '')) return null;
  let img;
  try { img = await createImageBitmap(ficheiro, { imageOrientation: 'from-image' }); }
  catch (e) { try { img = await createImageBitmap(ficheiro); } catch (e2) { return null; } }
  const k = Math.min(1, lado / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  if (img.close) img.close();
  try { return c.toDataURL('image/jpeg', QUALIDADE); } catch (e) { return null; }
}

/** Reduz e guarda uma foto. Devolve { id, legenda } para pôr no trabalho, ou null se não for imagem. */
export async function guardarFoto(ficheiro) {
  const url = await reduzirFoto(ficheiro);
  if (!url) return null;
  const id = novoId();
  await guardarAnexo('foto:' + id, url);
  return { id, legenda: '' };
}
export async function lerFoto(id) { return (await lerAnexo('foto:' + id)) || null; }
export async function apagarFotos(fotos) { for (const f of fotos || []) if (f && f.id) await guardarAnexo('foto:' + f.id, null); }
/** Duplica as fotos (para duplicar uma obra): cada cópia fica com identificador próprio. */
export async function copiarFotos(fotos) {
  const out = [];
  for (const f of fotos || []) {
    const url = f && f.id ? await lerFoto(f.id) : null;
    if (!url) continue;
    const id = novoId(); await guardarAnexo('foto:' + id, url); out.push({ id, legenda: f.legenda || '' });
  }
  return out;
}
