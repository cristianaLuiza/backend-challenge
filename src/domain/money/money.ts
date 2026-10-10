import Decimal from 'decimal.js';

export interface MoneyProps {
  amount: string; // decimal string, ex: "25.00"
  currency: string; // ISO-4217, ex: "BRL"
}

export class Money {
  private constructor(
    private readonly value: Decimal,
    public readonly currency: string,
  ) {}

  static from(props: MoneyProps): Money {
    if (!props || typeof props.amount !== 'string' || typeof props.currency !== 'string') {
      throw new Error('Propriedades monetárias inválidas.');
    }

    const { amount, currency } = props;

    // Rejeita strings vazias, notação científica, múltiplos pontos ou mais de 2 casas decimais
    if (!/^-?\d+(\.\d{1,2})?$/.test(amount.trim())) {
      throw new Error('Valor monetário inválido.');
    }

    if (!/^[A-Z]{3}$/.test(currency.trim())) {
      throw new Error('Moeda inválida.');
    }

    const quantia = new Decimal(amount.trim());

    if (!quantia.isFinite()) {
      throw new Error('Valor monetário inválido.');
    }

    return new Money(quantia, currency.trim());
  }

  static zero(currency: string): Money {
    return Money.from({ amount: '0.00', currency });
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  negate(): Money {
    return new Money(this.value.negated(), this.currency);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isNegative(): boolean {
    return this.value.lessThan(0);
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThan(other.value);
  }

  equals(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.equals(other.value);
  }

  toJSON(): MoneyProps {
    return {
      amount: this.toString(),
      currency: this.currency,
    };
  }

  toString(): string {
    return this.value.toFixed(2);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error('Não é possível operar com moedas diferentes.');
    }
  }

  // --- Métodos de compatibilidade (português) ---
  static criar(valor: string, moeda: string): Money {
    return Money.from({ amount: valor, currency: moeda });
  }

  get moeda(): string {
    return this.currency;
  }

  get valor(): Decimal {
    return this.value;
  }

  somar(outro: Money): Money {
    return this.add(outro);
  }

  subtrair(outro: Money): Money {
    return this.subtract(outro);
  }

  negar(): Money {
    return this.negate();
  }

  ehZero(): boolean {
    return this.isZero();
  }

  ehPositivo(): boolean {
    return this.isPositive();
  }

  ehNegativo(): boolean {
    return this.isNegative();
  }

  menorQue(outro: Money): boolean {
    return this.isLessThan(outro);
  }

  igualA(outro: Money): boolean {
    return this.equals(outro);
  }

  paraJSON(): MoneyProps {
    return this.toJSON();
  }

  paraString(): string {
    return this.toString();
  }
}
