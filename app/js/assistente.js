// Ecrã «Pedir solução ao Claude»: fotografia e/ou descrição → proposta de trabalho com alternativas.
// Dois caminhos: copiar e colar numa conversa do Claude (sem chave, sem custo extra) ou ligação direta com chave da API.
import * as store from './store.js';
import { TIPOS } from './calc.js';
import { CAMPOS } from './formularios.js';
import { esc } from './fmt.js';
import { reduzirFoto } from './fotos.js';
import { pedirSolucao, pedidoParaColar, interpretarColado, resumoProposta } from './claude.js';

const $ = (s, el = document) => el.querySelector(s);
function cartao(s, i, principal) {
  const linhas = resumoProposta(s).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>`).join('');
  const fora = s.tipo === 'livre' && s.ignorados.length ? `<p class="alerta">Ficou de fora, por a aplicação não conhecer: ${esc(s.ignorados.join('; '))}.</p>` : '';
  return `<section class="bloco proposta"><p><strong>${principal ? 'Solução proposta' : 'Alternativa'}: ${esc(s.nome)}</strong><br><span class="dica">${esc(TIPOS[s.tipo].nome)}</span></p>
<p>${esc(s.razao)}</p>${fora}${linhas ? `<table class="tab">${linhas}</table>` : '<p class="dica">Sem medidas: introduza-as no trabalho.</p>'}
<button class="${principal ? 'b-pri' : 'b-sec'}" data-criar="${i}">Criar este trabalho</button></section>`;
}
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch (e) { return false; }
}

export async function ecraClaude(obraId, { ecra, topo, aviso, ir, novoTrabalho }) {
  const obra = await store.lerObra(obraId);
  if (!obra) return ir('#/');
  const chave = await store.kv.ler('claudeChave');
  let foto = '';
  ecra.innerHTML = `${topo('Pedir solução ao Claude', `#/obra/${obra.id}`)}
<section class="bloco proposta"><p>Diga o que pretende e as medidas que souber: o Claude não mede pela fotografia.</p>
<label class="campo"><span>O que pretende e medidas que já tem</span><textarea id="c-texto" rows="4" placeholder="ex.: guarda para esta varanda, 3,20 m de comprimento, cliente quer vidro"></textarea></label>
<label class="b-sec ficheiro">Fotografia do local<input type="file" id="c-foto" accept="image/*" capture="environment"></label>
<div id="c-mini"></div>
<p class="dica">A fotografia escolhida aqui fica guardada no trabalho.</p></section>

<h3>Pela sua conta do Claude (copiar e colar)</h3>
<section class="bloco proposta"><ol class="lista-s">
<li>Copie o pedido.</li><li>Abra o Claude, cole o pedido e junte lá a fotografia do local.</li><li>Copie a resposta do Claude e cole-a aqui em baixo.</li></ol>
<button class="b-pri" id="c-copiar">1. Copiar pedido</button>
<a class="b-sec b-claude" id="c-abrir" href="https://claude.ai/new" target="_blank" rel="noopener">2. Abrir o Claude</a>
<textarea id="c-pedido" rows="6" readonly hidden></textarea>
<label class="campo"><span>3. Resposta do Claude</span><textarea id="c-colado" rows="5" placeholder="cole aqui a resposta inteira"></textarea></label>
<button class="b-pri" id="c-ler">Ler resposta</button>
<p class="dica">Usa a conta do Claude que já tem, sem custo por pedido. Nada é enviado por esta aplicação: só vai para o Claude o que colar lá.</p></section>

${chave ? `<h3>Ligação direta (chave da API)</h3>
<section class="bloco proposta"><button class="b-sec" id="c-pedir">Pedir solução diretamente</button>
<p class="dica">A fotografia e o texto são enviados para a Anthropic (Claude) e cada pedido é cobrado na conta da chave. As obras guardadas não são enviadas.</p></section>`
    : '<p class="dica">Ligação direta sem copiar e colar: precisa de uma chave da API, que se introduz em <a href="#/definicoes">Definições</a>.</p>'}
<div id="c-resposta"></div>`;

  $('#c-foto').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    foto = f ? (await reduzirFoto(f, 1568)) || '' : '';
    $('#c-mini').innerHTML = foto ? `<img src="${foto}" alt="Fotografia escolhida" class="c-mini">` : (f ? '<p class="alerta">Não foi possível ler esta fotografia.</p>' : '');
  };

  function mostra(r, texto) {
    const caixa = $('#c-resposta');
    if (!r.ok) { caixa.innerHTML = `<p class="alerta">${esc(r.erro)}</p>${r.observacoes ? `<p>${esc(r.observacoes)}</p>` : ''}`; caixa.scrollIntoView({ block: 'nearest' }); return; }
    const todas = [r.solucao, ...r.alternativas];
    caixa.innerHTML = `<h2>Proposta do Claude</h2>${todas.map((s, i) => cartao(s, i, i === 0)).join('')}
${r.aConfirmar.length ? `<h3>A confirmar no local</h3><section class="bloco"><ul class="lista-s">${r.aConfirmar.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
${r.observacoes ? `<h3>Observações</h3><section class="bloco"><p>${esc(r.observacoes)}</p></section>` : ''}
<p class="dica">É uma proposta: confirme as medidas no local antes de mandar fabricar.</p>`;
    caixa.onclick = async ev => {
      const b = ev.target.closest('[data-criar]'); if (!b) return;
      const s = todas[+b.dataset.criar]; b.disabled = true;
      const notas = [texto, r.observacoes].filter(Boolean).join('\n');
      const t = await novoTrabalho(obra, s.tipo, { nome: s.nome, notas, confirmar: r.aConfirmar.join('\n'), medidas: s.medidas });
      if (foto) {
        const id = store.novoId();
        try { await store.guardarAnexo('foto:' + id, foto); t.fotos = [{ id, legenda: 'Fotografia do local' }]; await store.guardarObra(obra); } catch (e) { /* sem espaço: o trabalho fica sem a foto */ }
      }
      ir(`#/trabalho/${obra.id}/${t.id}`);
    };
    caixa.scrollIntoView({ block: 'nearest' });
  }

  // --- copiar e colar ---
  $('#c-copiar').onclick = async () => {
    const pedido = pedidoParaColar($('#c-texto').value);
    if (await copiar(pedido)) return aviso('Pedido copiado. Cole-o no Claude e junte a fotografia.');
    const cx = $('#c-pedido'); cx.hidden = false; cx.value = pedido; cx.focus(); cx.select();   // sem acesso à área de transferência: copia-se à mão
    aviso('Selecione o texto do pedido e copie-o.');
  };
  $('#c-ler').onclick = () => mostra(interpretarColado($('#c-colado').value), $('#c-texto').value.trim());

  // --- ligação direta ---
  if (chave) $('#c-pedir').onclick = async () => {
    const texto = $('#c-texto').value.trim(), botao = $('#c-pedir');
    if (!foto && !texto) return aviso('Junte uma fotografia ou escreva o que pretende.');
    botao.disabled = true; botao.textContent = 'O Claude está a analisar…'; $('#c-resposta').innerHTML = '';
    let r;
    try { r = await pedirSolucao(chave, { texto, imagem: foto }); } catch (e) { r = { erro: 'Não foi possível falar com o Claude.' }; }
    if (!$('#c-resposta')) return;                              // o utilizador saiu do ecrã entretanto
    botao.disabled = false; botao.textContent = 'Pedir outra vez';
    mostra(r, texto);
  };
}
