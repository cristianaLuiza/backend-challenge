import { describe, expect, it } from 'bun:test';
import { Money } from '../money/money';
import {
  InvalidTransactionStateError,
  LedgerDirection,
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from './wager-transaction';

describe('WagerTransaction', () => {
  const defaultMoney = Money.from({ amount: '25.00', currency: 'BRL' });

  it('deve criar transação em estado PENDING', () => {
    const tx = WagerTransaction.create({
      providerId: 'prov-1',
      externalTransactionId: 'ext-1',
      idempotencyKey: 'prov-1:ext-1',
      payloadHash: 'hash123',
      walletId: 'w-1',
      playerId: 'p-1',
      roundId: 'r-1',
      gameId: 'g-1',
      kind: WagerTransactionKind.BET,
      money: defaultMoney,
    });

    expect(tx.status).toBe(WagerTransactionStatus.PENDING);
    expect(tx.isTerminal()).toBe(false);
    expect(tx.affectsBalance()).toBe(true);
    expect(tx.requiresReference()).toBe(false);
  });

  it('deve exigir referência para REFUND e ROLLBACK', () => {
    expect(() =>
      WagerTransaction.create({
        providerId: 'prov-1',
        externalTransactionId: 'ext-refund',
        idempotencyKey: 'prov-1:ext-refund',
        payloadHash: 'hash123',
        walletId: 'w-1',
        playerId: 'p-1',
        roundId: 'r-1',
        gameId: 'g-1',
        kind: WagerTransactionKind.REFUND,
        money: defaultMoney,
      }),
    ).toThrow('A operação REFUND exige referência externa.');
  });

  it('deve transicionar de PENDING para PROCESSED', () => {
    const tx = WagerTransaction.create({
      providerId: 'prov-1',
      externalTransactionId: 'ext-1',
      idempotencyKey: 'prov-1:ext-1',
      payloadHash: 'hash123',
      walletId: 'w-1',
      playerId: 'p-1',
      roundId: 'r-1',
      gameId: 'g-1',
      kind: WagerTransactionKind.BET,
      money: defaultMoney,
    });

    const now = new Date();
    tx.markProcessed(undefined, now);

    expect(tx.status).toBe(WagerTransactionStatus.PROCESSED);
    expect(tx.isTerminal()).toBe(true);
    expect(tx.processedAt).toBe(now);
  });

  it('não deve permitir transicionar transação terminal', () => {
    const tx = WagerTransaction.create({
      providerId: 'prov-1',
      externalTransactionId: 'ext-1',
      idempotencyKey: 'prov-1:ext-1',
      payloadHash: 'hash123',
      walletId: 'w-1',
      playerId: 'p-1',
      roundId: 'r-1',
      gameId: 'g-1',
      kind: WagerTransactionKind.BET,
      money: defaultMoney,
    });

    tx.reject('INSUFFICIENT_BALANCE');
    expect(tx.status).toBe(WagerTransactionStatus.REJECTED);
    expect(tx.isTerminal()).toBe(true);

    expect(() => tx.markProcessed(undefined, new Date())).toThrow(
      InvalidTransactionStateError,
    );
  });

  it('deve definir direção correta do ledger', () => {
    const betTx = WagerTransaction.create({
      providerId: 'prov-1',
      externalTransactionId: 'ext-bet',
      idempotencyKey: 'prov-1:ext-bet',
      payloadHash: 'hash1',
      walletId: 'w-1',
      playerId: 'p-1',
      roundId: 'r-1',
      gameId: 'g-1',
      kind: WagerTransactionKind.BET,
      money: defaultMoney,
    });

    expect(betTx.ledgerDirectionFor()).toBe(LedgerDirection.DEBIT);

    const winTx = WagerTransaction.create({
      providerId: 'prov-1',
      externalTransactionId: 'ext-win',
      idempotencyKey: 'prov-1:ext-win',
      payloadHash: 'hash2',
      walletId: 'w-1',
      playerId: 'p-1',
      roundId: 'r-1',
      gameId: 'g-1',
      kind: WagerTransactionKind.WIN,
      money: defaultMoney,
    });

    expect(winTx.ledgerDirectionFor()).toBe(LedgerDirection.CREDIT);

    const rollbackBet = WagerTransaction.create({
      providerId: 'prov-1',
      externalTransactionId: 'ext-rb',
      idempotencyKey: 'prov-1:ext-rb',
      payloadHash: 'hash3',
      walletId: 'w-1',
      playerId: 'p-1',
      roundId: 'r-1',
      gameId: 'g-1',
      kind: WagerTransactionKind.ROLLBACK,
      money: defaultMoney,
      referenceExternalTransactionId: 'ext-bet',
    });

    expect(rollbackBet.ledgerDirectionFor(betTx)).toBe(LedgerDirection.CREDIT);
  });
});
