# 🌸 Arquitetura  Jungle Gaming Backend Challenge

## 1. Sobre o projeto

Este projeto foi desenvolvido para o desafio técnico da Jungle Gaming, utilizando NestJS, TypeScript, PostgreSQL e TypeORM.

O objetivo é processar transações financeiras, manter os dados consistentes e permitir o envio de eventos de forma assíncrona utilizando o Amazon SQS, com o apoio do padrão Transactional Outbox.

## 2. Como os dados são salvos

O PostgreSQL armazena as carteiras, os saldos e as transações financeiras.

Quando uma operação financeira acontece, as alterações relacionadas precisam ser salvas juntas. Se alguma etapa falhar, a transação deve ser desfeita para evitar que os dados fiquem inconsistentes.

## 3. Idempotência

Em um sistema financeiro, uma mesma requisição pode ser enviada mais de uma vez, por exemplo, quando ocorre uma falha de comunicação ou uma nova tentativa após um timeout.

Se a aplicação processar a mesma aposta várias vezes, pode acabar registrando movimentações duplicadas.

Para tratar esse cenário, o endpoint `POST /wagering/transactions` exige o cabeçalho `Idempotency-Key`, que identifica a requisição.

O controller também calcula um hash do conteúdo da transação a partir de uma representação canônica dos dados de negócio. Dessa forma, é possível comparar o conteúdo de requisições que utilizam a mesma chave.

A intenção é permitir que a aplicação reconheça requisições repetidas e identifique quando uma mesma chave é utilizada com dados diferentes.

**Limitação:** a exigência da chave e o cálculo do hash são apenas parte da solução. A proteção completa depende de como a chave é armazenada, de como as requisições repetidas são identificadas e de como o banco de dados impede o processamento duplicado.

## 4. Controle de concorrência

Duas operações podem tentar modificar a mesma carteira ao mesmo tempo. Por exemplo, duas apostas podem tentar descontar valores do mesmo saldo.

Sem o controle adequado, uma atualização pode sobrescrever outra ou permitir um resultado financeiro incorreto.

Por isso, as operações que alteram o saldo precisam ser protegidas no banco de dados, garantindo que as regras financeiras sejam respeitadas mesmo quando existem requisições simultâneas.

### Estratégias consideradas

- **Pessimistic locking:** bloqueia temporariamente a carteira enquanto uma operação a modifica. Isso reduz conflitos, mas pode fazer outras operações esperarem.
- **Optimistic locking:** utiliza uma versão da carteira para identificar se ela foi alterada desde a última leitura.
- **Atualização condicional:** permite atualizar o saldo somente quando determinadas condições são atendidas diretamente no banco de dados.

O controle de versão com optimistic locking é uma alternativa considerada para o projeto. Para utilizá-lo, a verificação da versão e a atualização precisam acontecer de forma atômica no banco.

## 5. Transactional Outbox e SQS

Além de salvar uma transação financeira, a aplicação pode precisar enviar um evento para uma fila SQS.

Como salvar dados no banco e enviar uma mensagem para uma fila são operações diferentes, uma delas pode funcionar enquanto a outra falha.

Para reduzir esse risco, o projeto utiliza o padrão Transactional Outbox.

A proposta é salvar a movimentação financeira e o evento correspondente na mesma transação PostgreSQL. Depois, um processo separado poderia busca os eventos pendentes e tenta enviá-los para o SQS, porém devido a falta de tempo não foi implementada essa solução.

Assim, se o envio falhar, o evento permanece registrado no banco e pode ser processado novamente.

## 6. Autenticação do jogador

A autenticação não será implementada nesta versão do desafio.

Em uma aplicação real, seria necessário confirmar a identidade do jogador antes de permitir operações financeiras.

Como possibilidade de evolução, o projeto poderá utilizar uma interface chamada `ProvedorIdentidade`, que permitirá separar a identificação do jogador do restante das regras de negócio.

**Limitação atual:** o projeto não deve ser considerado protegido por autenticação. Receber um identificador de jogador em uma requisição não comprova sua identidade. Antes de disponibilizar a aplicação em produção, seria necessário implementar autenticação e autorização adequadas.

## 7. Estado da implementação da API

Devido ao tempo disponível, priorizei a criação de carteiras e o recebimento de transações financeiras.

A tabela abaixo apresenta o estado dos endpoints com base nos controllers analisados até o momento.

| Método | Endpoint | Objetivo | Status |
|---|---|---|---|
| `POST` | `/wallets` | Criar uma carteira | Implementado |
| `GET` | `/wallets/:id` | Consultar uma carteira pelo ID | Implementado |
| `POST` | `/wagering/transactions` | Receber e processar uma transação financeira | Implementado |
| `GET` | `/wallets/:walletId/ledger` | Consultar o histórico de movimentações da carteira | Pendente |
| `POST` | `/wallets/:walletId/reconciliation` | Comparar o saldo com o histórico de movimentações | Pendente |
| `GET` | `/wagering/transactions/:transactionId` | Consultar uma transação pelo ID interno | Pendente |
| `GET` | `/providers/:providerId/wagering/transactions/:externalTransactionId` | Consultar uma transação pelo identificador externo do provedor | Pendente |
| `GET` | `/health/live` | Verificar se a aplicação está em execução | Implementado |
| `GET` | `/health/ready` | Verificar se a aplicação está pronta para receber requisições | Pendente |

Os status representam os controllers analisados e devem ser conferidos com o restante do projeto antes da entrega.

### Funcionalidades implementadas no recebimento de transações

No endpoint `POST /wagering/transactions`, o controller realiza as seguintes operações:

- Exige o cabeçalho `Idempotency-Key`.
- Calcula um hash dos dados de negócio da transação.
- Encaminha os dados e a chave para o serviço responsável pelo processamento.
- Mantém a separação entre o controller e o serviço de aplicação.

Esses pontos representam o que foi observado no controller. A garantia completa de idempotência depende também da implementação do serviço e das restrições no banco de dados.

## 8. Próximas melhorias

Os próximos passos para evoluir o projeto são:

- Completar os endpoints de consulta e reconciliação financeira.
- Melhorar os endpoints de saúde da aplicação (faltou o health/ready).
- Validar a idempotência em cenários de repetição e concorrência.
- Implementar e testar o controle de concorrência no saldo das carteiras.
- Garantir o envio e o tratamento de mensagens para o SQS.
- Implementar autenticação e autorização dos jogadores.


## 9. Como eu faria o envio das notficações para a FILA

Para realizar o envio de eventos para a fila SQS de forma segura, a proposta é utilizar o padrão **Transactional Outbox**.

A ideia é registrar o evento no banco de dados junto com a movimentação financeira, dentro da mesma transação. Dessa forma, se a operação for concluída, o evento também será salvo. Se ocorrer uma falha na transação, ambos serão revertidos.

O envio para o SQS será realizado por um processo separado, responsável por buscar os eventos pendentes na tabela `outbox` e enviá-los para a fila `outbox-queue`.

O fluxo proposto é:

1. A API processa a movimentação financeira e salva o evento na Outbox.
2. Um worker consulta periodicamente os eventos pendentes.
3. O worker envia cada evento para a fila SQS.
4. Após confirmar o envio, o evento é marcado como enviado no banco de dados.
5. Se ocorrer uma falha, o evento permanece disponível para uma nova tentativa.

**Benefícios dessa abordagem:**

- Mantém o registro financeiro e o evento consistentes no banco de dados.
- Reduz o risco de perder notificações quando o SQS estiver indisponível.
- Permite tentar novamente o envio de eventos que falharam.

**Ponto de atenção:** o envio e a atualização do banco não acontecem na mesma transação. Por isso, uma mensagem pode ser enviada mais de uma vez. É necessário tratar duplicidades e garantir que o consumidor processe cada evento de forma idempotente.

A implementação do worker responsável pelo envio e pela atualização dos eventos deve ser concluída para que esse fluxo funcione de ponta a ponta.

![Fluxo do padrão Transactional Outbox](./docs/image/Fluxo%20de%20Transações%20e%20Mensageria%20Assíncrona.png)


### Observações pessoais

Foi um desafio extenso, com bastante conteúdo e muita lógica para pensar. Infelizmente, não consegui implementar tudo da forma como gostaria dentro do tempo disponível. Por isso, reconheço que alguns pontos, como a estrutura e a organização da arquitetura do projeto, poderiam ter ficado beeem melhores, meu services estão com muitas funções em desacordo os princípios de Clean Code e Clean Architecture que procuro seguir, mas foi pelo tempo mesmo, costumor ser muito organizada.

Durante o desenvolvimento, priorizei aspectos que considerei fundamentais para esse tipo de sistema, como a correção das movimentações financeiras, o controle de concorrência, a idempotência, os testes e a documentação.

Foi um projeto no qual pude aplicar e aprofundar muitas das minhas habilidades, e procurei desenvolver cada etapa com bastante atenção e responsabilidade.

Agradeço pela oportunidade! sigo animada e ansiosa para a entrevista de apresentação do projeto. 😊