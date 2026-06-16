# BIGNORDESTE ANALYTICS

MVP funcional para transformar arquivos `.txt` exportados do VR em analises mensais de ofertas, campanhas, encartes, departamentos, produtos, lojas e regioes.

## Como abrir

Abra o arquivo `index.html` diretamente no navegador.

A persistencia inicial usa `localStorage`, entao as importacoes ficam salvas no navegador usado para operar o sistema.

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

## Funcionalidades

- Historico de importacoes com data/hora, arquivo, loja, mes, tipo, quantidade de linhas e observacao.
- Calculo automatico de participacao da campanha, penetracao, ticket medio, preco medio, lucro por cupom, venda por produto, lucro por produto, indice de forca e indice de eficiencia.
- Dashboard executivo com rankings de campanha.
- Tela `Consolidacao 27 Lojas` com ranking por venda promocional, participacao das ofertas, margem, lucro, penetracao e indice de forca.
- Analise por loja, regiao, departamentos e produtos.
- Relatorio executivo com resumo por loja, campanha e regiao, alertas automaticos e oportunidades.
- Base Prisma em `prisma/schema.prisma` para evolucao futura com PostgreSQL.

## Proximos passos tecnicos

- Migrar o SPA para React + TypeScript.
- Criar API Node/Next ou Express.
- Persistir importacoes no PostgreSQL via Prisma.
- Adicionar autenticacao e perfis de acesso.
- Implementar exportacao de relatorios em PDF/XLSX.
