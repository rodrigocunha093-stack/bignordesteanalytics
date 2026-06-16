# BIGNORDESTE ANALYTICS

MVP local para transformar arquivos `.txt` exportados do VR em analises gerenciais de ofertas, campanhas, encartes, departamentos, produtos, lojas e regioes.

## Como abrir

Abra o arquivo `index.html` diretamente no navegador.

O MVP inclui:

- Dashboard executivo com dados mockados da Loja 01.
- Importador `.txt` com separador `;`, preview, validacao de colunas e historico.
- Cadastros base de lojas e campanhas.
- Analise por loja, regiao, departamentos e produtos.
- Diagnostico automatico e relatorio executivo simples.
- `prisma/schema.prisma` como base para evolucao com PostgreSQL.

## Proximos passos tecnicos

- Migrar o SPA para React + TypeScript.
- Conectar API Node/Next ou Express.
- Ativar Prisma com PostgreSQL.
- Persistir importacoes reais no banco.
- Adicionar autenticacao e perfis de acesso.
