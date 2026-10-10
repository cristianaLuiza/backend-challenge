/** @format */

import "reflect-metadata";
import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { DataSource } from "typeorm";
import { WalletEntity } from "../infraestrutura/wallet.entity";
import {
  WagerTransactionEntity,
  WagerTransactionKind,
  WagerTransactionStatus,
} from "../infraestrutura/wager-transaction.entity";
import { LedgerEntity, LedgerDirection } from "../infraestrutura/ledger.entity";
import { WageringService } from "./wagering.service";
import { WalletService } from "./wallet.service";
import { WalletRepository } from "../infraestrutura/wallet.repository";
import { computeCanonicalPayloadHash } from "../utils/canonical-json";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { OutboxEntity } from "src/infraestrutura/outbox.entity";

describe("WageringService Integration Tests (PostgreSQL Real)", () => {
  let postgresContainer: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
  let dataSource: DataSource;
  let wageringService: WageringService;
  let walletService: WalletService;

  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer("postgres:16")
      .withDatabase("jungle_test")
      .withUsername("test")
      .withPassword("test")
      .start();

    dataSource = new DataSource({
      type: "postgres",
      host: postgresContainer.getHost(),
      port: postgresContainer.getPort(),
      username: postgresContainer.getUsername(),
      password: postgresContainer.getPassword(),
      database: postgresContainer.getDatabase(),
      entities: [
        WalletEntity,
        WagerTransactionEntity,
        LedgerEntity,
        OutboxEntity,
      ],
      migrations: ["src/database/migrations/*.ts"],
      synchronize: false,
    });

    await dataSource.initialize();
    await dataSource.runMigrations();

    const walletRepo = new WalletRepository(
      dataSource.getRepository(WalletEntity),
    );

    walletService = new WalletService(walletRepo, dataSource);
    wageringService = new WageringService(dataSource);
  }, 120_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }

    if (postgresContainer) {
      await postgresContainer.stop();
    }
  }, 120_000);

  async function createWalletWithBalance(amount: string, currency = "BRL") {
    const playerId = crypto.randomUUID();
    const walletDto = await walletService.criar({
      playerId,
      initialBalance: {
        amount,
        currency,
      },
    });

    return {
      walletId: walletDto.id,
      playerId,
      currency,
    };
  }

  function buildWagerInput(params: {
    walletId: string;
    playerId: string;
    kind: WagerTransactionKind;
    amount: string;
    currency?: string;
    roundId?: string;
    referenceExternalTransactionId?: string;
  }) {
    const providerId = "provider-int-test";
    const externalTransactionId = `ext-${crypto.randomUUID()}`;
    const idempotencyKey = `idem-${crypto.randomUUID()}`;
    const currency = params.currency ?? "BRL";
    const roundId = params.roundId ?? `round-${crypto.randomUUID()}`;

    const payloadHash = computeCanonicalPayloadHash({
      amount: params.amount,
      currency,
      externalTransactionId,
      gameId: "game-int-test",
      kind: params.kind,
      playerId: params.playerId,
      providerId,
      referenceExternalTransactionId:
        params.referenceExternalTransactionId ?? null,
      roundId,
      walletId: params.walletId,
    });

    return {
      providerId,
      externalTransactionId,
      idempotencyKey,
      payloadHash,
      walletId: params.walletId,
      playerId: params.playerId,
      roundId,
      gameId: "game-int-test",
      kind: params.kind,
      money: {
        amount: params.amount,
        currency,
      },
      referenceExternalTransactionId: params.referenceExternalTransactionId,
    };
  }

  it("deve debitar aposta, persistir transação e gerar ledger auditável no PostgreSQL real", async () => {
    const { walletId, playerId } = await createWalletWithBalance("100.00");

    const betInput = buildWagerInput({
      walletId,
      playerId,
      kind: WagerTransactionKind.BET,
      amount: "35.00",
    });

    const response = await wageringService.processarTransacao(betInput);

    expect(response.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(response.balance.amount).toBe("65.00");
    expect(response.idempotentReplay).toBe(false);

    // Verificação direta no PostgreSQL
    const walletDb = await dataSource
      .getRepository(WalletEntity)
      .findOne({ where: { id: walletId } });
    expect(walletDb).not.toBeNull();
    expect(walletDb!.balance).toBe("65.00");
    expect(walletDb!.version).toBe(2);

    const txDb = await dataSource
      .getRepository(WagerTransactionEntity)
      .findOne({ where: { id: response.transactionId } });
    expect(txDb).not.toBeNull();
    expect(txDb!.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(txDb!.amount).toBe("35.00");

    const ledgerDb = await dataSource.getRepository(LedgerEntity).find({
      where: { walletId },
      order: { createdAt: "ASC" },
    });
    // 1 de OPENING (100.00) e 1 de BET DEBIT (35.00)
    expect(ledgerDb.length).toBe(2);
    expect(ledgerDb[1].direction).toBe(LedgerDirection.DEBIT);
    expect(ledgerDb[1].amount).toBe("35.00");
    expect(ledgerDb[1].balanceBefore).toBe("100.00");
    expect(ledgerDb[1].balanceAfter).toBe("65.00");
    expect(ledgerDb[1].transactionId).toBe(response.transactionId);

    // Verifica os eventos persistidos na Outbox
    const outboxDb = await dataSource.getRepository(OutboxEntity).find({
      where: {
        aggregateId: response.transactionId,
      },
    });

    expect(outboxDb).toHaveLength(1);
    const transactionEvent = outboxDb.find(
      (event) => event.eventType === "WagerTransactionProcessed",
    );

    expect(transactionEvent).toBeDefined();
    expect(transactionEvent!.payload).toMatchObject({
      transactionId: response.transactionId,
      providerId: betInput.providerId,
      externalTransactionId: betInput.externalTransactionId,
      walletId,
      playerId,
      kind: WagerTransactionKind.BET,
      status: WagerTransactionStatus.PROCESSED,
      amount: "35.00",
      currency: "BRL",
      balance: "65.00",
    });

    // O segundo evento usa o ID da carteira como aggregateId
    const balanceEvent = await dataSource.getRepository(OutboxEntity).findOne({
      where: {
        aggregateId: walletId,
        eventType: "WalletBalanceChanged",
      },
    });

    expect(balanceEvent).not.toBeNull();
    expect(balanceEvent!.payload).toMatchObject({
      walletId,
      playerId,
      currency: "BRL",
      balanceBefore: "100.00",
      balanceAfter: "65.00",
      transactionId: response.transactionId,
    });
  });

  describe("Testes de Corrida Real (Race Condition Concorrente)", () => {
    it("deve executar duas apostas concorrentes com saldo suficiente apenas para uma, provando que o lock pessimista impede saldo negativo no banco real", async () => {
      // Saldo de 50.00 BRL
      const { walletId, playerId } = await createWalletWithBalance("50.00");

      // Duas apostas de 40.00 BRL disputando o mesmo saldo de 50.00 BRL
      const bet1 = buildWagerInput({
        walletId,
        playerId,
        kind: WagerTransactionKind.BET,
        amount: "40.00",
      });

      const bet2 = buildWagerInput({
        walletId,
        playerId,
        kind: WagerTransactionKind.BET,
        amount: "40.00",
      });

      // Dispara simultaneamente no banco real via Promise.all
      const [res1, res2] = await Promise.all([
        wageringService.processarTransacao(bet1),
        wageringService.processarTransacao(bet2),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exatamente UMA deve ter sucesso (PROCESSED) e a OUTRA deve ser REJEITADA (REJECTED)
      expect(statuses).toEqual([
        WagerTransactionStatus.PROCESSED,
        WagerTransactionStatus.REJECTED,
      ]);

      const vencedora =
        res1.status === WagerTransactionStatus.PROCESSED ? res1 : res2;
      const perdedora =
        res1.status === WagerTransactionStatus.REJECTED ? res1 : res2;

      expect(vencedora.balance.amount).toBe("10.00");
      expect(perdedora.failureCode).toBe("INSUFFICIENT_BALANCE");

      // Validação no PostgreSQL real
      const walletDb = await dataSource
        .getRepository(WalletEntity)
        .findOne({ where: { id: walletId } });
      expect(walletDb!.balance).toBe("10.00");
      expect(Number(walletDb!.balance)).toBeGreaterThanOrEqual(0);
      expect(walletDb!.version).toBe(2); // 1 do opening + 1 do débito vencedor

      // Validação do Ledger no PostgreSQL real
      const ledgerEntries = await dataSource.getRepository(LedgerEntity).find({
        where: { walletId },
        order: { createdAt: "ASC" },
      });
      // Apenas 2 lançamentos no ledger: 1 OPENING e 1 DEBIT vencedor
      expect(ledgerEntries.length).toBe(2);
      expect(ledgerEntries[1].direction).toBe(LedgerDirection.DEBIT);
      expect(ledgerEntries[1].amount).toBe("40.00");
      expect(ledgerEntries[1].balanceBefore).toBe("50.00");
      expect(ledgerEntries[1].balanceAfter).toBe("10.00");

      // Validação da transação rejeitada no PostgreSQL
      const perdedoraTxDb = await dataSource
        .getRepository(WagerTransactionEntity)
        .findOne({
          where: { id: perdedora.transactionId },
        });
      expect(perdedoraTxDb!.status).toBe(WagerTransactionStatus.REJECTED);
      expect(perdedoraTxDb!.failureCode).toBe("INSUFFICIENT_BALANCE");
    });

    it("deve processar 10 apostas concorrentes disputando saldo limitado sem nunca permitir saldo negativo", async () => {
      // Carteira com 50.00 BRL
      const { walletId, playerId } = await createWalletWithBalance("50.00");

      // 10 apostas de 10.00 BRL simultâneas
      const apostas = Array.from({ length: 10 }, () =>
        buildWagerInput({
          walletId,
          playerId,
          kind: WagerTransactionKind.BET,
          amount: "10.00",
        }),
      );

      // Dispara todas as 10 requisições simultaneamente
      const resultados = await Promise.all(
        apostas.map((aposta) => wageringService.processarTransacao(aposta)),
      );

      const processadas = resultados.filter(
        (r) => r.status === WagerTransactionStatus.PROCESSED,
      );
      const rejeitadas = resultados.filter(
        (r) => r.status === WagerTransactionStatus.REJECTED,
      );

      // Exatamente 5 devem passar (5 * 10 = 50.00) e 5 devem ser rejeitadas
      expect(processadas.length).toBe(5);
      expect(rejeitadas.length).toBe(5);

      for (const rejeitada of rejeitadas) {
        expect(rejeitada.failureCode).toBe("INSUFFICIENT_BALANCE");
      }

      // Verificação de consistência no PostgreSQL
      const walletDb = await dataSource
        .getRepository(WalletEntity)
        .findOne({ where: { id: walletId } });
      expect(walletDb!.balance).toBe("0.00");
      expect(walletDb!.version).toBe(6); // 1 (opening) + 5 (apostas)

      const ledgerDebits = await dataSource.getRepository(LedgerEntity).find({
        where: { walletId, direction: LedgerDirection.DEBIT },
      });
      expect(ledgerDebits.length).toBe(5);
    });

    it("deve rejeitar violação direta da constraint CK_wallet_balance_non_negative no PostgreSQL", async () => {
      const { walletId } = await createWalletWithBalance("10.00");

      // Tenta forçar saldo negativo diretamente via SQL no banco
      let erroDisparado: any;
      try {
        await dataSource.query(
          `UPDATE wallet SET balance = -5.00 WHERE id = $1`,
          [walletId],
        );
      } catch (err) {
        erroDisparado = err;
      }

      expect(erroDisparado).toBeDefined();
      expect(erroDisparado.message).toContain("CK_wallet_balance_non_negative");
    });

    it("deve impedir débito duplicado ao receber a mesma requisição de aposta repetida", async () => {
      const { walletId, playerId } = await createWalletWithBalance("100.00");

      const bet = buildWagerInput({
        walletId,
        playerId,
        kind: WagerTransactionKind.BET,
        amount: "25.00",
      });

      const firstResponse = await wageringService.processarTransacao(bet);
      expect(firstResponse.status).toBe(WagerTransactionStatus.PROCESSED);
      expect(firstResponse.idempotentReplay).toBe(false);

      const secondResponse = await wageringService.processarTransacao(bet);
      expect(secondResponse.status).toBe(WagerTransactionStatus.PROCESSED);
      expect(secondResponse.idempotentReplay).toBe(true);
      expect(secondResponse.balance.amount).toBe("75.00");

      // No banco real, o saldo permaneceu 75.00 e o ledger possui apenas 1 débito
      const walletDb = await dataSource
        .getRepository(WalletEntity)
        .findOne({ where: { id: walletId } });
      expect(walletDb!.balance).toBe("75.00");

      const ledgerDebits = await dataSource.getRepository(LedgerEntity).find({
        where: { walletId, direction: LedgerDirection.DEBIT },
      });
      expect(ledgerDebits.length).toBe(1);
    });

    it("deve serializar dois REFUNDs concorrentes para a mesma aposta e rejeitar o segundo no PostgreSQL", async () => {
      const { walletId, playerId } = await createWalletWithBalance("100.00");

      // Realiza aposta inicial de 30.00
      const betInput = buildWagerInput({
        walletId,
        playerId,
        kind: WagerTransactionKind.BET,
        amount: "30.00",
        roundId: "round-refund-test",
      });
      await wageringService.processarTransacao(betInput);

      // Dois estornos (REFUND) simultâneos tentando reverter a mesma aposta
      const refund1 = buildWagerInput({
        walletId,
        playerId,
        kind: WagerTransactionKind.REFUND,
        amount: "30.00",
        roundId: "round-refund-test",
        referenceExternalTransactionId: betInput.externalTransactionId,
      });

      const refund2 = buildWagerInput({
        walletId,
        playerId,
        kind: WagerTransactionKind.REFUND,
        amount: "30.00",
        roundId: "round-refund-test",
        referenceExternalTransactionId: betInput.externalTransactionId,
      });

      const [res1, res2] = await Promise.all([
        wageringService.processarTransacao(refund1),
        wageringService.processarTransacao(refund2),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([
        WagerTransactionStatus.PROCESSED,
        WagerTransactionStatus.REJECTED,
      ]);

      const perdedora =
        res1.status === WagerTransactionStatus.REJECTED ? res1 : res2;
      expect(perdedora.failureCode).toBe("REFERENCE_ALREADY_REVERTED");

      // Saldo restaurado exatamente uma vez (100 - 30 + 30 = 100.00)
      const walletDb = await dataSource
        .getRepository(WalletEntity)
        .findOne({ where: { id: walletId } });
      expect(walletDb!.balance).toBe("100.00");

      const ledgerCredits = await dataSource.getRepository(LedgerEntity).find({
        where: { walletId, direction: LedgerDirection.CREDIT },
      });
      // 1 OPENING (100.00) + 1 REFUND CREDIT (30.00)
      expect(ledgerCredits.length).toBe(2);
    });
  });
});
