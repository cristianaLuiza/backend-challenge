import { Money } from '../money/money';

export enum LedgerDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export interface CreateLedgerEntryProps {
  id?: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt?: Date;
}

export interface LedgerEntryState {
  id: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt: Date;
}

export class WalletLedgerEntry {
  private constructor(
    public readonly id: string,
    public readonly walletId: string,
    public readonly transactionId: string,
    public readonly direction: LedgerDirection,
    public readonly money: Money,
    public readonly balanceBefore: Money,
    public readonly balanceAfter: Money,
    public readonly createdAt: Date,
  ) {}

  static create(props: CreateLedgerEntryProps): WalletLedgerEntry {
    if (!props.money.isPositive()) {
      throw new Error('O valor do lançamento no ledger deve ser estritamente positivo.');
    }

    const id = props.id ?? crypto.randomUUID();
    const createdAt = props.createdAt ?? new Date();

    const entry = new WalletLedgerEntry(
      id,
      props.walletId,
      props.transactionId,
      props.direction,
      props.money,
      props.balanceBefore,
      props.balanceAfter,
      createdAt,
    );

    if (!entry.isBalanced()) {
      throw new Error(
        `Inconsistência aritmética no ledger: balanceBefore (${props.balanceBefore.toString()}) ${
          props.direction === LedgerDirection.CREDIT ? '+' : '-'
        } amount (${props.money.toString()}) não é igual a balanceAfter (${props.balanceAfter.toString()})`,
      );
    }

    return entry;
  }

  static rehydrate(state: LedgerEntryState): WalletLedgerEntry {
    return new WalletLedgerEntry(
      state.id,
      state.walletId,
      state.transactionId,
      state.direction,
      state.money,
      state.balanceBefore,
      state.balanceAfter,
      state.createdAt,
    );
  }

  /**
   * balanceBefore ± money === balanceAfter.
   */
  isBalanced(): boolean {
    if (this.direction === LedgerDirection.CREDIT) {
      return this.balanceBefore.add(this.money).equals(this.balanceAfter);
    }

    if (this.direction === LedgerDirection.DEBIT) {
      return this.balanceBefore.subtract(this.money).equals(this.balanceAfter);
    }

    return false;
  }
}
