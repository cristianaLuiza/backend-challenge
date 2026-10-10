import { Money } from '../money/money';

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

export enum LedgerDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export type FailureCode =
  | 'INSUFFICIENT_BALANCE'
  | 'REFERENCE_NOT_FOUND'
  | 'INVALID_REFERENCE_STATUS'
  | 'REFERENCE_ALREADY_REVERTED'
  | 'REFERENCE_ROUND_MISMATCH'
  | 'REFERENCE_CURRENCY_MISMATCH'
  | 'REFERENCE_AMOUNT_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_AMOUNT'
  | 'INVALID_TRANSACTION_STATE'
  | 'ROLLBACK_NEGATIVE_BALANCE'
  | string;

export class InvalidTransactionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionStateError';
  }
}

export interface CreateWagerTransactionProps {
  id?: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: Money;
  referenceExternalTransactionId?: string;
  createdAt?: Date;
}

export interface WagerTransactionState {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: Money;
  referenceExternalTransactionId?: string;
  createdAt: Date;
  status: WagerTransactionStatus;
  referenceTransactionId?: string;
  failureCode?: FailureCode;
  processedAt?: Date;
}

export class WagerTransaction {
  private constructor(
    public readonly id: string,
    public readonly providerId: string,
    public readonly externalTransactionId: string,
    public readonly idempotencyKey: string,
    public readonly payloadHash: string,
    public readonly walletId: string,
    public readonly playerId: string,
    public readonly roundId: string,
    public readonly gameId: string,
    public readonly kind: WagerTransactionKind,
    public readonly money: Money,
    public readonly referenceExternalTransactionId: string | undefined,
    public readonly createdAt: Date,
    private _status: WagerTransactionStatus,
    private _referenceTransactionId?: string,
    private _failureCode?: FailureCode,
    private _processedAt?: Date,
  ) {}

  /**
   * Nasce em PENDING. Valida a exigência de referência por kind.
   */
  static create(props: CreateWagerTransactionProps): WagerTransaction {
    if (!props.money.isPositive() && props.kind !== WagerTransactionKind.LOSS) {
      throw new Error('O valor da transação deve ser estritamente positivo.');
    }

    if (
      (props.kind === WagerTransactionKind.REFUND || props.kind === WagerTransactionKind.ROLLBACK) &&
      !props.referenceExternalTransactionId?.trim()
    ) {
      throw new Error(`A operação ${props.kind} exige referência externa.`);
    }

    const id = props.id ?? crypto.randomUUID();
    const createdAt = props.createdAt ?? new Date();

    return new WagerTransaction(
      id,
      props.providerId,
      props.externalTransactionId,
      props.idempotencyKey,
      props.payloadHash,
      props.walletId,
      props.playerId,
      props.roundId,
      props.gameId,
      props.kind,
      props.money,
      props.referenceExternalTransactionId?.trim() || undefined,
      createdAt,
      WagerTransactionStatus.PENDING,
    );
  }

  /**
   * Reconstrução a partir da persistência — não revalida transições.
   */
  static rehydrate(state: WagerTransactionState): WagerTransaction {
    return new WagerTransaction(
      state.id,
      state.providerId,
      state.externalTransactionId,
      state.idempotencyKey,
      state.payloadHash,
      state.walletId,
      state.playerId,
      state.roundId,
      state.gameId,
      state.kind,
      state.money,
      state.referenceExternalTransactionId,
      state.createdAt,
      state.status,
      state.referenceTransactionId,
      state.failureCode,
      state.processedAt,
    );
  }

  get status(): WagerTransactionStatus {
    return this._status;
  }

  get referenceTransactionId(): string | undefined {
    return this._referenceTransactionId;
  }

  get failureCode(): FailureCode | undefined {
    return this._failureCode;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  // ---- Transições ----
  markProcessed(referenceTransactionId: string | undefined, at: Date = new Date()): void {
    this.assertNotTerminal();
    this._status = WagerTransactionStatus.PROCESSED;
    this._referenceTransactionId = referenceTransactionId;
    this._processedAt = at;
  }

  markPendingReference(): void {
    this.assertNotTerminal();
    this._status = WagerTransactionStatus.PENDING_REFERENCE;
  }

  reject(code: FailureCode, at: Date = new Date()): void {
    this.assertNotTerminal();
    this._status = WagerTransactionStatus.REJECTED;
    this._failureCode = code;
    this._processedAt = at;
  }

  fail(code: FailureCode, at: Date = new Date()): void {
    this.assertNotTerminal();
    this._status = WagerTransactionStatus.FAILED;
    this._failureCode = code;
    this._processedAt = at;
  }

  // ---- Consultas de domínio ----
  isTerminal(): boolean {
    return (
      this._status === WagerTransactionStatus.PROCESSED ||
      this._status === WagerTransactionStatus.REJECTED ||
      this._status === WagerTransactionStatus.FAILED
    );
  }

  affectsBalance(): boolean {
    return this.kind !== WagerTransactionKind.LOSS;
  }

  requiresReference(): boolean {
    return (
      this.kind === WagerTransactionKind.REFUND ||
      this.kind === WagerTransactionKind.ROLLBACK
    );
  }

  matchesPayload(payloadHash: string): boolean {
    return this.payloadHash === payloadHash;
  }

  ledgerDirectionFor(reference?: WagerTransaction): LedgerDirection {
    switch (this.kind) {
      case WagerTransactionKind.BET:
        return LedgerDirection.DEBIT;
      case WagerTransactionKind.WIN:
      case WagerTransactionKind.OPENING:
        return LedgerDirection.CREDIT;
      case WagerTransactionKind.REFUND:
        return LedgerDirection.CREDIT;
      case WagerTransactionKind.ROLLBACK: {
        if (!reference) {
          throw new Error('ROLLBACK exige a transação de referência para calcular a direção do ledger.');
        }
        // Inverte a direção original da referência
        if (reference.kind === WagerTransactionKind.BET) {
          return LedgerDirection.CREDIT;
        }
        if (reference.kind === WagerTransactionKind.WIN || reference.kind === WagerTransactionKind.REFUND) {
          return LedgerDirection.DEBIT;
        }
        throw new Error(`Tipo de referência não suportado para ROLLBACK: ${reference.kind}`);
      }
      case WagerTransactionKind.LOSS:
        throw new Error('LOSS não gera movimentação no ledger.');
      default:
        throw new Error(`Tipo de transação desconhecido: ${this.kind}`);
    }
  }

  private assertNotTerminal(): void {
    if (this.isTerminal()) {
      throw new InvalidTransactionStateError(
        `Transação ${this.id} já está no estado terminal ${this._status} e não pode ser alterada.`,
      );
    }
  }
}
