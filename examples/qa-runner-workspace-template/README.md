## Template de workspace QA Runner

Esta pasta traz um workspace Cypress completo e generico para voce copiar para:

```text
C:\projetos\qa-runner
```

Estrutura pensada:

- projeto: `sheila`
- modulo: `painel-admin`
- submodulo: `agendamento`

### Como usar

1. Copie a pasta [sheila](C:/Users/Pichau/Desktop/WorkSpaceQA/examples/qa-runner-workspace-template/sheila) para `C:\projetos\qa-runner`.
2. Entre na pasta copiada.
3. Rode `npm install`.
4. Abra o Cypress com `npm run cy:open` ou execute em modo headless com `npm run cy:run`.
5. No QA Orbit, use o `workingDir` apontando para a pasta `sheila`.

Exemplo:

```text
workingDir = C:\projetos\qa-runner\sheila
```

Leia tambem o guia interno em [sheila/README.md](C:/Users/Pichau/Desktop/WorkSpaceQA/examples/qa-runner-workspace-template/sheila/README.md).
