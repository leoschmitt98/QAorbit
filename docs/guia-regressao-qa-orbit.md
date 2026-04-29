# Guia de Regressao do QA Orbit

Este documento explica como o QA Orbit usa historico funcional para sugerir regressao e como o usuario deve preencher os dados para obter melhores resultados.

## 1. O que significa regressao no QA Orbit

No QA Orbit, regressao significa:

`Existe historico funcional suficientemente parecido para indicar que o novo chamado pode impactar um fluxo ja validado anteriormente.`

Nao significa que o sistema encontrou o mesmo bug.

Significa que existe proximidade funcional e risco de reaparecimento ou impacto lateral.

## 2. O que o sistema compara

Os sinais mais importantes sao:

- projeto;
- modulo principal;
- portal ou area;
- fluxo ou cenario;
- comportamento esperado;
- comportamento relatado;
- modulos impactados;
- changelog do dev;
- resultado final do historico anterior.

## 3. Campos obrigatorios mais importantes

Para a regressao funcionar bem, estes campos precisam ser preenchidos com cuidado:

- projeto;
- modulo principal;
- portal ou area;
- fluxo ou cenario;
- comportamento esperado;
- comportamento relatado;
- modulos impactados;
- changelog do dev.

## 4. Por que modulo sozinho nao basta

Dois chamados podem estar no mesmo modulo e ainda assim nao terem risco de regressao relevante.

Exemplo:

- chamado 1: emissao de diario
- chamado 2: template do diario

Mesmo modulo, mas fluxos e impactos diferentes.

Por isso o sistema precisa de mais contexto do que apenas `projeto + modulo`.

## 5. O que faz uma sugestao de regressao ser forte

Uma sugestao fica mais forte quando existe combinacao de sinais estruturais e sinais funcionais.

### Sinais estruturais

- mesmo projeto;
- mesmo modulo principal;
- mesma area ou portal;
- modulos impactados coincidentes;
- artefatos parecidos no changelog.

### Sinais funcionais

- fluxo parecido;
- comportamento esperado parecido;
- comportamento relatado parecido;
- resumo do problema com palavras em comum.

## 6. O que enfraquece uma sugestao

Uma sugestao fica fraca quando:

- o chamado esta generico demais;
- o fluxo nao foi descrito;
- comportamento esperado esta vazio;
- comportamento relatado esta superficial;
- changelog nao informa o que foi alterado;
- modulos impactados nao foram marcados.

## 7. Como escrever melhor o fluxo ou cenario

Evite:

`Erro no modulo diario`

Prefira:

`Fechamento do diario de classe nao atualiza status final para secretaria`

Um fluxo bem escrito ajuda o sistema a separar cenarios parecidos de cenarios realmente equivalentes.

## 8. Como escrever melhor o comportamento esperado

Evite:

`Deve funcionar`

Prefira:

`Ao salvar o modelo com duas parciais, o sistema deve persistir o cadastro e exibir a mensagem Modelo salvo com sucesso.`

## 9. Como escrever melhor o comportamento relatado

Evite:

`Deu erro`

Prefira:

`Ao clicar em salvar, o sistema nao persiste o modelo e exibe mensagem de validacao sem destacar qual parcial esta inconsistente.`

## 10. Como o changelog do dev ajuda na regressao

O changelog do dev ajuda o sistema a entender artefatos alterados, como:

- modulo;
- controller;
- service;
- component;
- spec;
- tela;
- endpoint.

Se o changelog estiver bem preenchido, ele melhora muito a sugestao de regressao.

Exemplo bom:

```text
Alterados:
- secretaria/diario-classe/status-service.ts
- secretaria/diario-classe/fechamento-controller.ts
- secretaria/diario-classe/resumo-fechamento.ts
```

## 11. Como os modulos impactados ajudam

O modulo principal mostra onde o problema nasce.

Os modulos impactados mostram onde o efeito pode aparecer.

Esse conjunto melhora a visao de risco.

Exemplo:

- modulo principal: `Diario de Classe`
- modulos impactados: `Boletim`, `Resumo Academico`, `Secretaria`

## 12. Quando um historico deve ser salvo para servir regressao

Salve no historico quando o fluxo:

- representa regra relevante;
- cobre validacao importante do negocio;
- tem potencial de ser repetido;
- pode virar regressao;
- pode virar automacao.

Nao salve historico inutil apenas para volume.

## 13. O que o usuario deve marcar para o sistema buscar melhor

Checklist pratico:

1. projeto correto
2. modulo principal correto
3. area ou portal correto
4. fluxo ou cenario bem descrito
5. comportamento esperado completo
6. comportamento relatado completo
7. modulos impactados selecionados
8. changelog do dev detalhado

## 14. Como um GPT instrutor deve responder sobre regressao

O GPT deve:

- explicar que regressao e uma sugestao de risco, nao uma verdade absoluta;
- orientar o usuario a melhorar o preenchimento;
- dizer quais campos estao fracos;
- sugerir formas melhores de descrever fluxo, esperado e relatado;
- mostrar exemplos concretos.

## 15. Frases uteis para um GPT instrutor

Exemplos de respostas boas:

- `Esse chamado ainda esta fraco para regressao porque o fluxo nao foi descrito com clareza.`
- `Projeto e modulo coincidem, mas o comportamento relatado ainda esta generico demais para sugerir um risco forte.`
- `Se voce preencher modulos impactados e detalhar o changelog, a regressao tende a ficar mais confiavel.`
- `Mesmo modulo nao significa necessariamente mesma regressao; o fluxo funcional precisa bater tambem.`
