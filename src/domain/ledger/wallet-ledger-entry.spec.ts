import { describe, expect, it } from 'bun:test';
import { Money } from '../money/money';
import {
  LedgerDirection,
  WalletLedgerEntry,
} from './wallet-ledger-entry';

describe('WalletLedgerEntry', () => {
  const currency = 'BRL';

  it('deve criar lançamento de crédito balanceado com sucesso', () => {
    const entry = WalletLedgerEntry.create({
      walletId: 'w-1',
      transactionId: 'tx-1',
      direction: LedgerDirection.CREDIT,
      money: Money.from({ amount: '50.00', currency }),
      balanceBefore: Money.from({ amount: '100.00', currency }),
      balanceAfter: Money.from({ amount: '150.00', currency }),
    });

    expect(entry.isBalanced()).toBe(true);
    expect(entry.direction).toBe(LedgerDirection.CREDIT);
    expect(entry.money.toString()).toBe('50.00');
  });

  it('deve criar lançamento de débito balanceado com sucesso', () => {
    const entry = WalletLedgerEntry.create({
      walletId: 'w-1',
      transactionId: 'tx-2',
      direction: LedgerDirection.DEBIT,
      money: Money.from({ amount: '30.00', currency }),
      balanceBefore: Money.from({ amount: '100.00', currency }),
      balanceAfter: Money.from({ amount: '70.00', currency }),
    });

    expect(entry.isBalanced()).toBe(true);
    expect(entry.direction).toBe(LedgerDirection.DEBIT);
  });

  it('deve lançar erro se o cálculo aritmético estiver desbalanceado', () => {
    expect(() =>
      WalletLedgerEntry.create({
        walletId: 'w-1',
        transactionId: 'tx-3',
        direction: LedgerDirection.DEBIT,
        money: Money.from({ amount: '30.00', currency }),
        balanceBefore: Money.from({ amount: '100.00', currency }),
        balanceAfter: Money.from({ amount: '80.00', currency }), // Errado: deveria ser 70.00
      }),
    ).toThrow('Inconsistência aritmética no ledger');
  });

  it('deve lançar erro para valor não positivo', () => {
    expect(() =>
      WalletLedgerEntry.create({
        walletId: 'w-1',
        transactionId: 'tx-4',
        direction: LedgerDirection.CREDIT,
        money: Money.zero(currency),
        balanceBefore: Money.from({ amount: '100.00', currency }),
        balanceAfter: Money.from({ amount: '100.00', currency }),
      }),
    ).toThrow('O valor do lançamento no ledger deve ser estritamente positivo.');
  });
});
