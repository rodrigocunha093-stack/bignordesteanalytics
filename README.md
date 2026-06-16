# BIGNORDESTE ANALYTICS

MVP funcional para transformar arquivos `.txt` exportados do VR em analises mensais de ofertas, campanhas, encartes, departamentos, produtos, lojas e regioes.

## Como abrir

Abra o arquivo `index.html` diretamente no navegador.

A persistencia inicial usa `localStorage`, entao as importacoes ficam salvas no navegador usado para operar o sistema.

## Fluxo recomendado

1. Cadastre/valide as empresas e o ID da loja no VR.
2. Escolha 1 loja piloto e 1 mes fechado.
3. Rode os 5 modelos SQL no VR.
4. Exporte os arquivos `.txt` separados por `;`.
5. Importe os arquivos no sistema.
6. Abra **Auditoria da Importacao**.
7. Se os numeros baterem com o VR, use **Plano de Coleta 27 Lojas** para aprovar o lote.
8. A **Consolidacao Final** considera somente lojas com status `Aprovado`.

## Plano de Coleta 27 Lojas

A tela **Plano de Coleta 27 Lojas** controla quais lojas ja tiveram os 5 arquivos importados, auditados e aprovados por loja/mes.

Mostra:

- Loja
- Regiao
- Status: `Pendente`, `Importado`, `Auditado`, `Aprovado`, `Com erro`
- Resumo geral importado?
- Campanhas importadas?
- Produtos importados?
- Departamentos importados?
- Cupons importados?
- Data da ultima importacao
- Observacao
- Botao `Ver auditoria`
- Botao `Aprovar lote`
- Botao `Reprocessar`

Indicadores no topo:

- Total de lojas
- Lojas pendentes
- Lojas completas
- Lojas com erro
- Percentual de avanco da coleta

Regra de negocio:

- Uma loja so entra na **Consolidacao Final** se estiver com status `Aprovado`.

## Auditoria da Importacao

A tela **Auditoria da Importacao** valida se os arquivos importados estao confiaveis antes de usar o dashboard.

Ela mostra por loja/mes:

- total de arquivos importados
- tipos importados
- linhas por arquivo
- linhas ignoradas
- colunas faltantes
- venda total do resumo geral
- soma das campanhas
- participacao promocional calculada
- cupons totais
- soma de cupons por campanha
- diferenca entre resumo geral e campanhas
- alertas de inconsistencia
- arquivos faltantes

Status possiveis:

- Completo/Auditado
- Parcial
- Com erro
- Pendente
- Aprovado

## Modelos SQL oficiais

A pasta `/sql` contem os 5 modelos oficiais de consulta que devem ser rodados no VR:

- `sql/resumo_geral_loja.sql`
- `sql/campanhas_ofertas.sql`
- `sql/produtos_campanha.sql`
- `sql/departamentos_campanha.sql`
- `sql/cupons_totais.sql`

Tambem existe o arquivo `modelo_exportacao.txt`, com padrao de exportacao, nomes dos arquivos, cabecalhos esperados e checklist de importacao.

## Importacao TXT

O sistema aceita somente arquivos `.txt` separados por ponto e virgula (`;`), com primeira linha como cabecalho.

Antes de importar, o usuario informa obrigatoriamente loja, mes/ano, tipo de arquivo e observacao.

Tipos suportados:

- `resumo_geral_loja`
- `campanhas_ofertas`
- `produtos_campanha`
- `departamentos_campanha`
- `cupons_totais`
