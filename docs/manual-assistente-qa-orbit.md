# Manual Base do Assistente QA Orbit

Este documento serve como base de conhecimento para um GPT personalizado chamado **Assistente QA Orbit**. Ele deve ajudar usuarios de QA a entender, usar e evoluir o QA Orbit com seguranca, clareza e boas praticas.

O conteudo separa funcionalidades atuais de ideias futuras. Quando algo estiver planejado, o Assistente deve apresentar como roadmap, nao como recurso ja pronto.

## 1. Visao geral do QA Orbit

### O que e

O QA Orbit e uma plataforma operacional de QA criada para centralizar o ciclo de testes em um unico fluxo: analise de demandas, documentacao funcional, evidencias, historico, bugs, blueprints de automacao, captura de interacoes, suites Cypress e execucao via QA Runner.

Ele foi pensado para apoiar o trabalho diario de QA, principalmente em cenarios onde a equipe precisa transformar conhecimento manual em ativos reutilizaveis: evidencias, historicos, regressao e automacao.

### Para quem serve

O QA Orbit serve para:

- QA junior que precisa de roteiro e padronizacao.
- QA pleno que precisa organizar evidencias, fluxos e historico.
- QA senior que quer transformar testes manuais em regressao e automacao.
- Lider de QA que precisa de visibilidade de qualidade.
- Times que querem reaproveitar testes entre clientes, ambientes e versoes.
- Times que desejam preparar automacao Cypress sem perder a rastreabilidade funcional.

### Qual problema resolve

Em muitos times, o conhecimento de QA fica espalhado em chamados, prints, conversas, planilhas, documentos locais e repositorios de automacao. Isso gera perda de contexto, dificuldade de regressao e retrabalho.

O QA Orbit tenta resolver esse problema criando uma trilha unica:

```text
Demanda -> Analise -> Evidencia -> Historico -> Blueprint -> Automacao -> Execucao -> Regressao
```

### Como se diferencia de ferramentas comuns

Ferramentas comuns costumam focar em uma parte do processo:

- ferramenta de chamado;
- ferramenta de evidencia;
- ferramenta de documentacao;
- ferramenta de automacao;
- ferramenta de execucao.

O QA Orbit nao tenta substituir todas elas. Ele atua como uma camada operacional de QA, conectando o raciocinio do teste manual com a automacao e a reutilizacao futura.

O diferencial e a conexao entre:

- contexto funcional;
- evidencia;
- historico;
- sugestao de regressao;
- blueprint tecnico;
- execucao Cypress;
- orientacao por IA/Codex.

## 2. Conceito principal

### "Do chamado ao teste automatizado executado."

Essa frase resume a proposta do QA Orbit.

Ela significa que uma demanda ou chamado nao deve morrer depois de uma validacao manual. O conhecimento gerado durante a analise pode virar:

- evidencia de teste;
- bug documentado;
- historico pesquisavel;
- candidato de regressao;
- blueprint de automacao;
- suite Cypress;
- execucao futura pelo QA Runner.

O objetivo e transformar uma atividade pontual de QA em um ativo reutilizavel.

Exemplo com o projeto Sheila:

1. Um chamado pede validar login admin.
2. O QA cadastra uma nova analise.
3. Executa o fluxo manualmente.
4. Salva evidencia.
5. Registra o caso no historico.
6. Usa o Smart Recorder para capturar o fluxo.
7. Exporta o blueprint JSON.
8. Gera ou usa uma suite Cypress.
9. Roda a suite no QA Runner com URL e senha do cliente.
10. Reaproveita o teste em regressao.

## 3. Fluxo ponta a ponta

### 1. Receber chamado ou tarefa

O processo comeca quando chega uma demanda, chamado, bug reportado, tarefa funcional ou necessidade de validacao.

Boas perguntas iniciais:

- Qual comportamento deve ser validado?
- Qual sistema, projeto ou cliente esta envolvido?
- Qual modulo ou local de teste?
- Existe massa de teste?
- Existe ambiente disponivel?
- Existe risco de regressao?

### 2. Cadastrar nova analise

No modulo **Nova Analise**, o QA registra o contexto do teste.

Campos comuns:

- projeto;
- titulo;
- descricao;
- modulo;
- ambiente;
- URL de acesso;
- usuario ou perfil usado;
- base de referencia;
- versao;
- dados de teste.

### 3. Estruturar o problema

Antes de testar, o QA deve transformar a demanda em uma estrutura clara:

- problema relatado;
- comportamento esperado;
- comportamento obtido;
- criterios de aceite;
- pre-condicoes;
- riscos.

### 4. Executar teste manual

O QA executa o fluxo real no sistema alvo.

Boas praticas:

- testar em ambiente correto;
- usar massa controlada;
- anotar dados importantes;
- observar mensagens, redirecionamentos e estados de tela;
- separar falha funcional de falha de ambiente.

### 5. Gerar evidencia, GIF ou prints

Evidencias devem demonstrar o que foi validado. Elas podem incluir:

- print antes/depois;
- GIF do fluxo;
- imagem anotada;
- documento de apoio;
- arquivo gerado;
- log relevante.

### 6. Salvar historico

O historico transforma o teste em conhecimento reutilizavel.

Ele deve conter:

- fluxo/cenario;
- resultado final;
- criticidade;
- modulo principal;
- tags;
- automacao candidata;
- caminho de spec, quando existir;
- relacao com bug ou chamado.

### 7. Sugerir regressao futura

Quando um teste valida comportamento importante, ele deve ser candidato a regressao.

Exemplos:

- login admin;
- criacao de agendamento;
- confirmacao de pagamento;
- alteracao de status;
- fluxo com historico de falhas.

### 8. Vincular bug quando necessario

Se a analise revelar erro, o QA pode registrar ou vincular um bug.

Um bug deve conter:

- titulo claro;
- comportamento esperado;
- comportamento obtido;
- severidade;
- prioridade;
- passos de reproducao;
- evidencias.

### 9. Cadastrar fluxo para automacao

O QA decide se o fluxo tem valor para automacao.

Um bom candidato geralmente e:

- repetitivo;
- critico;
- estavel;
- facil de parametrizar;
- importante para regressao;
- com seletores confiaveis.

### 10. Usar Smart Recorder

O Smart Recorder captura a execucao manual e gera um blueprint tecnico.

Ele ajuda a transformar o caminho real do usuario em steps reutilizaveis para Cypress.

### 11. Exportar blueprint JSON

O JSON exportado pelo Smart Recorder possui steps com:

- ordem;
- acao;
- target;
- seletor;
- comando recomendado;
- valor parametrizado;
- qualidade do seletor;
- sugestao de melhoria.

### 12. Gerar teste Cypress

O teste Cypress deve ficar em repositorio externo ou workspace separado.

O QA Orbit fornece conhecimento e blueprint. O Cypress executa o codigo.

### 13. Cadastrar suite

No workspace Cypress, a suite pode ser detectada por scan ou por manifesto `qa-orbit.suites.json`.

### 14. Executar via QA Runner

No QA Runner, o usuario escolhe:

- projeto;
- workspace Cypress;
- suite;
- base URL;
- credenciais;
- parametros extras.

### 15. Salvar resultado da execucao

Funcionalidade atual: o QA Runner mostra log e status da execucao.

Roadmap: persistir historico de execucoes, videos, screenshots, duracao, ambiente, usuario executor e resultado por suite.

## 4. Modulos atuais do QA Orbit

### Dashboard

#### Objetivo

Fornecer visao geral do estado do QA: projetos, analises, historico, bugs e atividade recente.

#### Quando usar

- ao iniciar o dia;
- ao revisar andamento;
- ao priorizar testes;
- ao observar volume de bugs ou regressao.

#### Campos principais

O conteudo pode variar conforme evolucao do produto, mas tende a reunir indicadores e atalhos.

#### Boas praticas

- usar como ponto de entrada;
- revisar pendencias;
- identificar projetos com maior risco.

#### Erros comuns

- interpretar dashboard como fonte unica de verdade quando dados ainda nao foram cadastrados;
- ignorar filtros de projeto ou workspace.

### Nova Analise

#### Objetivo

Registrar e conduzir uma analise de QA a partir de chamado, tarefa ou demanda.

#### Quando usar

- ao receber uma nova validacao;
- ao testar bug reportado;
- ao documentar um fluxo funcional;
- ao gerar evidencia de comportamento.

#### Campos principais

- projeto;
- titulo;
- descricao;
- modulo;
- ambiente;
- URL;
- credenciais ou perfil de acesso;
- dados de teste;
- resultado da analise;
- resposta de IA, quando usada.

#### Boas praticas

- escrever titulo claro;
- separar comportamento esperado de comportamento obtido;
- nao salvar senha real em texto livre;
- anexar evidencia quando possivel;
- salvar no historico quando o teste tiver valor futuro.

#### Erros comuns

- cadastrar analise sem projeto;
- usar nomes pessoais ou internos demais;
- nao registrar massa de teste;
- deixar conclusao ambigua.

### Evidencias

#### Objetivo

Guardar provas do teste executado.

#### Quando usar

- ao validar fluxo;
- ao comprovar bug;
- ao demonstrar correcao;
- ao documentar comportamento para regressao.

#### Campos principais

- arquivo;
- legenda;
- descricao;
- ordem;
- vinculo com analise, cenario ou bug.

#### Boas praticas

- preferir evidencias curtas e objetivas;
- remover dados sensiveis;
- usar legenda clara;
- marcar o ponto exato do problema quando possivel.

#### Erros comuns

- salvar prints sem contexto;
- capturar dados pessoais desnecessarios;
- anexar arquivos pesados sem necessidade.

### Historico de Testes

#### Objetivo

Criar uma base pesquisavel de testes executados.

#### Quando usar

- apos concluir analise importante;
- ao identificar cenario reutilizavel;
- ao preparar regressao;
- ao classificar automacao futura.

#### Campos principais

- fluxo/cenario;
- projeto;
- modulo;
- criticidade;
- resultado final;
- tags;
- automacao;
- spec Cypress, quando existir.

#### Boas praticas

- usar nomes genericos e reaproveitaveis;
- marcar candidato a automacao;
- vincular bug quando houver;
- usar tags de negocio.

#### Erros comuns

- salvar historico duplicado sem necessidade;
- nao indicar modulo;
- nao descrever resultado esperado.

### Bugs / Chamados

#### Objetivo

Registrar falhas, reproducoes e evidencias relacionadas.

#### Quando usar

- quando comportamento obtido diverge do esperado;
- quando falha impede fluxo critico;
- quando ha regressao.

#### Campos principais

- titulo;
- severidade;
- prioridade;
- status;
- passos de reproducao;
- comportamento esperado;
- comportamento obtido;
- evidencias.

#### Boas praticas

- escrever bug reproduzivel;
- informar ambiente e versao;
- anexar evidencia;
- diferenciar bug de melhoria;
- vincular com analise original.

#### Erros comuns

- titulo generico;
- ausencia de passos;
- nao informar massa ou ambiente;
- misturar multiplos problemas no mesmo bug.

### Projetos

#### Objetivo

Organizar locais de teste, modulos, documentos e automacoes por projeto.

#### Quando usar

- antes de cadastrar analises;
- ao configurar estrutura funcional;
- ao separar clientes, produtos ou sistemas.

#### Campos principais

- nome do projeto;
- locais de teste;
- modulos;
- status ativo/inativo.

#### Boas praticas

- usar nomes neutros e profissionais;
- evitar nomes pessoais quando o ambiente sera compartilhado;
- manter modulos coerentes;
- excluir ou inativar apenas com cuidado.

#### Erros comuns

- misturar clientes no mesmo projeto;
- criar modulos duplicados;
- nomear local de teste como "portal" quando o dominio do produto pede outro termo.

### Smart Recorder

#### Objetivo

Capturar interacoes manuais e gerar blueprint tecnico para automacao Cypress futura.

#### Quando usar

- quando o fluxo ja pode ser executado no sistema;
- quando o QA quer transformar uso real em automacao;
- quando e preciso identificar seletores.

#### Campos principais

- projeto;
- nome do fluxo;
- URL inicial;
- ambiente;
- observacoes;
- snippet;
- passos capturados;
- preview JSON;
- prompt para Codex/IA.

#### Boas praticas

- gravar fluxos curtos;
- revisar seletores;
- evitar dados reais;
- substituir valores sensiveis por variaveis;
- adicionar `data-testid`, `data-cy` ou `data-test` quando seletor for fraco.

#### Erros comuns

- gravar fluxo longo demais;
- usar texto dinamico como seletor;
- nao revisar o JSON;
- tentar usar senha literal.

### Blueprint de Automacao

#### Objetivo

Documentar manualmente ou enriquecer um fluxo para automacao.

#### Quando usar

- antes de automatizar fluxo complexo;
- depois de importar JSON do Smart Recorder;
- quando o QA quer detalhar resultado esperado e legenda de cada passo;
- para gerar documentacao em Word, Markdown ou JSON.

#### Campos principais

- nome do fluxo;
- sistema/local de teste;
- modulo;
- objetivo;
- pre-condicoes;
- massa de teste;
- resultado esperado final;
- passos;
- seletores;
- legenda;
- resultado esperado por passo.

#### Boas praticas

- usar o Smart Recorder para capturar o esqueleto tecnico;
- importar o JSON no Blueprint manual;
- enriquecer cada passo com regra de negocio;
- exportar Word/Markdown para documentacao.

#### Erros comuns

- documentar sem seletor quando o objetivo e automacao;
- nao preencher resultado esperado;
- copiar HTML completo desnecessario.

### QA Runner

#### Objetivo

Executar suites Cypress externas a partir do QA Orbit.

#### Quando usar

- quando a suite Cypress ja existe;
- quando e preciso rodar o mesmo teste em outro cliente;
- para validar regressao rapidamente.

#### Campos principais

- projeto;
- caminho do workspace Cypress;
- suite;
- base URL;
- usuario;
- senha;
- parametros extras;
- log de execucao.

#### Boas praticas

- manter workspace Cypress organizado;
- usar manifesto `qa-orbit.suites.json`;
- passar credenciais por variavel;
- nao hardcodar senha no spec;
- revisar videos e logs.

#### Erros comuns

- apontar para pasta errada;
- nao instalar dependencias do Cypress;
- deixar `ELECTRON_RUN_AS_NODE` ativo;
- esquecer de passar senha exigida pela suite.

### Configuracoes

#### Objetivo

Gerenciar parametros da aplicacao, usuarios, acesso e preferencias.

#### Quando usar

- ao configurar ambiente local;
- ao revisar usuarios;
- ao ajustar perfis de acesso.

#### Boas praticas

- usar usuarios reais apenas quando necessario;
- remover acessos antigos;
- manter `.env` fora do Git.

#### Erros comuns

- commitar `.env`;
- usar banco errado;
- misturar producao com ambiente local.

### Health Check

#### Objetivo

Verificar se backend e banco estao respondendo corretamente.

#### Quando usar

- apos configurar SQL Express;
- apos trocar `.env`;
- ao investigar erro de API;
- antes de testar modulo novo.

#### Boas praticas

- verificar `/api/health`;
- conferir banco ativo;
- validar schema atualizado;
- revisar logs do backend.

#### Erros comuns

- testar frontend quando backend esta desligado;
- usar porta errada;
- banco sem schema aplicado.

## 5. Smart Recorder

### Objetivo

O Smart Recorder captura interacoes visiveis do usuario em uma aplicacao web e transforma em blueprint tecnico para automacao Cypress.

Ele nao executa Cypress. Ele grava e estrutura.

### Como criar sessao

1. Abrir `Smart Recorder`.
2. Selecionar projeto.
3. Informar nome do fluxo.
4. Informar URL inicial.
5. Informar ambiente.
6. Clicar em `Iniciar gravacao`.
7. Copiar o snippet gerado.

### Como usar snippet local

1. Abrir o sistema alvo no navegador.
2. Abrir DevTools.
3. Ir em Console.
4. Se o Chrome bloquear cola, digitar `allow pasting`.
5. Colar o snippet do QA Orbit.
6. Executar o fluxo manualmente.
7. Voltar ao QA Orbit.
8. Clicar em `Atualizar`.

### O que o snippet captura

- click;
- type;
- select;
- check;
- uncheck;
- submit;
- seletor recomendado;
- seletor fallback;
- texto visivel de botao/link;
- tipo de elemento;
- valor digitado quando permitido;
- tag minima do elemento.

### O que ele NAO captura

- cookies;
- tokens;
- localStorage;
- sessionStorage;
- requisicoes internas;
- DOM completo;
- HTML completo;
- senha real;
- query string ou hash da URL.

### Cuidados de seguranca

- usar preferencialmente localmente;
- nao colar snippet de origem desconhecida;
- pausar/finalizar gravacao ao terminar;
- revisar valores capturados;
- nao usar dados reais sensiveis em testes.

### Como revisar seletores

O usuario deve conferir:

- se o seletor usa `data-testid`, `data-cy` ou `data-test`;
- se nao depende de texto dinamico;
- se nao usa caminho longo;
- se nao depende de classe visual;
- se nao tem `nth-child` ou `nth-of-type`.

### Seletor forte, medio e fraco

#### Forte

Exemplos:

- `[data-testid='admin-login-submit']`
- `[data-cy='btn-admin']`
- `#login-button` quando o ID e estavel.

#### Medio

Exemplos:

- `input[name='password']`
- `[aria-label='Senha']`
- `cy.contains('button', 'Admin')`
- `input[type='password']`

#### Fraco

Exemplos:

- `div > div > form > button`
- `.btn.primary`
- `button:nth-of-type(2)`
- texto dinamico como `Entrando...`

### Quando sugerir data-testid/data-cy/data-test

Sugerir quando:

- o seletor atual for fraco;
- o elemento for importante para regressao;
- o fluxo sera automatizado;
- o texto da tela mudar por idioma, estado ou loading.

Exemplo:

```html
<button data-cy="admin-login-submit">Entrar</button>
```

### Como exportar JSON

1. Abrir sessao gravada.
2. Revisar passos.
3. Editar ou excluir passos desnecessarios.
4. Clicar em `Exportar JSON`.
5. Copiar ou baixar o blueprint.

### Como gerar prompt para Codex/IA

O Smart Recorder gera prompt com:

- contexto do projeto;
- JSON do fluxo;
- orientacao de Cypress;
- uso de `Cypress.env()`;
- recomendacao de Page Object apenas para seletores fortes.

### Como usar blueprint no Cypress externo

O JSON deve ser salvo no repositorio Cypress externo, por exemplo:

```text
cypress/fixtures/qa-orbit/login-admin.json
```

O spec importa o JSON e usa o runner generico:

```js
import blueprint from '../../fixtures/qa-orbit/login-admin.json'
import { runQaOrbitBlueprint } from '../../support/qa-orbit/run-blueprint'

describe('Login admin', () => {
  it('executa blueprint do QA Orbit', () => {
    runQaOrbitBlueprint(blueprint)
  })
})
```

## 6. Seguranca do Smart Recorder

### Uso local

O uso atual e pensado para ambiente local/controlado. O snippet envia eventos para o backend local do QA Orbit.

### Cookies, tokens e storage

O snippet nao deve acessar:

- cookies;
- tokens;
- localStorage;
- sessionStorage;
- dados de rede;
- backend do sistema alvo.

### Senha e campos sensiveis

Campo `password` vira:

```text
{{password}}
```

Campos com indicio de token, segredo, CPF, CNPJ, e-mail ou telefone devem virar variaveis.

### URL segura

A URL capturada nao deve conter query string nem hash. Isso evita salvar tokens ou parametros sensiveis.

### HTML minimo

O QA Orbit salva apenas uma tag curta representativa, nao o HTML completo.

### Boas praticas corporativas

- usar ambiente de homologacao sempre que possivel;
- nao capturar dados reais de cliente;
- revisar JSON antes de compartilhar;
- nao versionar credenciais;
- documentar o motivo de cada variavel.

## 7. Padrao de seletores para Cypress

Ranking recomendado:

1. `data-testid`
2. `data-cy`
3. `data-test`
4. ID estavel
5. `name`
6. `aria-label`
7. role + texto
8. `button` ou `a` + texto visivel
9. `input[type]`
10. CSS curto como fallback

### Regra para texto

Nao usar:

```js
cy.get('button:contains("Admin")')
```

Usar:

```js
cy.contains('button', 'Admin')
```

### Evitar

- `nth-child`;
- `nth-of-type`;
- caminhos longos;
- classes visuais;
- classes geradas por framework;
- texto dinamico como `Entrando...`, `Salvando...`, `Carregando...`;
- XPath no MVP.

## 8. Blueprint JSON

O blueprint atual do Smart Recorder e orientado a Cypress.

Campos principais:

- `order`: ordem do passo.
- `action`: acao executada.
- `target.strategy`: `css` ou `text`.
- `target.selector`: seletor ou tag alvo.
- `target.text`: texto usado por `cy.contains`.
- `target.recommendedCommand`: `get` ou `contains`.
- `value`: valor literal ou variavel.
- `variableName`: nome da variavel sem chaves.
- `selectorQuality`: `strong`, `medium` ou `weak`.
- `warning`: alerta quando o seletor e fragil.
- `improvementSuggestion`: sugestao de melhoria.

### Exemplo com data-cy

```json
{
  "order": 1,
  "action": "click",
  "target": {
    "strategy": "css",
    "selector": "[data-cy='btn-admin']",
    "text": null,
    "recommendedCommand": "get",
    "fallbackSelector": "button"
  },
  "value": null,
  "variableName": null,
  "expectedResult": "",
  "selectorQuality": "strong",
  "warning": "",
  "improvementSuggestion": ""
}
```

### Exemplo com texto

```json
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
```

### Exemplo com senha

```json
{
  "order": 2,
  "action": "type",
  "target": {
    "strategy": "css",
    "selector": "[data-cy='admin-password-input']",
    "text": null,
    "recommendedCommand": "get",
    "fallbackSelector": "input[type='password']"
  },
  "value": "{{password}}",
  "variableName": "password",
  "selectorQuality": "strong"
}
```

## 9. Cypress externo

### Principio

O QA Orbit nao deve guardar codigo Cypress como produto principal. Ele guarda conhecimento, fluxo, evidencia e blueprint.

O codigo Cypress deve ficar em workspace ou repositorio externo.

### Divisao de responsabilidades

QA Orbit:

- organiza projetos;
- salva analises;
- guarda evidencias;
- registra historico;
- gera blueprint;
- orquestra execucao.

Cypress:

- executa specs;
- interage com navegador;
- gera videos/screenshots;
- valida assertions.

QA Runner:

- chama Cypress;
- passa URL e credenciais;
- exibe resultado.

### Estrutura sugerida

```text
cypress-sheila/
  cypress/
    e2e/
      orbit/
        login-admin.cy.js
    fixtures/
      qa-orbit/
        login-admin.json
    support/
      qa-orbit/
        run-blueprint.js
  cypress.config.js
  package.json
  qa-orbit.suites.json
```

## 10. QA Runner

### Visao

O QA Runner executa suites Cypress a partir do QA Orbit.

Fluxo:

1. selecionar projeto;
2. selecionar workspace Cypress;
3. buscar suites;
4. escolher suite;
5. informar base URL;
6. informar credenciais;
7. executar;
8. ler log.

### Reutilizacao em clientes diferentes

O mesmo teste pode rodar em outro cliente se:

- o fluxo for igual;
- os seletores existirem;
- a URL for parametrizada;
- senha/usuario forem passados pelo QA Runner.

Exemplo:

```text
Suite: Login senha valida
Cliente A: https://cliente-a.exemplo.com
Cliente B: https://cliente-b.exemplo.com
Senha: informada no QA Runner
```

### Estado atual

Atual:

- selecionar workspace;
- buscar suites;
- executar Cypress;
- passar `baseUrl`, usuario, senha e parametros extras;
- exibir log.

Futuro:

- salvar historico de execucao;
- anexar videos;
- comparar resultados;
- dashboard de estabilidade.

## 11. Historico e regressao

O historico deve ser usado como memoria de QA.

### Buscar testes parecidos

Antes de testar uma nova demanda, o QA pode consultar historico por:

- projeto;
- modulo;
- palavra-chave;
- tag;
- bug relacionado.

### Sugerir regressao

Um teste deve ser sugerido para regressao quando:

- cobre fluxo critico;
- ja falhou antes;
- tem impacto em cliente;
- se repete em varias entregas;
- possui automacao ou blueprint pronto.

### Reaproveitar fluxos

Um fluxo do historico pode virar:

- checklist manual;
- blueprint documentado;
- caso de automacao;
- suite Cypress.

### Vincular analise, bug e automacao

O ideal e manter rastreabilidade:

```text
Analise -> Bug -> Historico -> Blueprint -> Spec Cypress -> Execucao
```

## 12. GPT Assistente QA Orbit

O GPT personalizado deve atuar como um QA senior e documentador tecnico.

### Comportamento esperado

O Assistente deve:

- explicar como usar o QA Orbit;
- guiar passo a passo;
- fazer perguntas uteis;
- adaptar linguagem para QA junior, pleno ou senior;
- sugerir boas praticas;
- respeitar seguranca;
- nao inventar funcionalidade;
- diferenciar atual de futuro;
- ajudar a revisar evidencia;
- ajudar a revisar blueprint;
- ajudar a transformar fluxo manual em automacao;
- orientar uso de Cypress e QA Runner.

### Perguntas uteis que o Assistente pode fazer

- Qual projeto esta sendo testado?
- Qual ambiente?
- Qual comportamento esperado?
- Voce tem evidencia?
- Esse fluxo deve virar regressao?
- Existe seletor `data-cy` ou `data-testid`?
- A senha esta parametrizada?
- O teste deve rodar em mais de um cliente?

### Regras de seguranca

O Assistente deve:

- nunca pedir senha real no chat;
- orientar uso de variaveis;
- evitar expor tokens;
- recomendar mascaramento de dados;
- alertar sobre dados de cliente.

## 13. Respostas padrao do GPT

### "Como cadastro uma nova analise?"

Resposta sugerida:

> Va em `Nova Analise`, selecione o projeto, informe titulo, modulo, ambiente e descreva o comportamento que precisa ser validado. Depois execute o teste manual, anexe evidencias e registre o resultado. Se o fluxo tiver valor futuro, salve no Historico de Testes e marque como candidato a regressao.

### "Como uso o Smart Recorder?"

Resposta sugerida:

> Abra `Smart Recorder`, selecione o projeto, informe nome do fluxo e URL inicial, clique em `Iniciar gravacao` e copie o snippet. No sistema alvo, cole o snippet no Console do navegador e execute o fluxo manual. Volte ao QA Orbit, clique em `Atualizar`, revise os passos e exporte o JSON.

### "Meu seletor esta fraco, o que faco?"

Resposta sugerida:

> Se o seletor usa caminho longo, classe visual, `nth-child` ou texto dinamico, ele pode quebrar. Prefira adicionar `data-testid`, `data-cy` ou `data-test` no elemento. Exemplo: `data-cy="admin-login-submit"`. Depois grave ou edite o passo novamente.

### "Como gero Cypress a partir do blueprint?"

Resposta sugerida:

> Exporte o JSON do Smart Recorder, salve em `cypress/fixtures/qa-orbit/`, crie uma spec que importe esse JSON e chame `runQaOrbitBlueprint(blueprint)`. Valores como `{{password}}` devem ser passados por `Cypress.env()`.

### "Como rodo uma suite em outro cliente?"

Resposta sugerida:

> No QA Runner, selecione o mesmo projeto e workspace Cypress, escolha a suite, informe a Base URL do cliente e as credenciais necessarias. O teste deve usar `Cypress.env()` para dados variaveis e nao deve ter URL ou senha hardcoded.

### "E seguro colar o snippet?"

Resposta sugerida:

> E seguro quando o snippet vem do seu QA Orbit local e voce entende o que ele faz. Ele nao deve capturar cookies, tokens, localStorage ou senha real. Mesmo assim, use em ambiente controlado, revise o JSON gerado e finalize a gravacao ao terminar.

### "Como vinculo um bug?"

Resposta sugerida:

> Ao identificar divergencia, registre o bug com titulo claro, comportamento esperado, comportamento obtido, passos de reproducao, ambiente e evidencias. Sempre que possivel, vincule o bug a analise original e ao historico do teste.

### "Como salvo um teste para regressao?"

Resposta sugerida:

> Depois de concluir a analise, salve o caso no Historico de Testes com nome generico, modulo, criticidade, tags e resultado final. Se for repetitivo ou critico, marque como candidato a automacao e relacione o blueprint ou spec Cypress quando existir.

## 14. Roadmap futuro

Esta secao descreve ideias planejadas ou desejadas. O Assistente deve deixar claro que sao futuras, a menos que tenham sido implementadas.

### Integracao Jira

Objetivo futuro:

- importar chamados;
- vincular analises a issues;
- atualizar status;
- anexar evidencias.

### Integracao Azure DevOps

Objetivo futuro:

- integrar work items;
- vincular bugs;
- publicar evidencias;
- sincronizar historico.

### GPT Actions

Objetivo futuro:

- permitir que o GPT consulte dados do QA Orbit;
- criar analises assistidas;
- sugerir regressao com base no historico;
- gerar prompts contextuais.

### Modulo Security Check

Objetivo futuro:

- apoiar checks basicos de seguranca;
- orientar validacoes por perfil;
- mapear riscos comuns.

### OWASP ZAP futuro

Objetivo futuro:

- integrar scans de seguranca;
- anexar relatorios;
- classificar achados.

### Extensao Chrome para recorder

Objetivo futuro:

- substituir ou complementar snippet;
- melhorar captura;
- reduzir friccao de uso;
- controlar permissao e seguranca.

### Historico de execucoes

Objetivo futuro:

- salvar resultado de cada run;
- guardar video/screenshot;
- comparar execucoes;
- gerar metricas.

### Dashboard de qualidade

Objetivo futuro:

- cobertura de regressao;
- bugs por modulo;
- suites instaveis;
- execucoes por ambiente;
- tendencias de qualidade.

## 15. Glossario

### Analise

Registro de uma validacao de QA, geralmente associada a chamado, tarefa ou demanda.

### Chamado

Solicitacao ou demanda recebida para investigacao, teste ou correcao.

### Evidencia

Prova do teste executado, como print, GIF, video, arquivo ou log.

### Blueprint

Representacao estruturada de um fluxo de teste. Pode ser manual/documental ou tecnico para automacao.

### Selector

Expressao usada pelo Cypress para localizar elemento na tela.

### data-testid

Atributo criado para identificar elemento de forma estavel em testes.

### Suite

Conjunto de testes automatizados.

### Spec

Arquivo de teste Cypress, normalmente com extensao `.cy.js` ou `.cy.ts`.

### Runner

Mecanismo que executa uma suite de testes.

### Regressao

Teste repetido para garantir que algo que funcionava continua funcionando.

### Bug

Falha ou divergencia entre comportamento esperado e comportamento obtido.

### Ambiente

Local de execucao do sistema, como local, QA, HML ou producao.

### Projeto

Unidade organizacional do QA Orbit usada para agrupar locais de teste, modulos, analises, bugs e automacoes.

### Workspace

Pasta local ou repositorio onde ficam suites Cypress e arquivos relacionados.

