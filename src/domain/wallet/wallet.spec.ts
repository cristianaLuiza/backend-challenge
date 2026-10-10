
import { describe, expect, it } from 'bun:test';
import { Money } from '../money/money';
import { Wallet } from './wallet';

describe('Wallet', () => {
  it('deve criar carteira com saldo inicial zero e versão 1', () => {
    const carteira = Wallet.criar(
      'wallet-1',
      'player-1',
      Money.zero('BRL'),
    );

    expect(carteira.getSaldo().paraString()).toBe('0.00');
    expect(carteira.getVersao()).toBe(1);
  });

  it('deve creditar dinheiro e incrementar a versão', () => {
    const carteira = Wallet.criar(
      'wallet-1',
      'player-1',
      Money.zero('BRL'),
    );

    carteira.creditar(Money.criar('100.00', 'BRL'));

    expect(carteira.getSaldo().paraString()).toBe('100.00');
    expect(carteira.getVersao()).toBe(2);
  });

  it('deve debitar quando existe saldo suficiente', () => {
    const carteira = Wallet.criar(
      'wallet-1',
      'player-1',
      Money.criar('100.00', 'BRL'),
    );

    carteira.debitar(Money.criar('30.00', 'BRL'));

    expect(carteira.getSaldo().paraString()).toBe('70.00');
    expect(carteira.getVersao()).toBe(2);
  });

  it('não deve permitir saldo negativo', () => {
    const carteira = Wallet.criar(
      'wallet-1',
      'player-1',
      Money.criar('50.00', 'BRL'),
    );

    expect(() => {
      carteira.debitar(Money.criar('80.00', 'BRL'));
    }).toThrow('Saldo insuficiente.');

    expect(carteira.getSaldo().paraString()).toBe('50.00');
    expect(carteira.getVersao()).toBe(1);
  });

  it('não deve aceitar crédito em moeda diferente', () => {
    const carteira = Wallet.criar(
      'wallet-1',
      'player-1',
      Money.zero('BRL'),
    );

    expect(() => {
      carteira.creditar(Money.criar('10.00', 'USD'));
    }).toThrow('A moeda da operação é diferente da carteira.');
  });
});
