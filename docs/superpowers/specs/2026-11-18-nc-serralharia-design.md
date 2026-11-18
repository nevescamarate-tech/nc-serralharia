# NC Serralharia — desenho da solução (fase 1)

Data: 2026-11-18

## Intenção

App para usar em obra, no telemóvel ou tablet, por quem tira as medidas. Ao sair da obra, o trabalho já tem:

- desenho de preparação cotado, para a oficina;
- lista de material e lista de corte;
- pormenor 3D, para a oficina e para mostrar ao cliente, com a cor e o material que ele escolher;
- custo e preço de venda, com a margem em percentagem definida pelo utilizador.

O objetivo é eliminar o trabalho de voltar ao escritório para desenhar, medir material e fazer contas.

## Objetivos da fase 1

- Três tipos de trabalho: **guarda**, **corrimão** e **portão** (de batente com 1 ou 2 folhas, e de correr).
- Materiais: aço (ferro), inox e alumínio; vidro laminado como enchimento de guardas.
- Funcionar sem rede, em ecrã de telemóvel, com dedos (botões e campos grandes).
- Tabela de preços com valores de exemplo, editável pelo utilizador.
- Imprimir ou guardar em PDF: folha de preparação (oficina) e folha de proposta (cliente).

## Fora da fase 1 (não objetivos)

- Tubagem de condutas inox (fase 2, módulo próprio).
- Escadas, gradeamentos, estruturas, coberturas (fase 3).
- Leitura de desenhos existentes em PDF ou DWG (fase 3).
- Sincronização automática entre dispositivos e contas de utilizador.
- Cálculo estrutural ou verificação regulamentar. A app aplica valores por omissão prudentes, mas não substitui o projeto.
- Exportação DXF/DWG.

## O que seria falhar (anti-objetivos)

- Precisar de teclado e rato, ou de rede, para funcionar em obra.
- Lista de material que não bate com o desenho: o desenho, o 3D e a lista têm de sair todos do mesmo cálculo.
- A folha do cliente mostrar custos internos ou a margem.
- Perder os trabalhos guardados sem aviso.

## Abordagens consideradas

1. **App web instalável (escolhida).** Abre no browser, instala-se como ícone, funciona sem rede. Uma só versão para telemóvel, tablet e computador. Sem lojas de aplicações.
2. **App nativa Android/iPhone.** Mesmo resultado para o utilizador, com duas versões e publicação em lojas. Não compensa.
3. **Programa de computador com CAD.** Desenho mais rico, mas não serve para obra.

O utilizador deixou a escolha técnica ao construtor; a opção 1 é decisão do construtor.

## Decisões técnicas (do construtor)

- Ficheiros estáticos: HTML, CSS e JavaScript em módulos, sem passo de compilação. Corre a partir de qualquer servidor de ficheiros.
- 3D com three.js, incluído localmente na pasta da app (não por CDN), para funcionar sem rede.
- Desenho de preparação em SVG gerado pelo código (vetorial, imprime bem).
- Dados guardados no dispositivo (IndexedDB, com localStorage como recurso). Botões para exportar e importar tudo num ficheiro, que servem de cópia de segurança e de passagem entre dispositivos.
- PWA: manifesto e service worker para instalar e trabalhar sem rede.
- PDF através da impressão do browser, com folhas de estilo de impressão em A4.
- Interface em português de Portugal. Medidas em milímetros na entrada; metros e kg nas listas.
- Testes automáticos (node) sobre os módulos de cálculo, que não dependem do browser.

## Estrutura

```
index.html
manifest.webmanifest, sw.js
css/app.css, css/print.css
img/logo-nc.svg, ícones
vendor/three.module.js, OrbitControls
js/
  app.js            navegação e ecrãs
  store.js          obras, trabalhos, tabela de preços, exportar/importar
  catalogo.js       perfis, materiais, acabamentos, cores, preços de exemplo
  modelos/guarda.js
  modelos/corrimao.js
  modelos/portao.js
  corte.js          otimização de corte em varas
  custo.js          custo e preço de venda
  desenho2d.js      SVG cotado
  vista3d.js        cena three.js
  folhas.js         folha de preparação e folha de proposta
tests/
```

**Regra central:** cada modelo recebe as medidas e opções e devolve uma única lista de **peças** (perfil, material, comprimento, posição e orientação no espaço, quantidade) e de **acessórios**. O desenho 2D, o 3D, a lista de material, a lista de corte e o custo leem todos dessa mesma lista. Assim nunca divergem.

## Ecrãs

1. **Obras:** lista de obras (cliente, obra, morada, data). Criar, abrir, duplicar, apagar com confirmação.
2. **Obra:** lista de trabalhos da obra, total da obra, botão «novo trabalho» (escolher guarda, corrimão ou portão).
3. **Trabalho:** quatro separadores:
   - **Medidas:** formulário do tipo de trabalho.
   - **Desenho:** alçado e planta cotados.
   - **3D:** modelo que roda e aproxima com o dedo; seletor de material, acabamento e cor.
   - **Material e custo:** lista de material, lista de corte, custo decomposto, campo da margem (%), preço de venda sem e com IVA.
   - Botões: «folha de preparação» e «folha de proposta».
4. **Preços:** tabela editável (perfis, acessórios, mão de obra, acabamentos, margem por omissão, IVA).
5. **Definições:** dados da empresa para as folhas, exportar e importar dados.

## Modelos da fase 1

### Guarda

Entradas: um ou mais **troços** em linha (comprimento de cada um e ângulo de viragem em planta entre troços; inclinação por troço, para escadas e rampas); altura (por omissão 1100 mm); fixação ao topo do pavimento com sapata ou lateral; tipo de enchimento; perfis do prumo, do corrimão e das travessas.

Enchimentos: varões verticais, barras horizontais, vidro laminado com pinças, chapa.

Regras por omissão (todas editáveis): prumos repartidos por igual com afastamento máximo de 1200 mm; vão livre entre varões verticais até 110 mm; travessa inferior a 100 mm do pavimento.

Saída: prumos, corrimão, travessas, varões ou painéis, sapatas, buchas, tampas, pinças de vidro.

### Corrimão

Entradas: comprimento, inclinação, tubo, de parede (com suportes) ou sobre prumos; tipo de extremidade (tampa, curva a 90° para a parede); afastamento máximo entre suportes (por omissão 1000 mm).

Saída: tubo, suportes, extremidades, buchas.

### Portão

Entradas: largura e altura do vão; tipo (batente de 1 folha, batente de 2 folhas, de correr sobre carril); enchimento (varões verticais, chapa lisa, lâminas horizontais); perfil do aro e das travessas; com ou sem pilares novos; com ou sem preparação para motor.

Regras por omissão (editáveis): folgas laterais e ao pavimento; no portão de correr, comprimento da folha igual ao vão mais sobreposição, e carril com o dobro do vão.

Saída: aro, travessas, enchimento, pilares, dobradiças, fecho ou fechadura, batentes; no de correr, rodas, carril, guia superior, batente de fim de curso, e cremalheira se tiver preparação para motor.

## Catálogo e preços de exemplo

- **Perfis:** tubo redondo, tubo quadrado, tubo retangular, barra chata, varão redondo e quadrado, em medidas correntes; peso por metro calculado pela secção e densidade do material.
- **Materiais e acabamentos:** aço (pintado, galvanizado, galvanizado e lacado), inox 304 e 316 (escovado, polido), alumínio (lacado, anodizado). Cores por uma seleção de RAL correntes mais cor livre.
- **Preços:** €/kg por material (perfis), €/m² para chapa e vidro, preço unitário de acessórios e ferragens, €/hora de oficina, €/hora de montagem, deslocação por obra, €/m² de pintura ou lacagem, €/kg de galvanização.
- Os valores de exemplo ficam marcados como «exemplo» até o utilizador os alterar. O utilizador vai carregar os seus preços mais tarde; a importação de uma tabela a partir de ficheiro fica preparada pela exportação/importação de dados e pode ganhar um formato de folha de cálculo numa fase seguinte.

## Corte

Varas comerciais de 6 m (editável por perfil). A lista de corte agrupa as peças por perfil e reparte-as pelas varas, com espessura de corte, e indica número de varas a comprar e desperdício. Método: ordenar por comprimento decrescente e encaixar na primeira vara onde caiba.

## Custo

- Material: escolha na tabela de preços entre cobrar as varas inteiras ou só o comprimento usado mais uma percentagem de desperdício.
- Acessórios: quantidade × preço unitário.
- Mão de obra de oficina: horas estimadas por regras simples (tempo por corte, por ligação soldada, por metro de acabamento), com as horas totais editáveis no trabalho.
- Acabamento: pela área de superfície ou pelo peso, conforme o acabamento.
- Montagem: horas editáveis, mais deslocação.
- Preço de venda = custo × (1 + margem). Margem por omissão na tabela de preços e alterável por trabalho. IVA à taxa configurável (23% por omissão).

## Folhas

- **Folha de preparação (oficina):** logótipo, dados da obra, alçado e planta cotados, imagem do 3D, lista de material, lista de corte, acessórios. Sem preços.
- **Folha de proposta (cliente):** logótipo, dados do cliente, imagem do 3D na cor escolhida, descrição do trabalho, material e acabamento, preço sem IVA, IVA e total. Sem custos internos nem margem.

## Logótipo

Recriado em SVG a partir da imagem fornecida: arco em «C» aberto à direita com o «N» dentro, traço fino escuro, e por baixo a palavra «serralharia» em minúsculas espaçadas. Sem «camarate & neves».

## Erros e casos-limite

- Medidas em falta ou impossíveis (zero, negativas, enchimento que não cabe): o separador de medidas mostra a mensagem junto ao campo e os outros separadores mostram o último resultado válido ou um aviso.
- Peça maior do que a vara comercial: aviso na lista de corte a indicar emenda.
- Importação de ficheiro inválido: recusa sem alterar os dados existentes.

## Decisões do construtor após revisão (a confirmar pelo utilizador)

1. **Como se mede um troço inclinado.** Introduz-se o comprimento **na horizontal** e o **desnível** (subida) do troço; a app calcula o ângulo e o comprimento real. A altura da guarda é medida **na vertical**, a partir do pavimento ou da linha dos focinhos dos degraus.
2. **Cantos da guarda.** Há um prumo em cada canto; o corrimão e as travessas são cortados em **meia-esquadria** no canto.
3. **Ângulos de corte.** Cada peça guarda o ângulo de corte de cada topo. A lista de corte indica os ângulos, e o comprimento é sempre **pela ponta mais comprida**.
4. **Folhas.** A folha de preparação é **por trabalho**. A proposta ao cliente é **por obra**, com todos os trabalhos da obra, número, data, validade (30 dias por omissão) e condições editáveis. Os botões da proposta ficam no ecrã da obra.
5. **Preços.** Cada trabalho guarda uma cópia dos preços do momento em que foi criado, para uma proposta já entregue não mudar sozinha. Um botão «atualizar preços» recalcula com a tabela atual.
6. **Aparelhos.** Funciona em Android, iPhone e iPad. A app pede ao sistema armazenamento persistente e lembra o utilizador de exportar uma cópia de segurança quando há alterações por guardar há mais de 7 dias.
7. **Importação.** Junta ao que já existe no aparelho. Cada obra e trabalho tem um identificador fixo e data de alteração; em caso de conflito fica a versão mais recente. Mostra um resumo antes de aplicar.
8. **Testes.** O computador de desenvolvimento não tem Node nem Python: os testes dos módulos de cálculo correm numa página `tests/index.html` no browser.
9. **Logótipo.** A imagem foi fornecida na conversa, não como ficheiro; o SVG é recriado à vista a partir dela.

## Deixado ao construtor

- Aspeto visual, dentro do tom do logótipo (sóbrio, preto e branco, tipografia fina).
- Medidas exatas do catálogo de perfis e valores de exemplo.
- Pormenor do 3D (ligações e ferragens simplificadas).

## Pedido acrescentado pelo utilizador durante a construção (2026-11-18)

A app deve também ler desenhos de projetos existentes e articulados (mapas de quantidades), incluindo ficheiros DWG e DXF. Passa a ser o módulo seguinte à fase 1 (antes da tubagem, salvo indicação em contrário) e precisa de desenho próprio. Pontos já conhecidos:

- DXF é um formato de texto aberto e pode ser lido diretamente na app.
- DWG é um formato fechado da Autodesk; lê-lo dentro de uma app web exige uma biblioteca de conversão a avaliar, ou converter antes para DXF.
- Falta definir o que a app faz com o desenho lido (ver e medir por cima, ou reconhecer peças automaticamente) e o formato dos articulados (Excel, PDF).

### Primeira versão construída (decisões do construtor, por indicação «avança» do utilizador)

- **Desenho (js/dxf.js, js/importar.js):** lê DXF de texto (linhas, polilinhas, círculos, arcos, elipses, textos, blocos e cotas expandidos), mostra-o com camadas ligáveis, e mede por toque com agarrar às pontas de linha. A medição cria guarda (um troço por segmento, com as viragens), corrimão (comprimento total) ou portão (primeiro segmento = largura). A unidade vem do desenho ou é escolhida pelo utilizador. O desenho fica guardado no aparelho por obra (até 8 MB) e não entra na cópia de segurança.
- **DWG:** reconhecido pelo nome ou pelos primeiros bytes; a app explica como converter para DXF. Leitura direta por avaliar.
- **Articulado (js/articulado.js):** lê Excel .xlsx (leitor próprio, sem bibliotecas) e CSV; encontra as colunas de artigo, descrição, unidade e quantidade; classifica as linhas (guarda, corrimão, portão, outra serralharia) por palavras-chave; cria trabalhos com nome, notas e, se a linha for em metros, o comprimento. PDF e .xls antigo não são lidos.
- **Não feito:** reconhecimento automático de peças no desenho; curvas das polilinhas (são tratadas como retas); DXF binário.

## Em aberto, para depois da fase 1

- **Onde fica alojada.** Para abrir no telemóvel em obra, a app tem de estar num endereço na internet com HTTPS. Na fase 1 corre e testa-se no computador; o alojamento decide-se na entrega.
