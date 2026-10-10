#!/bin/bash
set -e

echo "Criando fila SQS para a Outbox..."

awslocal sqs create-queue \
  --queue-name outbox-queue

echo "Fila outbox-queue criada com sucesso!"
