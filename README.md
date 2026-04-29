# QA Orbit

QA Orbit e uma aplicacao local para organizar projetos de QA, chamados, evidencias, bugs, planos de teste, historico funcional e execucao de suites Cypress pelo QA Runner.

Este guia foca no ambiente local com SQL Server Express.

## Documentacao

- [Manual Base do Assistente QA Orbit](docs/manual-assistente-qa-orbit.md): base de conhecimento para configurar um GPT especializado no QA Orbit, com fluxos, modulos, Smart Recorder, Cypress, QA Runner e roadmap.
- [FAQ Operacional do QA Orbit](docs/faq-operacional-qa-orbit.md): respostas diretas para duvidas comuns de uso da plataforma.
- [Guia de Preenchimento do Blueprint](docs/guia-preenchimento-blueprint.md): orientacao pratica para montar fluxos tecnicos e exportar DOCX, JSON e Markdown.
- [Guia de Regressao do QA Orbit](docs/guia-regressao-qa-orbit.md): explica como o sistema compara historico e como preencher melhor os campos para sugestao de regressao.

## Requisitos

- Node.js 20 ou superior
- npm
- SQL Server Express
- SQL Server Management Studio, conhecido como SSMS
- SQL Server Configuration Manager
- Git

## Instalacao do projeto

Instale as dependencias:

```bash
npm install
```

Crie o arquivo `.env` a partir do exemplo:

```bash
copy .env.example .env
```

## Banco Local Com SQL Express

O caminho recomendado e usar uma instancia SQL Express com TCP/IP ativo e um login SQL exclusivo para o QA Orbit.

Exemplo usado neste projeto:

```text
Servidor: 127.0.0.1,1434
Instancia: SQLEXPRESS01
Banco: QA_Orbit
Usuario SQL: qaorbit_user
```

Voce pode usar outra porta ou outro nome de instancia, mas mantenha o `.env` coerente com a sua configuracao.

## Criar O Banco

No SSMS, conecte na sua instancia SQL Express. Pode ser com Autenticacao do Windows.

Crie o banco:

```sql
CREATE DATABASE QA_Orbit;
GO
```

Selecione o banco `QA_Orbit` no SSMS e execute o script:

```text
scripts/sql/qa-orbit-schema.sql
```

Esse script cria as tabelas, indices e estruturas usadas pelo app.

## Criar Usuario SQL

Ainda no SSMS, conectado como administrador, crie um login exclusivo para o QA Orbit:

```sql
USE master;
GO

CREATE LOGIN qaorbit_user WITH PASSWORD = 'TroqueEstaSenhaForteAqui123!';
GO

USE QA_Orbit;
GO

CREATE USER qaorbit_user FOR LOGIN qaorbit_user;
GO

ALTER ROLE db_owner ADD MEMBER qaorbit_user;
GO
```

Se o login ja existir ou voce quiser redefinir a senha:

```sql
USE master;
GO

ALTER LOGIN qaorbit_user ENABLE;
GO

ALTER LOGIN qaorbit_user WITH PASSWORD = 'TroqueEstaSenhaForteAqui123!' UNLOCK;
GO

USE QA_Orbit;
GO

IF USER_ID('qaorbit_user') IS NULL
  CREATE USER qaorbit_user FOR LOGIN qaorbit_user;
GO

ALTER ROLE db_owner ADD MEMBER qaorbit_user;
GO
```

## Ativar Autenticacao SQL

No SSMS:

1. Clique com botao direito no servidor.
2. Abra `Properties`.
3. Va em `Security`.
4. Marque `SQL Server and Windows Authentication mode`.
5. Salve.
6. Reinicie o servico SQL Server da instancia.

Para conferir:

```sql
SELECT SERVERPROPERTY('IsIntegratedSecurityOnly') AS WindowsOnly;
```

Resultado esperado:

```text
0
```

Se retornar `1`, a instancia ainda esta somente com Windows Authentication.

## Ativar TCP/IP E Porta

O SSMS pode conectar usando Shared Memory, mas o backend Node precisa acessar o SQL Server por TCP/IP.

No SQL Server Configuration Manager:

1. Abra `SQL Server Network Configuration`.
2. Entre em `Protocols for SQLEXPRESS01`, ou no nome da sua instancia.
3. Ative `TCP/IP`.
4. Abra `TCP/IP > Properties`.
5. Va na aba `IP Addresses`.
6. Desca ate `IPAll`.
7. Apague o valor de `TCP Dynamic Ports`.
8. Em `TCP Port`, informe a porta desejada, por exemplo `1434`.
9. Salve.
10. Reinicie `SQL Server (SQLEXPRESS01)`.

Teste no terminal:

```bash
sqlcmd -S 127.0.0.1,1434 -d QA_Orbit -U qaorbit_user -P "TroqueEstaSenhaForteAqui123!" -C -Q "SELECT DB_NAME(), SUSER_SNAME()"
```

Resultado esperado:

```text
QA_Orbit    qaorbit_user
```

## Configurar O .env

Exemplo usando porta TCP fixa:

```env
DB_SERVER=127.0.0.1
DB_INSTANCE=
DB_DATABASE=QA_Orbit
DB_USER=qaorbit_user
DB_PASSWORD=TroqueEstaSenhaForteAqui123!
DB_PORT=1434
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
DB_TRUSTED_CONNECTION=false
API_PORT=3001

AUTH_SECRET=troque-este-segredo-local
AUTH_BOOTSTRAP_EMAIL=admin@qaorbit.local
AUTH_BOOTSTRAP_PASSWORD=troque-esta-senha
AUTH_BOOTSTRAP_NAME=Administrador QA Orbit
AUTH_BOOTSTRAP_ROLE=admin
```

O usuario inicial do QA Orbit sera criado automaticamente quando o backend subir, desde que `AUTH_BOOTSTRAP_EMAIL` e `AUTH_BOOTSTRAP_PASSWORD` estejam preenchidos e a tabela `UsuariosQaOrbit` ainda esteja vazia.

## Rodar Localmente

Em um terminal, suba o backend:

```bash
npm run backend
```

Em outro terminal, suba o frontend:

```bash
npm run dev
```

Acesse:

```text
http://localhost:5173
```

API local:

```text
http://localhost:3001
```

Health check:

```text
http://localhost:3001/api/health
```

## Validar Conexao Pelo Node

Se quiser confirmar que o backend esta acessando o banco certo:

```bash
node -e "import('./backend/src/db.js').then(async (m) => { const pool = await m.getPool(); const result = await pool.request().query('SELECT DB_NAME() AS databaseName, SUSER_SNAME() AS loginName, (SELECT COUNT(1) FROM dbo.Areas) AS areasCount, (SELECT COUNT(1) FROM dbo.UsuariosQaOrbit) AS usersCount'); console.log(JSON.stringify(result.recordset[0])); await m.closePool(); }).catch((error) => { console.error(error.message); process.exit(1); })"
```

Resultado esperado:

```json
{"databaseName":"QA_Orbit","loginName":"qaorbit_user","areasCount":4,"usersCount":0}
```

Depois que o backend criar o usuario inicial, `usersCount` deve passar para `1`.

## Smart Recorder

A aba Smart Recorder grava interacoes manuais de um sistema web e transforma os passos em um blueprint tecnico para automacao futura.

O QA Orbit nao gera nem executa codigo Cypress nessa etapa. Ele apenas estrutura os dados do fluxo:

- projeto;
- URL inicial;
- ambiente;
- passos gravados;
- target Cypress recomendado;
- estrategia de selecao `css` ou `text`;
- comando sugerido `get` ou `contains`;
- qualidade do seletor `strong`, `medium` ou `weak`;
- valores parametrizados;
- JSON tecnico;
- prompt para Codex/IA criar o teste no repositorio Cypress externo.

Fluxo recomendado:

1. Abra o QA Orbit.
2. Acesse `Smart Recorder`.
3. Selecione um projeto.
4. Informe nome do fluxo, URL inicial e ambiente.
5. Clique em `Iniciar gravacao`.
6. Copie o `QA Orbit Recorder Snippet`.
7. Abra o sistema alvo no navegador.
8. Cole o snippet no console do navegador.
9. Execute o fluxo manualmente.
10. Volte ao QA Orbit e clique em `Atualizar` para ver os passos.
11. Edite, exclua ou reordene os passos se necessario.
12. Clique em `Exportar JSON`.
13. Copie o prompt para usar no Codex/IA dentro do repositorio Cypress externo.

O snippet envia eventos para:

```text
http://localhost:3001/api/smart-recorder/capture/:sessionId/steps
```

Esse endpoint usa um token da sessao e aceita somente passos da gravacao ativa. Ao pausar ou finalizar a gravacao, novos passos deixam de ser aceitos.
O token de captura expira em curto periodo e uma nova sessao gera um novo snippet.

Eventos capturados no MVP:

- click;
- type;
- select;
- check;
- uncheck;
- submit.

Campos sensiveis:

- campos `password` nao salvam senha real;
- o valor e substituido por `{{password}}`;
- campos com indicio de token, CPF, CNPJ, e-mail ou telefone sao parametrizados;
- URLs capturadas nao incluem query string nem hash;
- tokens, cookies e localStorage nao sao capturados.

Formato do blueprint exportado:

```json
{
  "name": "login admin",
  "startUrl": "https://hml.exemplo.com.br/",
  "environment": "hml",
  "steps": [
    {
      "order": 1,
      "action": "click",
      "target": {
        "strategy": "text",
        "selector": "button",
        "text": "Admin",
        "recommendedCommand": "contains",
        "fallbackSelector": "button"
      },
      "value": null,
      "variableName": null,
      "selectorQuality": "medium"
    }
  ]
}
```

Para executar o JSON em um projeto Cypress externo, use o template:

```text
examples/cypress-qa-orbit-runner
```

Ele le `cypress/fixtures/qa-orbit/blueprint.json` e executa os passos com `cy.get()` ou `cy.contains(selector, text)`.

Tabelas usadas:

- `SmartRecorderSessions`
- `SmartRecorderSteps`

Para aplicar em um banco existente, rode novamente:

```bash
sqlcmd -S 127.0.0.1,1434 -d QA_Orbit -U qaorbit_user -P "TroqueEstaSenhaForteAqui123!" -C -i scripts/sql/qa-orbit-schema.sql
```

## QA Runner

A aba QA Runner permite apontar um workspace Cypress externo e executar suites por projeto.

Fluxo recomendado:

1. Crie uma pasta Cypress fora do QA Orbit, por exemplo:

```text
C:\projetos\qarunner-cypress\meu-projeto
```

2. Dentro dela, mantenha as specs em:

```text
cypress/e2e
```

3. No QA Orbit, abra `QA Runner`.
4. Selecione o projeto.
5. Informe ou escolha a pasta do workspace Cypress.
6. Clique em `Buscar suites`.
7. Escolha a suite.
8. Informe `Base URL`, usuario, senha e parametros extras.
9. Execute a suite.

Opcionalmente, crie um arquivo `qa-orbit.suites.json` na raiz do workspace:

```json
{
  "projectKey": "meu-projeto",
  "projectName": "Meu projeto",
  "suites": [
    {
      "id": "login-admin",
      "name": "Login admin",
      "spec": "cypress/e2e/login-admin.cy.js",
      "requiredParams": ["baseUrl", "username", "password"]
    }
  ]
}
```

Sem esse arquivo, o QA Orbit procura automaticamente arquivos `.cy.*` ou `.spec.*` em `cypress/e2e`.

## Problemas Comuns

### SSMS conecta, mas o backend nao conecta

Provavelmente o SSMS esta usando Shared Memory. O backend precisa de TCP/IP.

Confira no SSMS:

```sql
SELECT
  net_transport,
  local_net_address,
  local_tcp_port
FROM sys.dm_exec_connections
WHERE session_id = @@SPID;
```

Se aparecer `Shared memory`, ative TCP/IP e configure a porta conforme explicado acima.

### Falha de logon do usuario qaorbit_user

Confira se a instancia esta em Mixed Mode:

```sql
SELECT SERVERPROPERTY('IsIntegratedSecurityOnly') AS WindowsOnly;
```

Confira se o login esta habilitado:

```sql
SELECT name, is_disabled
FROM sys.sql_logins
WHERE name = 'qaorbit_user';
```

### Banco errado

Liste os bancos da instancia:

```bash
sqlcmd -S 127.0.0.1,1434 -U qaorbit_user -P "TroqueEstaSenhaForteAqui123!" -C -Q "SELECT @@SERVERNAME, name FROM sys.databases ORDER BY name"
```

Garanta que o `.env` aponta para o banco usado no SSMS.

## Build

Para validar TypeScript e gerar build:

```bash
npm run build
```
