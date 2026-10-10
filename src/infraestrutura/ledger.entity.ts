
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum LedgerDirection {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

@Entity('wallet_ledger_entry')
@Index('UQ_ledger_transaction', ['transactionId'], { unique: true })
@Check('"amount" > 0')
@Check('"balance_before" >= 0')
@Check('"balance_after" >= 0')
export class LedgerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  direction: LedgerDirection;

  @Column({
    type: 'numeric',
    precision: 19,
    scale: 2,
  })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({
    name: 'balance_before',
    type: 'numeric',
    precision: 19,
    scale: 2,
  })
  balanceBefore: string;

  @Column({
    name: 'balance_after',
    type: 'numeric',
    precision: 19,
    scale: 2,
  })
  balanceAfter: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;
}
