# BIGNORDESTE ANALYTICS

MVP funcional para transformar arquivos `.txt` exportados do VR em inteligencia comercial de ofertas, campanhas, encartes, departamentos, produtos, lojas e regioes.

O sistema agora trabalha com **analise por periodo**, mas importa os dados **mes a mes** dentro do mesmo arquivo. Exemplo: selecionar `2026-01-01` ate `2026-07-01` gera consultas que retornam janeiro, fevereiro, marco, abril, maio e junho em linhas separadas pela coluna `mes`.

## Como abrir

Abra o arquivo `index.html` diretamente no navegador.

A persistencia inicial usa `localStorage`, entao as importacoes ficam salvas no navegador usado para operar o sistema.

## Banco de dados na nuvem

O sistema tambem pode rodar com PostgreSQL na nuvem. O primeiro passo usa uma API Node simples que salva o estado completo da aplicacao em uma tabela `app_state` no banco. Isso permite centralizar importacoes, auditorias, aprovacoes e analises sem depender do navegador local.

Passos:

1. Crie um banco PostgreSQL em um provedor como Supabase, Neon, Railway ou outro Postgres gerenciado.
2. Copie a string de conexao no formato `DATABASE_URL`.
3. Crie um arquivo `.env` baseado no `.env.example`.
4. Instale dependencias:

```bash
npm install
```

5. Inicie o sistema:

```bash
npm start
```

6. Acesse:

```text
http://127.0.0.1:8080/index.html
```

Endpoints:

- `GET /api/health`: verifica conexao com o banco.
- `GET /api/state`: carrega os dados salvos.
- `PUT /api/state`: salva os dados atuais.

Se `DATABASE_URL` nao estiver configurada, a tela continua funcionando com `localStorage`.

## Fluxo recomendado

1. Cadastre/valide as empresas e o ID da loja no VR.
2. Escolha 1 loja piloto e um periodo fechado, por exemplo `2026-01-01` ate `2026-07-01`.
3. Rode os 5 modelos SQL no VR usando loja, data inicial e data final.
4. Confira se todas as consultas retornam a coluna `mes` no formato `YYYY-MM`.
5. Exporte os arquivos `.txt` separados por `;`.
6. Importe os 5 arquivos no sistema.
7. Abra **Auditoria da Importacao**.
8. Se os numeros baterem com o VR, use **Plano de Coleta 27 Lojas** para aprovar o lote.
9. A **Consolidacao Final** considera somente lojas com status `Aprovado`.

## Analise por periodo

Regras implementadas:

- A tela usa **Loja**, **Data inicial** e **Data final**.
- O campo `mes` vem do arquivo importado, gerado pela SQL.
- Um unico arquivo pode conter varios meses da mesma loja.
- A importacao aceita varias linhas para a mesma loja, uma por mes.
- A consolidacao permite visao **mensal** e **acumulada do periodo**.
- Os calculos derivados usam o `mes` do arquivo, nao um mes selecionado manualmente.

## Plano de Coleta 27 Lojas

A tela **Plano de Coleta 27 Lojas** controla quais lojas ja tiveram os 5 arquivos importados, auditados e aprovados por loja/periodo.

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

Regra de negocio:

- Uma loja so entra na **Consolidacao Final** se estiver com status `Aprovado`.

## Auditoria da Importacao

A tela **Auditoria da Importacao** valida se os arquivos importados estao confiaveis antes de usar o dashboard.

Ela mostra por loja/periodo:

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

- Auditado
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

Todos os modelos retornam `mes` com:

```sql
TO_CHAR(DATE_TRUNC('month', v.data), 'YYYY-MM') AS mes
```

Tambem existe o arquivo `modelo_exportacao.txt`, com padrao de exportacao, nomes dos arquivos, cabecalhos esperados e checklist de importacao.

## Importacao TXT

O sistema aceita somente arquivos `.txt` separados por ponto e virgula (`;`), com primeira linha como cabecalho.

Antes de importar, o usuario informa obrigatoriamente loja, data inicial, data final, tipo de arquivo e observacao.

Tipos suportados:

- `resumo_geral_loja`
- `campanhas_ofertas`
- `produtos_campanha`
- `departamentos_campanha`
- `cupons_totais`
