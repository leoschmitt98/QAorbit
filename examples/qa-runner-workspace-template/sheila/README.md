# Workspace Cypress Sheila

Este workspace ja esta organizado no formato:

```text
projeto > modulo > submodulo > suite
```

No exemplo:

- projeto: `sheila`
- modulo: `painel-admin`
- submodulo: `agendamento`

## Estrutura

```text
sheila/
  cypress/
    e2e/
      painel-admin/
        agendamento/
          criar-agendamento.cy.js
          editar-agendamento.cy.js
          cancelar-agendamento.cy.js
          realizando-agendamento-de-servico-com-sucesso.cy.js
    fixtures/
      qa-orbit/
        painel-admin/
          agendamento/
              criar-agendamento.json
              editar-agendamento.json
              cancelar-agendamento.json
              realizando-agendamento-de-servico-com-sucesso.json
    support/
      qa-orbit/
        run-blueprint.js
  qa-orbit.suites.json
  cypress.config.js
  package.json
```

## Instalar

```bash
npm install
```

## Abrir o Cypress

```bash
npm run cy:open
```

## Rodar em modo headless

```bash
npm run cy:run
```

## Rodar suites especificas

```bash
npm run test:criar-agendamento -- --env usuario="admin" password="sua-senha" pacienteNome="Paciente Teste" dataAgendamento="2026-05-10"
npm run test:editar-agendamento -- --env usuario="admin" password="sua-senha" pacienteNome="Paciente Teste" novoHorario="15:30"
npm run test:cancelar-agendamento -- --env usuario="admin" password="sua-senha" pacienteNome="Paciente Teste"
npm run test:realizando-agendamento-de-servico-com-sucesso -- --env baseUrl="https://hml.sheilasystem.com.br"
```

## Como usar com o QA Orbit

No QA Runner ou Automation Builder:

- `workingDir`: a pasta `sheila` copiada para sua maquina;
- `specPath`: um dos caminhos do manifesto `qa-orbit.suites.json`;
- `baseUrl`: URL do ambiente que sera testado;
- variaveis sensiveis e dados dinamicos: via `Cypress.env()`.

Exemplo:

```text
workingDir = C:\projetos\qa-runner\sheila
specPath = cypress/e2e/painel-admin/agendamento/criar-agendamento.cy.js
```

## Observacoes

- Os arquivos JSON em `fixtures/qa-orbit` sao exemplos e podem ser substituidos pelos blueprints exportados pelo QA Orbit.
- O helper `runQaOrbitBlueprint` faz a ponte entre o blueprint e o Cypress.
- Senhas continuam sendo passadas por `Cypress.env("password")`.
