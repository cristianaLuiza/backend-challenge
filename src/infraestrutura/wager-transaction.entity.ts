
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum WagerTransactionKind {
  OPENING = 'OPENING',
  BET = 'BET',
  WIN = 'WIN',
  LOSS = 'LOSS',
  REFUND = 'REFUND',
  ROLLBACK = 'ROLLBACK',
}

export enum WagerTransactionStatus {
  PENDING = 'PENDING',
  PENDING_REFERENCE = 'PENDING_REFERENCE',
  PROCESSED = 'PROCESSED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

@Entity('wager_transaction')
@Index(
  'UQ_wager_provider_idempotency',
  ['providerId', 'idempotencyKey'],
  { unique: true },
)
export class WagerTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  providerId: string;

  @Column({
    name: 'external_transaction_id',
    type: 'varchar',
    length: 150,
  })
  externalTransactionId: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 200,
  })
  idempotencyKey: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64 })
  payloadHash: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId: string;

  @Column({ name: 'round_id', type: 'varchar', length: 150 })
  roundId: string;

  @Column({ name: 'game_id', type: 'varchar', length: 150 })
  gameId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: WagerTransactionKind;

  @Column({ type: 'numeric', precision: 19, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({
    name: 'reference_external_transaction_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  referenceExternalTransactionId: string | null;

  @Column({
    name: 'reference_transaction_id',
    type: 'uuid',
    nullable: true,
  })
  referenceTransactionId: string | null;

  @Column({ type: 'varchar', length: 30 })
  status: WagerTransactionStatus;

  @Column({
    name: 'failure_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  failureCode: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
