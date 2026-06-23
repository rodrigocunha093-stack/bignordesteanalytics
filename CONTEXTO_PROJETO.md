# CONTEXTO OFICIAL DO PROJETO - BIGNORDESTE ANALYTICS

Este arquivo e a memoria oficial do projeto para humanos, Codex, Claude Code e outros agentes de IA trabalhando em computadores diferentes.

Atualize este documento sempre que houver mudanca relevante de arquitetura, regra de negocio, deploy, banco de dados, fluxo de importacao ou decisao tecnica.

## Identidade do projeto

Nome: BIGNORDESTE ANALYTICS

Objetivo: transformar arquivos `.txt` exportados do VR em uma ferramenta executiva de analise comercial para campanhas, encartes, departamentos, produtos, lojas e regioes.

Escopo atual:

- Dashboard por loja, regiao, periodo e campanha.
- Centro de Decisao Comercial.
- Importacao dos 5 arquivos TXT do VR.
- Auditoria de importacao por loja/periodo.
- Plano de Coleta das 27 lojas.
- Consolidacao apenas de lojas aprovadas.
- Modelos SQL para gerar os arquivos no VR.
- Deploy web na Vercel.
- Persistencia local por `localStorage` enquanto nao houver banco em nuvem.
- Persistencia compartilhada via PostgreSQL quando `DATABASE_URL` estiver configurada.

## URLs e caminhos

Repositorio GitHub:

```text
https://github.com/rodrigocunha093-stack/bignordesteanalytics
```

URL de producao na Vercel:

```text
https://bignordesteanalytics.vercel.app
```

URL local padrao:

```text
http://127.0.0.1:8080/index.html
```

Caminho local neste computador:

```text
C:\Users\LOJA1321\Documents\Codex\2026-06-18\codex-voc-precisa-baixar-o-projeto\bignordesteanalytics
```

## Como rodar localmente

No terminal:

```cmd
cd C:\Users\LOJA1321\Documents\Codex\2026-06-18\codex-voc-precisa-baixar-o-projeto\bignordesteanalytics
npm install
npm start
```

Depois acessar:

```text
http://127.0.0.1:8080/index.html
```

Se o PowerShell bloquear `npm`, use:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' start
```

## Como publicar na Vercel

O projeto ja possui `vercel.json` e o servidor exporta o app Express para funcionar como serverless function.

Comando de deploy:

```powershell
& "$env:APPDATA\npm\vercel.cmd" deploy --prod --yes
```

Ultimo deploy validado com PostgreSQL/Supabase conectado:

```text
https://bignordesteanalytics.vercel.app
```

Verificacoes apos deploy:

```powershell
Invoke-WebRequest -Uri 'https://bignordesteanalytics.vercel.app/index.html' -UseBasicParsing
Invoke-RestMethod -Uri 'https://bignordesteanalytics.vercel.app/api/health'
```

Resultado esperado em producao com banco:

```json
{"ok":true,"database":"connected"}
```

## Banco de dados e persistencia

Sem banco configurado:

- O sistema funciona.
- Os dados importados ficam no `localStorage` do navegador.
- Cada computador/navegador tera seus proprios dados.
- Isso e bom para teste local, mas nao serve para operacao compartilhada.

Com banco configurado:

- O servidor usa PostgreSQL via `DATABASE_URL`.
- A API salva o estado completo da aplicacao em `app_state`.
- Todos os usuarios passam a compartilhar importacoes, auditorias, aprovacoes e analises.

Projeto Supabase criado para o BIGNORDESTE ANALYTICS:

```text
Project ref: upaujonwcngtmgztpmsr
Project URL: https://upaujonwcngtmgztpmsr.supabase.co
Dashboard: https://supabase.com/dashboard/project/upaujonwcngtmgztpmsr
```

Para Vercel/serverless, usar preferencialmente a connection string **Transaction pooler** do Supabase como `DATABASE_URL`.
A chave publishable/anon do Supabase nao e suficiente para a persistencia atual, porque o servidor usa PostgreSQL via `pg` e `DATABASE_URL`.
Nao versionar senhas, service role keys ou `.env`.

Status em 2026-06-22:

- `DATABASE_URL` configurada na Vercel em Production como variavel sensivel.
- Deploy de producao executado e alias `https://bignordesteanalytics.vercel.app` atualizado.
- `GET /api/health` em producao retornou `{"ok":true,"database":"connected"}`.
- Tabela `app_state` foi criada/validada automaticamente pelo servidor.

Arquivo local esperado:

```text
.env
```

Exemplo:

```env
DATABASE_URL="postgresql://usuario:senha@host:5432/banco?sslmode=require"
PORT=8080
```

Importante:

- O `server.js` carrega `.env` automaticamente no ambiente local.
- Na Vercel, configure `DATABASE_URL` nas Environment Variables do projeto.
- Depois de configurar `DATABASE_URL` na Vercel, faca novo deploy.

## Arquitetura atual

Arquivos principais:

- `index.html`: aplicacao frontend completa, estilos, dashboard, importacao, calculos e visualizacoes.
- `server.js`: servidor Express, arquivos estaticos, API `/api/health`, `/api/state`, persistencia em PostgreSQL opcional.
- `vercel.json`: configuracao para publicar o Express na Vercel.
- `sql/`: modelos SQL oficiais para gerar os TXT no VR.
- `modelo_exportacao.txt`: padrao operacional de exportacao/importacao.
- `README.md`: instrucoes gerais para usuario/desenvolvedor.
- `CONTEXTO_PROJETO.md`: memoria oficial deste projeto.

Rotas da API:

- `GET /api/health`: verifica se o app esta vivo e se ha banco configurado.
- `GET /api/state`: carrega estado compartilhado do PostgreSQL.
- `PUT /api/state`: salva estado compartilhado no PostgreSQL.

Tabela criada automaticamente quando ha banco:

```sql
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Regra critica das lojas

Existem 27 lojas independentes.

Regra oficial:

- A loja selecionada na tela de importacao e o destino oficial dos dados.
- A coluna `loja` dentro do TXT fica apenas como referencia/auditoria.
- Mesmo que o TXT venha com loja `1` ou `2`, o sistema deve importar para a loja escolhida no seletor.
- Nunca reintroduzir logica que redirecione automaticamente os dados pela coluna `loja` do TXT.

Motivo: cada loja pode gerar arquivos em ambientes/estruturas independentes, e o operador e quem informa qual loja esta sendo importada.

## Fluxo operacional de importacao

Para cada loja e periodo:

1. Selecionar a loja correta no sistema.
2. Selecionar data inicial e data final.
3. Rodar os 5 SQL no VR.
4. Exportar os 5 resultados como `.txt` separados por ponto e virgula.
5. Importar todos os arquivos juntos ou selecionar a pasta com os TXT.
6. Validar a tela Auditoria.
7. Aprovar a loja no Plano de Coleta se os numeros baterem.
8. So lojas aprovadas entram na Consolidacao Final.

Arquivos esperados:

- `resumo_geral_loja.txt`
- `campanhas_ofertas.txt`
- `produtos_campanha.txt`
- `departamentos_campanha.txt`
- `cupons_campanha.txt`

O sistema detecta o tipo pelo nome do arquivo.

Se qualquer arquivo do lote tiver colunas invalidas:

- A importacao inteira e cancelada.
- Nenhum dado novo e gravado.
- Isso evita lote parcial.

Se um arquivo valido nao tiver linhas dentro do periodo selecionado:

- O sistema grava historico com `0` linhas.
- Os dados antigos daquele arquivo/tipo/loja/periodo sao limpos.

## Colunas esperadas

`resumo_geral_loja.txt`

```text
loja;mes;venda_total;custo_total;lucro_total;margem_total;cupons_totais;unidades_totais;produtos_distintos
```

`campanhas_ofertas.txt`

```text
loja;mes;id_tipooferta;descricao;venda;custo;lucro;margem;quantidade;itens;produtos_distintos;cupons;ticket_medio;preco_medio
```

`produtos_campanha.txt`

```text
loja;mes;id_tipooferta;campanha;id_produto;descricao_produto;quantidade;venda;lucro;margem
```

`departamentos_campanha.txt`

```text
loja;mes;id_tipooferta;campanha;mercadologico1;descricao_departamento;produtos;quantidade;venda;lucro;margem
```

`cupons_campanha.txt`

```text
loja;mes;cupons_totais;campanha;cupons_campanha
```

## Periodo e datas

O sistema trabalha com intervalo semiaberto:

```text
data >= data_inicio
data < data_fim
```

Exemplo para janeiro a junho de 2026:

```text
data_inicio = 2026-01-01
data_fim = 2026-07-01
```

O campo `mes` deve vir nos TXT no formato:

```text
YYYY-MM
```

O importador tambem aceita alguns formatos comuns e normaliza para `YYYY-MM`, mas o padrao oficial deve continuar sendo `YYYY-MM`.

## Calculos e filtros

Regra importante:

- O filtro de campanha deve afetar apenas as telas analiticas/visuais de campanha.
- Auditoria, Plano de Coleta e Consolidacao devem sempre usar o lote completo da loja/periodo, ignorando filtro de campanha.

Correcoes ja aplicadas:

- `total(loja, false)` calcula o total completo, sem filtro de campanha.
- `audit()` usa total completo.
- `storeRank()` usa total completo.
- `consolidacao()` e `exportConsol()` usam total completo.
- `campRows()` calcula participacao contra a venda total completa do periodo.

Regra de cupons:

- Quando `cupons_campanha.txt` existir, a penetracao usa `cupons_campanha` e `cupons_totais` desse arquivo.
- Se nao existir, faz fallback para os campos de cupons vindos de `campanhas_ofertas` e `resumo_geral_loja`.

## SQL oficiais

Os SQL em `sql/` devem usar parametros, nao loja fixa.

Modelos obrigatorios de importacao mensal:

- `resumo_geral_loja.sql`
- `campanhas_ofertas.sql`
- `produtos_campanha.sql`
- `departamentos_campanha.sql`
- `cupons_totais.sql`

Modelos/arquivos de apoio diario para comparar campanha contra o periodo real de execucao:

- `ofertas_dia_campanha.sql`
- `venda_diaria_loja.sql`

Arquivos aceitos na importacao como apoio opcional:

- `venda_dia_campanha.txt`: salva no bucket `ofertasDia`.
- `venda_diario.txt`: salva no bucket `vendasDiarias`.

Esses arquivos diarios aparecem na tela "Modelos SQL" e podem ser importados, mas nao entram na obrigatoriedade dos 5 arquivos da Auditoria/Plano de Coleta.

Status da analise diaria:

- `venda_dia_campanha.txt` e `venda_diario.txt` sao cruzados por `loja + data`.
- O Dashboard mostra participacao no periodo real, venda por dia e penetracao real quando houver diarios importados.
- O Centro de Decisao gera diagnostico por periodo real, comparando participacao no mes versus participacao nos dias reais da campanha.
- Existe a tela "Periodo de Campanha", com campanhas ativas por dia, ciclos consecutivos e ranking/comparativo justo.
- Os filtros por bloco (`Encarte Big Nordeste`, `Dia Big`, `Demais Encartes`) tambem afetam a analise diaria.

Padrao:

```sql
WHERE v.id_loja = :id_loja
  AND v.data >= :data_inicio
  AND v.data < :data_fim
```

Nao voltar para:

```sql
WHERE v.id_loja = 1
```

Na tela "Modelos SQL", o app gera SQL dinamico usando a loja e o periodo selecionados.

## Estado visual e UX

O visual atual esta em formato de painel executivo:

- Sidebar escura.
- Filtros no topo.
- Cards KPI.
- Graficos com Chart.js.
- Tabelas ordenaveis.
- Centro de Decisao com cards e plano de acao.
- Menu responsivo vira barra superior em telas menores.

Evitar regressao visual para tela simples.

Cuidados:

- Nao esconder o menu em mobile sem alternativa.
- Nao remover as telas de auditoria/plano/consolidacao.
- Nao trocar o fluxo para importacao arquivo a arquivo; a operacao desejada e importar todos os arquivos da loja selecionada.

## Limitacoes conhecidas

1. Sem `DATABASE_URL`, os dados nao sao compartilhados entre computadores.
2. O parser TXT usa separador `;` simples. Se algum campo textual vier com `;` dentro da descricao, pode deslocar colunas.
3. Chart.js vem de CDN; se o computador estiver sem internet, graficos podem nao carregar.
4. O estado em PostgreSQL atualmente e salvo como JSON unico em `app_state`, adequado para MVP, mas nao e um modelo relacional analitico completo.
5. Arquivos de log locais, tunnel e node_modules nao devem ir para o Git.

## Validacoes recomendadas apos mudancas

Rodar no diretorio do projeto:

```powershell
& 'C:\Program Files\nodejs\node.exe' --check server.js
& 'C:\Program Files\nodejs\node.exe' -e "const fs=require('fs'); const html=fs.readFileSync('index.html','utf8'); const m=html.match(/<script>([\s\S]*)<\/script>/); new Function(m[1]); console.log('inline script ok')"
```

Com servidor local rodando:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:8080/index.html' -UseBasicParsing
Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/health'
```

Na Vercel:

```powershell
Invoke-WebRequest -Uri 'https://bignordesteanalytics.vercel.app/index.html' -UseBasicParsing
Invoke-RestMethod -Uri 'https://bignordesteanalytics.vercel.app/api/health'
```

## Regras para agentes de IA

Antes de continuar o desenvolvimento:

1. Ler este `CONTEXTO_PROJETO.md`.
2. Ler `README.md`.
3. Inspecionar `git status`.
4. Nao reverter alteracoes locais sem autorizacao.
5. Preservar a regra da loja selecionada como destino da importacao.
6. Preservar auditoria/plano/consolidacao usando total completo, sem filtro de campanha.
7. Validar sintaxe antes de finalizar.
8. Se publicar, testar `/index.html` e `/api/health`.

Prioridades futuras:

1. Testar fluxo completo com dados reais de mais de uma loja usando a persistencia compartilhada.
2. Melhorar parser TXT para suportar campos com aspas e `;` dentro do texto.
3. Adicionar export/import de backup JSON para migrar localStorage.
4. Criar testes automatizados para importacao, auditoria e calculos.
