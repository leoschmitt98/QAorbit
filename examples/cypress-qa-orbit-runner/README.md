# QA Orbit Cypress Blueprint Runner

Template externo para executar um blueprint exportado pelo Smart Recorder ou gerado pelo Automation Builder em modo Cypress.

Esta pasta ja esta estruturada como um projeto Cypress copiavel.

## Como usar

1. Copie a pasta inteira `examples/cypress-qa-orbit-runner` para onde voce quer manter os testes.
2. Renomeie a pasta se quiser, por exemplo `qarunner-cypress`.
3. Dentro da pasta copiada, rode:

```bash
npm install
```

4. Abra o Cypress:

```bash
npm run cy:open
```

5. Para rodar em modo headless:

```bash
npm run cy:run
```

6. Para o fluxo de login admin, passe a senha por ambiente:

```bash
npm run test:login-admin -- --env password="sua-senha"
```

Pelo QA Runner ou Automation Builder, informe:

- Caminho do workspace: esta pasta copiada;
- Suite: `Login senha valida`;
- Base URL: URL do cliente que sera testado;
- Senha: senha desse cliente.

Quando a Base URL for informada pelo QA Runner, o runner visita essa URL em vez da `startUrl` gravada no blueprint.

O runner usa:

- `cy.get(selector)` quando `target.recommendedCommand` for `get`.
- `cy.contains(selector, text)` quando `target.recommendedCommand` for `contains`.
- `Cypress.env("password")`, `Cypress.env("usuario")` etc. para valores no formato `{{variavel}}`.

## Onde colocar o JSON exportado pelo QA Orbit

Salve os blueprints em:

```text
cypress/fixtures/qa-orbit/
```

Exemplo:

```text
cypress/fixtures/qa-orbit/login-admin.json
```

Depois crie uma spec em:

```text
cypress/e2e/orbit/login-admin.cy.js
```

Com este formato:

```js
import blueprint from '../../fixtures/qa-orbit/login-admin.json'
import { runQaOrbitBlueprint } from '../../support/qa-orbit/run-blueprint'

describe('QA Orbit - Login admin', () => {
  it('executa o fluxo exportado pelo Smart Recorder', () => {
    runQaOrbitBlueprint(blueprint)
  })
})
```

Ele nao deve ser colocado dentro do QA Orbit. A ideia e manter o QA Orbit como gerador do blueprint e o projeto Cypress como executor.

## Relacao com o Automation Builder

O Automation Builder gera codigo para Cypress, Playwright e Selenium. Este template continua sendo o caminho recomendado para Cypress porque ja traz:

- `runQaOrbitBlueprint`;
- fixture em `cypress/fixtures/qa-orbit`;
- specs em `cypress/e2e/orbit`;
- scripts `cy:open` e `cy:run`.

Para Playwright e Selenium, use a spec gerada pelo Automation Builder em um workspace proprio desses frameworks.
