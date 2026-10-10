/** @format */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { WageringService } from "./wagering.service";
import {
  WagerTransactionKind,
  WagerTransactionStatus,
} from "../infraestrutura/wager-transaction.entity";

describe("WageringService", () => {
  let service: WageringService;
  let fakeWallets: Map<string, any>;
  let fakeTransactions: Map<string, any>;
  let fakeLedger: any[];
  let fakeOutbox: any[];

  beforeEach(() => {
    fakeWallets = new Map();
    fakeTransactions = new Map();
    fakeLedger = [];
    fakeOutbox = [];

    const mockManager = {
      getRepository: (entity: any) => {
        if (entity.name === "WalletEntity") {
          return {
            findOne: async (options: any) => {
              for (const w of fakeWallets.values()) {
                if (options.where.id && w.id !== options.where.id) continue;
                if (
                  options.where.playerId &&
                  w.playerId !== options.where.playerId
                )
                  continue;
                return { ...w };
              }
              return null;
            },
            save: async (entity: any) => {
              fakeWallets.set(entity.id, { ...entity });
              return entity;
            },
          };
        }

        if (entity.name === "WagerTransactionEntity") {
          return {
            findOne: async (options: any) => {
              for (const t of fakeTransactions.values()) {
                if (options.where.id && t.id !== options.where.id) continue;
                if (
                  options.where.providerId &&
                  t.providerId !== options.where.providerId
                )
                  continue;
                if (
                  options.where.idempotencyKey &&
                  t.idempotencyKey !== options.where.idempotencyKey
                )
                  continue;
                if (
                  options.where.externalTransactionId &&
                  t.externalTransactionId !==
                    options.where.externalTransactionId
                )
                  continue;
                if (
                  options.where.referenceTransactionId &&
                  t.referenceTransactionId !==
                    options.where.referenceTransactionId
                )
                  continue;
                if (options.where.kind && t.kind !== options.where.kind)
                  continue;
                if (options.where.status && t.status !== options.where.status)
                  continue;
                return { ...t };
              }
              return null;
            },
            create: (dto: any) => ({
              ...dto,
              id: dto.id ?? crypto.randomUUID(),
            }),
            save: async (t: any) => {
              fakeTransactions.set(t.id, { ...t });
              return t;
            },
          };
        }

        if (entity.name === "LedgerEntity") {
          return {
            create: (dto: any) => ({ ...dto, id: crypto.randomUUID() }),
            save: async (entry: any) => {
              fakeLedger.push(entry);
              return entry;
            },
          };
        }

        if (entity.name === "OutboxEntity") {
          return {
            create: (dto: any) => ({
              ...dto,
              id: dto.id ?? crypto.randomUUID(),
            }),
            save: async (event: any) => {
              fakeOutbox.push({ ...event });
              return event;
            },
          };
        }

        throw new Error(`Repository não mockado para ${entity.name}`);
      },
    };

    const mockDataSource = {
      transaction: async (cb: any) => cb(mockManager),
    };

    service = new WageringService(mockDataSource as any);
  });

  const walletId = "0192f291-27dd-7d3f-8071-5f8685deef37";
  const playerId = "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1";

  function setupWallet(balance = "100.00", currency = "BRL") {
    fakeWallets.set(walletId, {
      id: walletId,
      playerId,
      currency,
      balance,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it("deve processar uma aposta (BET) com saldo suficiente", async () => {
    setupWallet("100.00");

    const response = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "tx-1",
      idempotencyKey: "provider-a:tx-1",
      payloadHash: "hash1",
      walletId,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.BET,
      money: { amount: "30.00", currency: "BRL" },
    });

    expect(response.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(response.balance.amount).toBe("70.00");
    expect(response.idempotentReplay).toBe(false);

    expect(fakeWallets.get(walletId).balance).toBe("70.00");
    expect(fakeWallets.get(walletId).version).toBe(2);
    expect(fakeLedger.length).toBe(1);
    expect(fakeLedger[0].direction).toBe("DEBIT");
    expect(fakeLedger[0].amount).toBe("30.00");
  });

  it("deve rejeitar uma aposta (BET) por saldo insuficiente sem mover saldo nem criar ledger", async () => {
    setupWallet("20.00");

    const response = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "tx-2",
      idempotencyKey: "provider-a:tx-2",
      payloadHash: "hash2",
      walletId,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.BET,
      money: { amount: "50.00", currency: "BRL" },
    });

    expect(response.status).toBe(WagerTransactionStatus.REJECTED);
    expect(response.failureCode).toBe("INSUFFICIENT_BALANCE");
    expect(response.balance.amount).toBe("20.00");

    expect(fakeWallets.get(walletId).balance).toBe("20.00");
    expect(fakeWallets.get(walletId).version).toBe(1);
    expect(fakeLedger.length).toBe(0);
  });

  it("deve retornar idempotentReplay: true quando a mesma requisição for enviada novamente", async () => {
    setupWallet("100.00");

    const payload = {
      providerId: "provider-a",
      externalTransactionId: "tx-idem",
      idempotencyKey: "provider-a:tx-idem",
      payloadHash: "hash-idem",
      walletId,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.BET,
      money: { amount: "25.00", currency: "BRL" },
    };

    const first = await service.processarTransacao(payload);
    expect(first.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(first.idempotentReplay).toBe(false);

    const second = await service.processarTransacao(payload);
    expect(second.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(second.idempotentReplay).toBe(true);
    expect(second.balance.amount).toBe("75.00");
    expect(fakeLedger.length).toBe(1); // Não duplicou o débito
  });

  it("deve falhar com conflito se a mesma chave de idempotência for usada com payload diferente", async () => {
    setupWallet("100.00");

    await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "tx-conflict",
      idempotencyKey: "provider-a:tx-conflict",
      payloadHash: "hash-original",
      walletId,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.BET,
      money: { amount: "10.00", currency: "BRL" },
    });

    expect(
      service.processarTransacao({
        providerId: "provider-a",
        externalTransactionId: "tx-conflict",
        idempotencyKey: "provider-a:tx-conflict",
        payloadHash: "hash-divergente",
        walletId,
        playerId,
        roundId: "round-1",
        gameId: "game-1",
        kind: WagerTransactionKind.BET,
        money: { amount: "90.00", currency: "BRL" },
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("deve processar WIN creditando a carteira e gerando ledger CREDIT", async () => {
    setupWallet("50.00");

    const response = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "tx-win",
      idempotencyKey: "provider-a:tx-win",
      payloadHash: "hash-win",
      walletId,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.WIN,
      money: { amount: "150.00", currency: "BRL" },
    });

    expect(response.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(response.balance.amount).toBe("200.00");
    expect(fakeLedger.length).toBe(1);
    expect(fakeLedger[0].direction).toBe("CREDIT");
  });

  it("deve processar LOSS sem mover saldo e sem gerar ledger", async () => {
    setupWallet("50.00");

    const response = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "tx-loss",
      idempotencyKey: "provider-a:tx-loss",
      payloadHash: "hash-loss",
      walletId,
      playerId,
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.LOSS,
      money: { amount: "10.00", currency: "BRL" },
    });

    expect(response.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(response.balance.amount).toBe("50.00");
    expect(fakeWallets.get(walletId).balance).toBe("50.00");
    expect(fakeWallets.get(walletId).version).toBe(1);
    expect(fakeLedger.length).toBe(0);
  });

  it("deve processar REFUND revertendo uma aposta (BET)", async () => {
    setupWallet("100.00");

    // 1. BET inicial
    await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "bet-to-refund",
      idempotencyKey: "provider-a:bet-to-refund",
      payloadHash: "h-bet",
      walletId,
      playerId,
      roundId: "round-refund",
      gameId: "game-1",
      kind: WagerTransactionKind.BET,
      money: { amount: "40.00", currency: "BRL" },
    });

    expect(fakeWallets.get(walletId).balance).toBe("60.00");

    // 2. REFUND da BET
    const refundRes = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "refund-tx",
      idempotencyKey: "provider-a:refund-tx",
      payloadHash: "h-refund",
      walletId,
      playerId,
      roundId: "round-refund",
      gameId: "game-1",
      kind: WagerTransactionKind.REFUND,
      money: { amount: "40.00", currency: "BRL" },
      referenceExternalTransactionId: "bet-to-refund",
    });

    expect(refundRes.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(refundRes.balance.amount).toBe("100.00");
    expect(fakeWallets.get(walletId).balance).toBe("100.00");
    expect(fakeLedger.length).toBe(2);
    expect(fakeLedger[1].direction).toBe("CREDIT");
  });

  it("deve rejeitar segundo REFUND na mesma aposta com REFERENCE_ALREADY_REVERTED", async () => {
    setupWallet("100.00");

    await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "bet-once",
      idempotencyKey: "provider-a:bet-once",
      payloadHash: "h1",
      walletId,
      playerId,
      roundId: "round-once",
      gameId: "game-1",
      kind: WagerTransactionKind.BET,
      money: { amount: "20.00", currency: "BRL" },
    });

    await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "refund-1",
      idempotencyKey: "provider-a:refund-1",
      payloadHash: "h-ref-1",
      walletId,
      playerId,
      roundId: "round-once",
      gameId: "game-1",
      kind: WagerTransactionKind.REFUND,
      money: { amount: "20.00", currency: "BRL" },
      referenceExternalTransactionId: "bet-once",
    });

    // Tentativa de segundo refund com outra chave
    const secondRefund = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "refund-2",
      idempotencyKey: "provider-a:refund-2",
      payloadHash: "h-ref-2",
      walletId,
      playerId,
      roundId: "round-once",
      gameId: "game-1",
      kind: WagerTransactionKind.REFUND,
      money: { amount: "20.00", currency: "BRL" },
      referenceExternalTransactionId: "bet-once",
    });

    expect(secondRefund.status).toBe(WagerTransactionStatus.REJECTED);
    expect(secondRefund.failureCode).toBe("REFERENCE_ALREADY_REVERTED");
  });

  it("deve marcar como PENDING_REFERENCE se a referência ainda não existe", async () => {
    setupWallet("100.00");

    const res = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "refund-orphan",
      idempotencyKey: "provider-a:refund-orphan",
      payloadHash: "h-orphan",
      walletId,
      playerId,
      roundId: "round-orphan",
      gameId: "game-1",
      kind: WagerTransactionKind.REFUND,
      money: { amount: "30.00", currency: "BRL" },
      referenceExternalTransactionId: "bet-does-not-exist-yet",
    });

    expect(res.status).toBe(WagerTransactionStatus.PENDING_REFERENCE);
    expect(fakeWallets.get(walletId).balance).toBe("100.00"); // Saldo inalterado
    expect(fakeLedger.length).toBe(0);
  });

  it("deve rejeitar ROLLBACK com ROLLBACK_NEGATIVE_BALANCE se causar saldo negativo", async () => {
    setupWallet("10.00"); // Jogador tem 10 reais

    // Teve um WIN de 50 reais anteriormente que foi gasto
    const winTxId = "win-external";
    fakeTransactions.set(winTxId, {
      id: crypto.randomUUID(),
      providerId: "provider-a",
      externalTransactionId: winTxId,
      idempotencyKey: "key-win",
      payloadHash: "hash-win",
      walletId,
      playerId,
      roundId: "round-rb",
      gameId: "game-1",
      kind: WagerTransactionKind.WIN,
      amount: "50.00",
      currency: "BRL",
      status: WagerTransactionStatus.PROCESSED,
      referenceExternalTransactionId: null,
      referenceTransactionId: null,
      failureCode: null,
      processedAt: new Date(),
    });

    // Rollback de WIN tenta debitar 50 reais, mas o jogador só tem 10
    const rbRes = await service.processarTransacao({
      providerId: "provider-a",
      externalTransactionId: "rb-win",
      idempotencyKey: "provider-a:rb-win",
      payloadHash: "h-rb",
      walletId,
      playerId,
      roundId: "round-rb",
      gameId: "game-1",
      kind: WagerTransactionKind.ROLLBACK,
      money: { amount: "50.00", currency: "BRL" },
      referenceExternalTransactionId: winTxId,
    });

    expect(rbRes.status).toBe(WagerTransactionStatus.REJECTED);
    expect(rbRes.failureCode).toBe("ROLLBACK_NEGATIVE_BALANCE");
    expect(fakeWallets.get(walletId).balance).toBe("10.00");
  });

  it("deve rejeitar OPENING como operação inválida na API", async () => {
    setupWallet("100.00");

    expect(
      service.processarTransacao({
        providerId: "provider-a",
        externalTransactionId: "opening-api",
        idempotencyKey: "provider-a:opening-api",
        payloadHash: "h-op",
        walletId,
        playerId,
        roundId: "round-1",
        gameId: "game-1",
        kind: WagerTransactionKind.OPENING,
        money: { amount: "100.00", currency: "BRL" },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
