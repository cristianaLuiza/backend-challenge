# 🌸 Jungle Gaming Backend Challenge

Oii! Este é o meu projeto desenvolvido para o desafio técnico de Backend da **Jungle Gaming**.

A aplicação foi construída com **NestJS, TypeScript e PostgreSQL**, com foco no processamento de transações financeiras, na consistência dos dados e na comunicação assíncrona entre serviços.

Um dos pontos principais do projeto é o padrão **Transactional Outbox**, utilizado para ajudar a manter a consistência entre as operações realizadas no banco de dados e o envio de eventos para mensageria.

## 💗 Tecnologias utilizadas


- **Node.js e TypeScript** 
- **NestJS**
- **PostgreSQL e TypeORM** 
- **Docker e Docker Compose** 
- **LocalStack e Amazon SQS** 
- **Testcontainers** 

## 🌷 Pré-requisitos

Antes de começar, verifique se você tem:

- Node.js `v22.17.0`
- npm `11.6.2`
- Docker instalado e em execução
- Uma conta no LocalStack e um token de autenticação válido

Para conferir as versões instaladas:

```bash
node --version
npm --version
docker --version
docker compose version
```

## 🩷 Configurando o projeto

### 1. Clone o repositório

```bash
git clone https://github.com/cristianaLuiza/backend-challenge.git
cd backend-challenge
```

### 2. Configure as variáveis de ambiente

Crie o arquivo `.env` com base no modelo disponibilizado:

```bash
cp .env.example .env
```


Atenção: é necessário no .env ter a variavel de ambiente LOCALSTACK_AUTH_TOKEN={seu_token_aqui}, para subir os conteiners do docker.

O arquivo `.env.example` contém as configurações de referência para executar o projeto localmente.

### 3. Configure o token do LocalStack

A versão do LocalStack utilizada neste projeto exige autenticação por token.

Para configurar:

1. Crie uma conta em [LocalStack](https://app.localstack.cloud/).
2. Gere seu token de autenticação seguindo as instruções da plataforma.
3. Abra o arquivo `.env` e configure a variável:

```dotenv
LOCALSTACK_AUTH_TOKEN=seu_token_aqui
```

Substitua `seu_token_aqui` pelo token gerado na sua conta.

**Importante:** o arquivo `.env` contém configurações locais e não deve ser enviado ao GitHub. Utilize o `.env.example` como modelo, sem incluir seu token real.

## 🐘 Banco de dados

O PostgreSQL é executado em um container Docker.

As credenciais padrão do ambiente local são:

| Configuração | Valor |
|---|---|
| Host | `localhost` |
| Porta | `5432` |
| Banco de dados | `jungle` |
| Usuário | `jungle` |
| Senha | `jungle` |

Essas credenciais são destinadas exclusivamente ao desenvolvimento local.

## 🐳 Inicializando a infraestrutura

Com o Docker em execução, inicie os serviços na raiz do projeto:

```bash
docker compose up -d
```

Esse comando inicia os containers configurados no Docker Compose, incluindo o PostgreSQL e o LocalStack.

Para verificar se os serviços estão em execução:

```bash
docker compose ps
```

Para acompanhar os logs:

```bash
docker compose logs -f
```

Se precisar verificar especificamente o LocalStack:

```bash
docker compose logs -f localstack
```

## 💌 Configuração do SQS

O projeto utiliza o **Amazon SQS** para mensageria, com o LocalStack fornecendo um ambiente local para desenvolvimento e testes.

O endpoint local é:

```text
http://localhost:4566
```

A região configurada é `us-east-1`.

Para verificar as filas disponíveis:

```bash
docker compose exec localstack awslocal sqs list-queues
```

Se a configuração de inicialização estiver funcionando corretamente, a fila `outbox-queue` deverá aparecer na listagem.

## 🚀 Instalando e executando a aplicação

Instale as dependências:

```bash
npm install
```


Para iniciar o servidor em modo de desenvolvimento:

```bash
npm run start:dev
```

## 🧪 Testes

Para executar os testes unitários e integrados:

```bash
npm run test
```


## 🌙 Encerrando o ambiente

Quando terminar de trabalhar no projeto, você pode parar os containers com:

```bash
docker compose down
```

## 📚 Documentação

- [Arquitetura do projeto](./ARCHITECTURE.md) - explica as decisões técnicas, a organização da solução e os principais pontos da implementação.
---

Feito com 💗 por **Cristiana Luiza**.