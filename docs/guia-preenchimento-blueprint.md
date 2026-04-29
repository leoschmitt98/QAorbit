# Guia de Preenchimento do Blueprint de Automacao

Este guia explica como preencher a aba `Blueprint de Automacao` do QA Orbit para gerar um documento tecnico forte o bastante para outra IA ou QA transformar o fluxo em Cypress.

## 1. Objetivo da aba

O Blueprint de Automacao existe para documentar um fluxo manual com contexto tecnico.

Ela deve responder:

- qual fluxo foi executado;
- qual elemento foi usado em cada passo;
- como localizar esse elemento;
- que valor foi digitado ou selecionado;
- qual o resultado esperado;
- como esse passo deveria virar uma linha Cypress.

## 2. O que preencher nos dados gerais do fluxo

### Nome do fluxo

Use um nome funcional e especifico.

Bom exemplo:

`Criar modelo de avaliacao com duas parciais`

Ruim:

`Teste da tela`

### Sistema / portal

Informe o produto ou portal exato.

Exemplo:

`Portal da Secretaria`

### Modulo

Informe o modulo funcional principal.

Exemplo:

`Configuracao de Modelos de Avaliacao`

### Objetivo

Explique o que o fluxo precisa provar.

Exemplo:

`Documentar o fluxo de criacao de modelo com duas parciais para futura geracao do teste Cypress.`

### Pre-condicoes

Liste o que precisa estar pronto antes do fluxo.

Exemplo:

- usuario autenticado;
- portal correto aberto;
- permissao para cadastrar modelo;
- ambiente de homologacao.

### Massa de teste

Registre os dados de apoio.

Exemplo:

`Base gvdasa_hml | Unidade Escola 1 | Usuario qa.secretaria`

### Resultado esperado final

Descreva a entrega funcional do fluxo inteiro.

Exemplo:

`Modelo salvo com sucesso com duas parciais cadastradas.`

## 3. Como preencher um passo

Cada passo precisa ser claro para um humano e util para automacao.

Campos principais:

- titulo do passo;
- tela ou modulo;
- acao executada;
- legenda do passo;
- nome do botao ou elemento;
- tipo do elemento;
- seletor manual;
- valor digitado;
- resultado esperado do passo;
- HTML de referencia;
- observacoes.

## 4. Quando usar cada tipo de acao

### click

Use quando o usuario apenas clica.

Exemplo:

- clicar em `Salvar`
- clicar em `Adicionar Parcial`

### type

Use quando o usuario digita texto ou numero.

Exemplo:

- preencher `Descricao do Modelo`
- preencher `Peso`

### select

Use quando o elemento for um select real ou quando o objetivo principal for selecionar um valor.

Importante:

Em sistemas legados, como ExtJS, um combo pode nao ser um `<select>` real. Nesses casos, muitas vezes e melhor separar em dois passos:

1. `click` para abrir o combo
2. `click` para escolher a opcao

### validate

Use para confirmacoes finais ou verificacoes de tela.

Exemplos:

- validar texto `Modelo salvo com sucesso`
- validar que tabela ficou visivel

## 5. Como preencher bem o seletor

## Ordem de preferencia

1. `data-testid`
2. `id` estatico
3. `name`
4. classe semantica
5. `cy.contains(...)`

## Exemplos bons

```text
#descricaoModelo
[name="descricaoModelo"]
.gv-botao-adicionar
cy.contains('button', 'Salvar')
```

## Exemplos ruins

```text
button
div
img
#ext-gen218
```

IDs como `ext-gen218` costumam indicar seletor dinamico em frameworks legados.

## 6. Seletor manual x HTML de referencia

### Seletor manual

Use quando voce quer dizer explicitamente:

`e este seletor que eu quero usar no teste`

### HTML de referencia

Use para colar o trecho completo do DevTools.

Esse HTML da contexto tecnico para:

- id;
- name;
- classes;
- tipo;
- texto;
- contexto do elemento.

## 7. Exemplos prontos de preenchimento

### Exemplo 1 - Campo de texto

Fluxo:

O QA quer preencher o nome do modelo com `teste`.

Preenchimento:

- titulo do passo: `Preencher nome do modelo`
- tela ou modulo: `Configurar modelo`
- acao executada: `type`
- legenda do passo: `Informar o nome do modelo`
- nome do botao ou elemento: `Descricao do Modelo`
- tipo do elemento: `input`
- seletor manual: `#descricaoModelo`
- valor digitado: `teste`
- resultado esperado do passo: `Campo preenchido com teste`

HTML de referencia:

```html
<input type="text" id="descricaoModelo" name="descricaoModelo" class="x-form-text x-form-field">
```

Linha Cypress esperada:

```js
cy.get('#descricaoModelo').type('teste');
```

### Exemplo 2 - Botao adicionar

Preenchimento:

- titulo do passo: `Abrir cadastro de modelo`
- acao executada: `click`
- nome do botao ou elemento: `Adicionar`
- tipo do elemento: `button`
- seletor manual: `.gv-botao-adicionar`

Linha Cypress esperada:

```js
cy.get('.gv-botao-adicionar').click();
```

### Exemplo 3 - Combo legado

Fluxo:

Selecionar `Somada` em `Tipo de avaliacao`.

Forma recomendada:

Passo 1:

- titulo: `Abrir combo Tipo de avaliacao`
- acao: `click`
- nome do elemento: `Tipo de avaliacao`
- seletor manual: `#comboSelect`

Passo 2:

- titulo: `Selecionar opcao Somada`
- acao: `click`
- nome do elemento: `Somada`
- seletor manual: `cy.contains('Somada')`

### Exemplo 4 - Mensagem de sucesso

Preenchimento:

- titulo do passo: `Validar mensagem de sucesso`
- acao executada: `validate`
- nome do elemento: `Modelo salvo com sucesso`
- tipo do elemento: `mensagem`
- resultado esperado do passo: `Modelo salvo com sucesso`

Linha Cypress esperada:

```js
cy.contains('Modelo salvo com sucesso').should('be.visible');
```

## 8. Como usar copiar passo

Use quando a estrutura do passo e quase igual a outra.

Exemplo:

- parcial 1: descricao `Teste1`, reduzida `tst1`, peso `5`
- parcial 2: descricao `Teste2`, reduzida `tst2`, peso `5`

Em vez de preencher tudo de novo:

1. copie o passo antigo;
2. o sistema cria a copia como ultimo passo;
3. edite apenas os campos que mudaram.

## 9. Como interpretar o DOCX final

O DOCX final deve servir como material tecnico para:

- outra IA gerar Cypress;
- um QA senior revisar o fluxo;
- criar base de automacao futura;
- padronizar seletores e acoes do fluxo.

Um DOCX bom precisa mostrar:

- a ordem dos passos;
- o seletor principal;
- o seletor alternativo;
- o motivo da escolha;
- a linha Cypress esperada.

## 10. Como um GPT instrutor deve orientar o usuario nesta aba

O GPT deve:

- corrigir preenchimentos vagos;
- sugerir melhor seletor;
- dizer quando o usuario colou HTML no lugar errado;
- recomendar separar passos de combos legados;
- incentivar resultado esperado claro;
- evitar sugerir seletor generico demais.
