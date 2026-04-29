# FAQ Operacional do QA Orbit

Este documento foi criado para servir como base de conhecimento de um GPT instrutor do QA Orbit.

O foco aqui e responder as duvidas mais comuns de um usuario final, com linguagem objetiva e exemplos praticos.

## 1. O que e o QA Orbit

O QA Orbit e uma plataforma operacional de QA para:

- registrar analises;
- documentar chamados;
- guardar evidencias;
- transformar validacoes em historico;
- sugerir regressao;
- estruturar fluxos para automacao;
- integrar a execucao futura com Cypress.

Ele nao e apenas um gerador de bug ou um gravador de evidencias. O objetivo e transformar o trabalho manual do QA em ativos reutilizaveis.

## 2. Qual aba usar em cada caso

### Nova Analise

Use quando voce estiver trabalhando em um chamado, validando um fluxo ou montando uma avaliacao funcional completa.

Use essa aba para:

- registrar contexto do chamado;
- estruturar o problema;
- anexar evidencias;
- classificar impacto;
- alimentar historico;
- ajudar o sistema a sugerir regressao.

### Historico de Fluxos

Use para localizar chamados salvos e retomaveis.

Serve para:

- continuar uma analise nao finalizada;
- consultar validacoes anteriores;
- revisar contexto operacional salvo.

### Historico de Testes

Use para consultar a memoria funcional do sistema.

Serve para:

- pesquisar validacoes antigas;
- entender o que ja foi testado;
- comparar fluxos parecidos;
- apoiar regressao.

### Bugs

Use quando a validacao confirmou um defeito e voce precisa estruturar o bug com:

- comportamento esperado;
- comportamento obtido;
- passos;
- quadros;
- severidade;
- prioridade.

### Projetos

Use para cadastrar e organizar:

- projeto;
- portal;
- modulos.

Isso e importante porque a qualidade das sugestoes de regressao depende diretamente da boa classificacao desses dados.

### Blueprint de Automacao

Use para montar um fluxo manual pensado para automacao futura.

Essa aba nao executa Cypress.

Ela serve para:

- documentar cada passo;
- guardar nome do elemento;
- guardar seletor retirado do DevTools;
- colar HTML do elemento;
- montar um DOCX, JSON ou Markdown;
- entregar contexto para outra IA ou para um QA gerar o teste automatizado.

### Smart Recorder

Use quando quiser capturar interacoes manuais em um sistema web e transformar isso em blueprint tecnico.

### QA Runner

Use quando ja existir uma suite Cypress em um repositorio externo e voce quiser executar a suite a partir do QA Orbit.

## 3. Como saber se devo usar Nova Analise ou Blueprint de Automacao

Use `Nova Analise` quando o objetivo principal for validar um chamado.

Use `Blueprint de Automacao` quando o objetivo principal for montar um documento tecnico do fluxo para gerar automacao depois.

Resumo:

- Nova Analise = validacao funcional do chamado
- Blueprint de Automacao = documentacao tecnica do fluxo para automacao

## 4. O que significa uma sugestao de regressao

Quando o QA Orbit sugere regressao, ele esta dizendo:

"Ja existe historico funcional parecido o suficiente para indicar que esse novo chamado pode impactar validacoes anteriores."

Isso nao significa que o sistema encontrou um bug identico.

Significa que existe risco funcional semelhante com base em:

- projeto;
- modulo principal;
- portal ou area;
- fluxo ou cenario;
- comportamento esperado;
- comportamento relatado;
- modulos impactados;
- changelog do dev;
- historico salvo anteriormente.

## 5. O que preciso preencher bem para a regressao funcionar

Campos mais importantes:

- projeto;
- modulo principal;
- portal ou area;
- fluxo ou cenario;
- comportamento esperado;
- comportamento relatado;
- modulos impactados;
- changelog do dev.

Se esses campos forem preenchidos de forma vaga, a regressao perde qualidade.

## 6. Quando um chamado deve ir para o historico

O historico deve guardar validacoes que realmente agregam memoria operacional.

Exemplos de bons candidatos:

- fluxo importante do negocio;
- bug com impacto relevante;
- validacao que pode virar regressao;
- fluxo que provavelmente sera repetido em novas versoes;
- validacao que ja aponta caminho para automacao.

## 7. Como preencher um passo no Blueprint de Automacao

Um passo bom normalmente tem:

- titulo claro;
- acao correta;
- nome do elemento;
- seletor principal ou HTML do DevTools;
- valor digitado, quando existir;
- resultado esperado.

Exemplo de passo `type`:

- titulo: `Preencher nome do modelo`
- acao: `type`
- nome do elemento: `Descricao do modelo`
- seletor manual: `#descricaoModelo`
- valor digitado: `teste`
- resultado esperado: `Campo preenchido com o nome do modelo`

## 8. Posso colar o HTML inteiro do DevTools

Sim.

O lugar mais adequado para isso e o campo `HTML de referencia`.

Esse HTML ajuda a IA ou o proprio sistema a extrair:

- id;
- name;
- classes;
- tipo do elemento;
- texto visivel;
- contexto tecnico do seletor.

## 9. Qual a diferenca entre seletor manual e HTML de referencia

### Seletor manual

Use quando voce ja sabe qual seletor quer forcar.

Exemplos:

- `#descricaoModelo`
- `.gv-botao-adicionar`
- `[name="descricaoModelo"]`
- `cy.contains('button', 'Salvar')`

### HTML de referencia

Use quando quer colar o trecho completo do DevTools para dar contexto tecnico.

Exemplo:

```html
<input type="text" id="descricaoModelo" name="descricaoModelo" class="x-form-text x-form-field">
```

## 10. Como registrar um select ou combo legado

Se o sistema for legado, como ExtJS, nem todo combo e um `<select>` HTML real.

Nesses casos, o fluxo mais seguro geralmente e:

1. clicar no campo;
2. clicar na opcao pelo texto.

Entao, em vez de um unico passo `select`, muitas vezes faz mais sentido registrar dois passos:

1. abrir o combo;
2. selecionar a opcao desejada.

## 11. Como validar mensagem de sucesso

Se o sistema exibe uma mensagem como:

`Modelo salvo com sucesso`

Crie um passo com:

- acao: `validate`
- nome do elemento: `Modelo salvo com sucesso`
- resultado esperado: `Modelo salvo com sucesso`

## 12. O que fazer antes de recarregar a pagina

No Blueprint de Automacao atual:

- o rascunho e salvo automaticamente no navegador;
- tambem e recomendado exportar o JSON.

Boas praticas:

1. deixe o autosave ativo;
2. exporte o JSON periodicamente;
3. gere o DOCX no final do fluxo.

## 13. Quando duplicar um passo

Use `copiar passo` quando o passo seguinte for quase igual ao anterior.

Exemplo:

- preencher `Descricao da parcial 1`;
- depois copiar o passo para preencher `Descricao da parcial 2`;
- mudar apenas valor digitado e, se necessario, a legenda.

## 14. O QA Orbit gera o teste Cypress sozinho

Nao necessariamente.

O QA Orbit pode:

- montar blueprint;
- gravar contexto;
- gerar DOCX, JSON e Markdown;
- entregar material para outra IA ou para um QA montar o teste.

Em fluxos com Smart Recorder e QA Runner, ele ajuda a aproximar o caminho ate a automacao e execucao, mas a geracao final do teste pode continuar externa.

## 15. Como um GPT instrutor deve responder sobre o QA Orbit

O GPT deve:

- responder com foco operacional;
- diferenciar claramente o que ja existe do que e roadmap;
- ensinar o melhor preenchimento de campos;
- orientar o usuario passo a passo;
- evitar respostas genericas sobre Cypress quando o contexto for QA Orbit;
- sugerir exemplos concretos de preenchimento.
