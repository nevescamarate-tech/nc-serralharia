// Pergunta de confirmação desenhada na própria página. Substitui o confirm()/alert() do navegador, que alguns
// navegadores (o de dentro do Claude, ou depois de «impedir esta página de criar mais caixas») não mostram e respondem «não».

/**
 * Mostra uma pergunta e devolve uma promessa: true se confirmar, false se cancelar, carregar fora ou Escape.
 * opcoes: { sim: texto do botão de confirmar, nao: texto do de cancelar, so: true para um aviso com um único botão OK }
 */
export function pergunta(texto, { sim = 'Sim', nao = 'Cancelar', so = false } = {}) {
  document.querySelectorAll('.pergunta').forEach(c => c.remove());
  return new Promise(responde => {
    const fundo = document.createElement('div');
    fundo.className = 'pergunta';
    fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-modal', 'true');
    const caixa = document.createElement('div'); caixa.className = 'pergunta-caixa';
    const p = document.createElement('p'); p.textContent = texto;
    const botoes = document.createElement('div'); botoes.className = 'pergunta-botoes';
    const botao = (r, txt, cls) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.r = r; b.className = cls; b.textContent = txt; botoes.append(b); return b; };
    if (!so) botao('nao', nao, 'b-sec');
    const ok = botao('sim', so ? 'OK' : sim, so ? 'b-pri' : 'b-per');
    caixa.append(p, botoes); fundo.append(caixa); document.body.append(fundo);
    const fecha = r => { document.removeEventListener('keydown', tecla); fundo.remove(); responde(r); };
    const tecla = e => { if (e.key === 'Escape') fecha(so); };
    fundo.onclick = e => { if (e.target === fundo) return fecha(so); const b = e.target.closest('button'); if (b) fecha(b.dataset.r === 'sim'); };
    document.addEventListener('keydown', tecla);
    setTimeout(() => (so ? ok : botoes.querySelector('[data-r="nao"]')).focus(), 0);
  });
}
