// Modo sem rede: guarda todos os ficheiros da app. Mudar a versão ao publicar alterações.
const VERSAO = 'nc-v17';
const FICHEIROS = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/print.css',
  'img/icon.svg', 'img/icon-192.png', 'img/icon-512.png', 'img/logo-nc.svg',
  'vendor/three.module.min.js', 'vendor/OrbitControls.js',
  'js/app.js', 'js/store.js', 'js/catalogo.js', 'js/calc.js', 'js/corte.js', 'js/custo.js', 'js/desenho2d.js',
  'js/vista3d.js', 'js/formularios.js', 'js/folhas.js', 'js/fmt.js', 'js/dxf.js', 'js/articulado.js', 'js/importar.js', 'js/pin.js', 'js/acesso.js', 'js/fotos.js', 'js/preparacao.js', 'js/xlsx.js', 'js/livro.js',
  'js/modelos/util.js', 'js/modelos/guarda.js', 'js/modelos/corrimao.js', 'js/modelos/portao.js', 'js/modelos/tubagem.js', 'js/modelos/telheiro.js', 'js/modelos/grade.js', 'js/modelos/escada.js', 'js/modelos/gradeamento.js', 'js/modelos/abrigo.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO).then(c => c.addAll(FICHEIROS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Cópia guardada primeiro (abre logo, mesmo com sinal fraco); a rede atualiza a cópia em segundo plano.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSAO).then(async c => {
    const guardado = await c.match(e.request, { ignoreSearch: true });
    // 'no-cache' obriga a confirmar com o servidor, para a cópia guardada não ficar presa a ficheiros antigos
    const rede = fetch(e.request.url, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (guardado) { e.waitUntil(rede); return guardado; }
    return (await rede) || (await c.match('index.html')) || Response.error();
  }));
});
