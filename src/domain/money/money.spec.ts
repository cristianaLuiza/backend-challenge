import { describe, expect, it } from 'bun:test';
import { Money } from './money';


describe('Money', () => {
  it('deve somar valores corretamente', () => {
    const a = Money.criar('10.50', 'BRL');
    const b = Money.criar('5.25', 'BRL');

    expect(a.somar(b).paraString()).toBe('15.75');
  });

  it('deve subtrair valores corretamente', () => {
    const a = Money.criar('10.00', 'BRL');
    const b = Money.criar('3.50', 'BRL');

    expect(a.subtrair(b).paraString()).toBe('6.50');
  });

  it('não deve permitir moedas diferentes', () => {
    const reais = Money.criar('10.00', 'BRL');
    const dolares = Money.criar('5.00', 'USD');

    expect(() => reais.somar(dolares)).toThrow(
      'Não é possível operar com moedas diferentes.',
    );
  });

  it('não deve aceitar mais de duas casas decimais', () => {
    expect(() => Money.criar('10.123', 'BRL')).toThrow(
      'Valor monetário inválido.',
    );
  });
});
  it('não deve aceitar mais de duas casas decimais', () => {
    expect(() => Money.criar('10.123', 'BRL')).toThrow(
      'Valor monetário inválido.',
    );
  });

