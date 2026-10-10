import { Money } from '../money/money';

export interface WalletState {
  id: string;
  playerId: string;
  currency: string;
  balance: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    public readonly currency: string,
    private _balance: Money,
    private _version: number,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static open(props: {
    id: string;
    playerId: string;
    initialBalance: Money;
    createdAt?: Date;
  }): Wallet {
    if (props.initialBalance.isNegative()) {
      throw new Error('O saldo inicial não pode ser negativo.');
    }

    const now = props.createdAt ?? new Date();

    return new Wallet(
      props.id,
      props.playerId,
      props.initialBalance.currency,
      props.initialBalance,
      1,
      now,
      now,
    );
  }

  /**
   * Reconstrução a partir da persistência — não revalida transições de abertura.
   */
  static rehydrate(state: WalletState): Wallet {
    return new Wallet(
      state.id,
      state.playerId,
      state.currency,
      state.balance,
      state.version,
      state.createdAt,
      state.updatedAt,
    );
  }

  get balance(): Money {
    return this._balance;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  credit(amount: Money, now: Date = new Date()): void {
    this.assertSameCurrency(amount);

    if (!amount.isPositive()) {
      throw new Error('O valor deve ser maior que zero.');
    }

    this._balance = this._balance.add(amount);
    this._version += 1;
    this._updatedAt = now;
  }

  debit(amount: Money, now: Date = new Date()): void {
    this.assertSameCurrency(amount);

    if (!amount.isPositive()) {
      throw new Error('O valor deve ser maior que zero.');
    }

    if (this._balance.isLessThan(amount)) {
      throw new Error('Saldo insuficiente.');
    }

    this._balance = this._balance.subtract(amount);
    this._version += 1;
    this._updatedAt = now;
  }

  private assertSameCurrency(money: Money): void {
    if (this.currency !== money.currency) {
      throw new Error('A moeda da operação é diferente da carteira.');
    }
  }

  // --- Métodos de compatibilidade ---
  static criar(id: string, playerId: string, saldoInicial: Money): Wallet {
    return Wallet.open({ id, playerId, initialBalance: saldoInicial });
  }

  getSaldo(): Money {
    return this.balance;
  }

  getVersao(): number {
    return this.version;
  }

  creditar(valor: Money): void {
    this.credit(valor);
  }

  debitar(valor: Money): void {
    this.debit(valor);
  }
}
