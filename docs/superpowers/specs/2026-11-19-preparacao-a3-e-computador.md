# Preparação em folhas A3 e modo computador

**Pedido (19/11/2026):** as preparações têm de sair no género dos exemplos enviados (portão P1, abrigo AG, custo da pérgula) e a app tem de se usar bem no computador. Aprovado pelo utilizador: primeiro o formato novo nos quatro tipos existentes e o ecrã largo; tipos novos depois.

## Objetivo
- A folha de preparação passa a ser um conjunto de folhas A3 ao baixo, com esquadria e legenda (obra, título, desenho n.º, revisão, escalas, data, desenhou, folha x/y, unidades).
- Cada peça tem uma referência (P1, T2…) que aparece em balão no desenho e na lista de posições (perfil, comprimento, quantidade, kg/un, kg, corte, observações).
- Vistas à escala normalizada (1:5 … 1:200), com a escala escrita no título de cada vista.
- Pormenores ampliados: vão tipo (folgas do enchimento) e pé do prumo (dimensões marcadas «a confirmar»).
- Aprovisionamento: esquema de corte por vara, varas a encomendar e sobra, chapas e vidros, ferragens de compra.
- Notas de fabrico geradas pelo material e acabamento (soldadura, tolerâncias, tratamento, montagem), marcadas como pressuposto.
- Custo por capítulos com percentagens e indicadores, e exportação para Excel (.xlsx) com as folhas Resumo, Custo e Posições.
- Ecrã largo (≥ 1100 px): medidas à esquerda, desenho/3D/custo à direita; listas em grelha.

## Fora de âmbito
Tipos novos (grade de janela, telheiro/pérgula, portão de almofadas, estrutura em quadro); edição manual de posições; cortes A-A.

## Anti-objetivos
- Preços na folha de preparação.
- Dimensões inventadas apresentadas como certas: tudo o que é pressuposto leva «[A CONFIRMAR]».
- Alterar o custo dos trabalhos já guardados (o capítulo novo de consumíveis vale 0 % quando a cópia de preços do trabalho não o traz).

## Abordagem
Módulo novo `js/preparacao.js` (posições, aprovisionamento, notas, escala, pormenores) lido por `folhas.js`; `desenho2d.js` ganha opções (traço fino, balões, janela); `custo.js` ganha capítulos; `js/xlsx.js` escreve o Excel (zip sem compressão). Alternativas postas de parte: gerar PDF com biblioteca (peso e sem necessidade, o browser imprime A3) e exportar CSV (não tem várias folhas).
