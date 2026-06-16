# BIGNORDESTE ANALYTICS

MVP funcional para transformar arquivos `.txt` exportados do VR em analises mensais de ofertas, campanhas, encartes, departamentos, produtos, lojas e regioes.

## Como abrir

Abra o arquivo `index.html` diretamente no navegador.

A persistencia inicial usa `localStorage`, entao as importacoes ficam salvas no navegador usado para operar o sistema.

## Validacao real recomendada

Antes de rodar as 27 lojas, valide 1 loja piloto e 1 mes fechado:

1. Escolha 1 loja piloto
2. Escolha 1 mes fechado
3. Rode as 5 consultas SQL no VR
4. Exporte os 5 arquivos `.txt` separados por `;`
5. Importe os arquivos no sistema
6. Abra a tela **Auditoria da Importacao**
7. Confira se os numeros batem com o VR

Checklist de validacao:

- Venda total bate com VR?
- Venda promocional bate?
- Margem bate?
- Cupons totais bate?
- Campanhas aparecem corretamente?
- Departamentos aparecem corretamente?
- Produtos carregaram sem erro?
- Relatorio executivo faz sentido?

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

- Completo
- Parcial
- Com erro
- Pendente

## Modelos SQL oficiais

A pasta `/sql` contem os 5 modelos oficiais de consulta que devem ser rodados no VR:

- `sql/resumo_geral_loja.sql`
- `sql/campanhas_ofertas.sql`
- `sql/produtos_campanha.sql`
- `sql/departamentos_campanha.sql`
- `sql/cupons_totais.sql`

Tambem existe o arquivo `modelo_exportacao.txt`, com padrao de exportacao, nomes dos arquivos, cabecalhos esperados e checklist de importacao.

No sistema, a tela **Modelos SQL** exibe nome da consulta, objetivo, colunas esperadas, botao copiar SQL, instrucao para trocar loja e periodo e checklist operacional.

## Importacao TXT

O sistema aceita somente arquivos `.txt` separados por ponto e virgula (`;`), com primeira linha como cabecalho.

Antes de importar, o usuario informa obrigatoriamente:

- loja
- mes/ano
- tipo de arquivo
- observacao

Tipos suportados:

- `resumo_geral_loja`
- `campanhas_ofertas`
- `produtos_campanha`
- `departamentos_campanha`
- `cupons_totais`

Cada tipo possui validacao propria de colunas obrigatorias. A tela permite selecionar multiplos arquivos `.txt` para a mesma loja, mes e tipo.

## Checklist de importacao

1. Selecionar loja
2. Selecionar mes
3. Rodar as 5 consultas no VR
4. Exportar `.txt` separado por `;`
5. Importar os 5 arquivos no sistema
6. Validar consolidacao

## Funcionalidades

- Cadastro de empresas/lojas com ID da loja no VR.
- Historico de importacoes com data/hora, arquivo, loja, mes, tipo, quantidade de linhas, linhas ignoradas, colunas faltantes e observacao.
- Auditoria da importacao antes do uso gerencial dos dados.
- Calculo automatico de participacao da campanha, penetracao, ticket medio, preco medio, lucro por cupom, venda por produto, lucro por produto, indice de forca e indice de eficiencia.
- Dashboard executivo com rankings de campanha.
- Tela `Consolidacao 27 Lojas` com ranking por venda promocional, participacao das ofertas, margem, lucro, penetracao e indice de forca.
- Analise por loja, regiao, departamentos e produtos.
- Relatorio executivo com resumo por loja, campanha e regiao, alertas automaticos e oportunidades.
- Base Prisma em `prisma/schema.prisma` para evolucao futura com PostgreSQL.
