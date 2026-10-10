# Jungle Gaming — Backend Challenge

Implementação do desafio técnico de backend da Jungle Gaming, utilizando NestJS, TypeScript e PostgreSQL, com foco em processamento de transações financeiras, consistência de dados e mensageria assíncrona por meio do padrão Transactional Outbox.

## Tecnologias

- Node.js
- TypeScript
- NestJS
- PostgreSQL
- TypeORM
- Docker e Docker Compose
- LocalStack
- Amazon SQS API
- AWS SDK for JavaScript v3

## Pré-requisitos

Antes de iniciar, instale:

- Node.js  versão : v22.17.0.
- npm versão 11.6.2.
- Docker version 29.8.2
- Uma conta e um token do LocalStack.

Verifique as instalações:

```bash
node --version
npm --version
docker --version
docker compose version
```

## Configuração do ambiente

Clone o repositório e entre na pasta do projeto:

```bash
git clone <URL_DO_REPOSITORIO>
cd backend-challenge
```

Crie o arquivo `.env` a partir do modelo disponibilizado:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Confira as variáveis no `.env` e ajuste os valores conforme necessário.

O arquivo `.env.example` contém as configurações necessárias para o ambiente local. Não versione o arquivo `.env`, pois ele pode conter credenciais e tokens.

## Banco de dados

O PostgreSQL é executado em um container Docker.

Credenciais padrão do ambiente local:

| Configuração | Valor |
|---|---|
| Host | `localhost` |
| Porta | `5432` |
| Banco | `jungle` |
| Usuário | `jungle` |
| Senha | `jungle` |

Essas credenciais são destinadas exclusivamente ao desenvolvimento local.

## Inicialização da infraestrutura

Na raiz do projeto, execute:

```bash
docker compose up -d
```

O Docker Compose inicia o PostgreSQL e o LocalStack.

Verifique o estado dos containers:

```bash
docker compose ps
```

Para consultar os logs:

```bash
docker compose logs -f
```

Para consultar apenas os logs do LocalStack:

```bash
docker compose logs -f localstack
```

## Configuração do SQS

O LocalStack disponibiliza localmente a API SQS para desenvolvimento e testes.

A fila utilizada pela aplicação é `outbox-queue`.

Após iniciar o LocalStack, verifique se a fila foi criada:

```bash
docker compose exec localstack awslocal sqs list-queues
```

Se a fila não existir e ainda não tiver sido criada automaticamente pela configuração de inicialização, crie-a com:

```bash
docker compose exec localstack awslocal sqs create-queue \
  --queue-name outbox-queue
```

O endpoint local do SQS é:

```text
http://localhost:4566
```

A região utilizada no ambiente local é `us-east-1`.

## Instalação e execução da aplicação

Instale as dependências:

```bash
npm install
```

Execute as migrations necessárias, caso não sejam aplicadas automaticamente pela aplicação:

```bash
npm run migration:run
```

Inicie a aplicação em modo de desenvolvimento:

```bash
npm run start:dev
```

**Observação:** os comandos de migrations devem corresponder aos scripts realmente definidos no `package.json`. Consulte os scripts disponíveis antes de executar.

## Testes

Execute os testes unitários:

```bash
npm run test
```

Execute os testes end-to-end, se configurados:

```bash
npm run test:e2e
```

Para verificar a infraestrutura SQS, envie uma mensagem de teste pela AWS CLI disponibilizada no container do LocalStack ou utilize os endpoints e fluxos implementados pela aplicação.

## Arquitetura e decisões técnicas

### Transactional Outbox

O padrão Transactional Outbox é utilizado para persistir mensagens relacionadas às operações de negócio no banco de dados, permitindo que a publicação assíncrona seja realizada posteriormente.

A tabela Outbox mantém os registros que serão processados pelo publicador.

### Mensageria

O LocalStack fornece um ambiente local para testar a integração com a API SQS sem precisar utilizar uma fila hospedada na AWS.

### Consistência e confiabilidade

A implementação busca preservar a consistência das operações financeiras, considerando tratamento de falhas, idempotência e processamento das mensagens conforme as regras implementadas no projeto.

## Encerrando o ambiente

Para parar os containers:

```bash
docker compose down
```

Para remover também os volumes persistentes do PostgreSQL e do LocalStack:

```bash
docker compose down -v
```

**Atenção:** o segundo comando apaga os dados armazenados nesses volumes. Utilize-o somente quando quiser reiniciar o ambiente do zero.
