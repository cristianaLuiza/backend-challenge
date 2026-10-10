/** @format */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  WagerTransactionEntity,
  WagerTransactionKind,
  WagerTransactionStatus,
} from "../infraestrutura/wager-transaction.entity";
import { WalletEntity } from "../infraestrutura/wallet.entity";
import { LedgerEntity, LedgerDirection } from "../infraestrutura/ledger.entity";
import { Money } from "../domain/money/money";
import { Wallet } from "../domain/wallet/wallet";
import {
  WagerTransaction,
  FailureCode,
} from "../domain/wager-transaction/wager-transaction";
import { WalletLedgerEntry } from "../domain/ledger/wallet-ledger-entry";
import { OutboxEntity } from "src/infraestrutura/outbox.entity";

export interface ProcessarTransacaoInput {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: {
    amount: string;
    currency: string;
  };
  referenceExternalTransactionId?: string;
}

export interface WagerTransactionResponse {
  transactionId: string;
  status: WagerTransactionStatus;
  failureCode?: string;
  balance: {
    amount: string;
    currency: string;
  };
  idempotentReplay: boolean;
}

@Injectable()
export class WageringService {
  constructor(private readonly dataSource: DataSource) {}

  async processarTransacao(
    dados: ProcessarTransacaoInput,
  ): Promise<WagerTransactionResponse> {
    if (dados.kind === WagerTransactionKind.OPENING) {
      throw new BadRequestException(
        "OPENING é uma operação interna e não pode ser submetida pela API ou mensageria.",
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const transacoesRepo = manager.getRepository(WagerTransactionEntity);
      const carteirasRepo = manager.getRepository(WalletEntity);
      const ledgerRepo = manager.getRepository(LedgerEntity);
      const outboxRepo = manager.getRepository(OutboxEntity);

      // 1. Verificação de Idempotência Persistente
      const existente = await transacoesRepo.findOne({
        where: {
          providerId: dados.providerId,
          idempotencyKey: dados.idempotencyKey,
        },
      });

      if (existente) {
        if (existente.payloadHash !== dados.payloadHash) {
          throw new ConflictException(
            "A chave de idempotência já foi usada com outro conteúdo.",
          );
        }

        const carteira = await carteirasRepo.findOne({
          where: { id: existente.walletId },
        });

        return {
          transactionId: existente.id,
          status: existente.status,
          failureCode: existente.failureCode ?? undefined,
          balance: {
            amount: carteira?.balance ?? existente.amount,
            currency: carteira?.currency ?? existente.currency,
          },
          idempotentReplay: true,
        };
      }

      // 2. Lock Pessimista na Carteira (unidade de concorrência)
      const carteiraEntity = await carteirasRepo.findOne({
        where: {
          id: dados.walletId,
          playerId: dados.playerId,
        },
        lock: { mode: "pessimistic_write" },
      });

      if (!carteiraEntity) {
        throw new NotFoundException("Carteira não encontrada.");
      }

      if (carteiraEntity.currency !== dados.money.currency) {
        throw new ConflictException(
          "A moeda da transação é diferente da moeda da carteira.",
        );
      }

      // 3. Reidratação do Aggregate Wallet a partir do banco
      const walletDomain = Wallet.rehydrate({
        id: carteiraEntity.id,
        playerId: carteiraEntity.playerId,
        currency: carteiraEntity.currency,
        balance: Money.from({
          amount: carteiraEntity.balance,
          currency: carteiraEntity.currency,
        }),
        version: carteiraEntity.version,
        createdAt: carteiraEntity.createdAt,
        updatedAt: carteiraEntity.updatedAt,
      });

      const valorOperacao = Money.from({
        amount: dados.money.amount,
        currency: dados.money.currency,
      });

      // 4. Instanciação do Aggregate de Domínio WagerTransaction
      const txDomain = WagerTransaction.create({
        providerId: dados.providerId,
        externalTransactionId: dados.externalTransactionId,
        idempotencyKey: dados.idempotencyKey,
        payloadHash: dados.payloadHash,
        walletId: walletDomain.id,
        playerId: walletDomain.playerId,
        roundId: dados.roundId,
        gameId: dados.gameId,
        kind: dados.kind,
        money: valorOperacao,
        referenceExternalTransactionId: dados.referenceExternalTransactionId,
      });

      // 5. Persistência inicial da transação (PENDING)
      const txEntity = transacoesRepo.create({
        id: txDomain.id,
        providerId: txDomain.providerId,
        externalTransactionId: txDomain.externalTransactionId,
        idempotencyKey: txDomain.idempotencyKey,
        payloadHash: txDomain.payloadHash,
        walletId: txDomain.walletId,
        playerId: txDomain.playerId,
        roundId: txDomain.roundId,
        gameId: txDomain.gameId,
        kind: txDomain.kind,
        amount: txDomain.money.toString(),
        currency: txDomain.money.currency,
        status: txDomain.status,
        referenceExternalTransactionId:
          txDomain.referenceExternalTransactionId ?? null,
        referenceTransactionId: null,
        failureCode: null,
        processedAt: null,
      });

      await transacoesRepo.save(txEntity);

      // 6. Execução das regras por tipo de operação
      const balanceBefore = walletDomain.balance;

      switch (dados.kind) {
        case WagerTransactionKind.BET: {
          if (balanceBefore.isLessThan(valorOperacao)) {
            txDomain.reject("INSUFFICIENT_BALANCE");
            txEntity.status = txDomain.status;
            txEntity.failureCode = txDomain.failureCode ?? null;
            txEntity.processedAt = txDomain.processedAt ?? null;
            await transacoesRepo.save(txEntity);

            return {
              transactionId: txEntity.id,
              status: txEntity.status,
              failureCode: txEntity.failureCode ?? undefined,
              balance: walletDomain.balance.toJSON(),
              idempotentReplay: false,
            };
          }

          walletDomain.debit(valorOperacao);
          await this.aplicarMovimentacaoEGravar(
            carteirasRepo,
            ledgerRepo,
            transacoesRepo,
            outboxRepo,
            carteiraEntity,
            walletDomain,
            txDomain,
            txEntity,
            LedgerDirection.DEBIT,
            valorOperacao,
            balanceBefore,
          );
          break;
        }

        case WagerTransactionKind.WIN: {
          // Pode opcionalmente referenciar uma BET da mesma rodada
          let refTxId: string | undefined;
          if (dados.referenceExternalTransactionId) {
            const refTx = await transacoesRepo.findOne({
              where: {
                providerId: dados.providerId,
                externalTransactionId: dados.referenceExternalTransactionId,
              },
            });
            if (refTx) {
              refTxId = refTx.id;
            }
          }

          walletDomain.credit(valorOperacao);
          await this.aplicarMovimentacaoEGravar(
            carteirasRepo,
            ledgerRepo,
            transacoesRepo,
            outboxRepo,
            carteiraEntity,
            walletDomain,
            txDomain,
            txEntity,
            LedgerDirection.CREDIT,
            valorOperacao,
            balanceBefore,
            refTxId,
          );
          break;
        }

        case WagerTransactionKind.LOSS: {
          // LOSS não move saldo nem grava no ledger
          txDomain.markProcessed(undefined, new Date());
          txEntity.status = txDomain.status;
          txEntity.processedAt = txDomain.processedAt ?? null;
          await transacoesRepo.save(txEntity);
          break;
        }

        case WagerTransactionKind.REFUND: {
          const resultado = await this.processarReversao(
            transacoesRepo,
            dados,
            valorOperacao,
            txDomain,
            txEntity,
            WagerTransactionKind.REFUND,
          );

          if (!resultado.podeAplicar) {
            return {
              transactionId: txEntity.id,
              status: txEntity.status,
              failureCode: txEntity.failureCode ?? undefined,
              balance: walletDomain.balance.toJSON(),
              idempotentReplay: false,
            };
          }

          walletDomain.credit(valorOperacao);
          await this.aplicarMovimentacaoEGravar(
            carteirasRepo,
            ledgerRepo,
            transacoesRepo,
            outboxRepo,
            carteiraEntity,
            walletDomain,
            txDomain,
            txEntity,
            LedgerDirection.CREDIT,
            valorOperacao,
            balanceBefore,
            resultado.referenceId,
          );
          break;
        }

        case WagerTransactionKind.ROLLBACK: {
          const resultado = await this.processarReversao(
            transacoesRepo,
            dados,
            valorOperacao,
            txDomain,
            txEntity,
            WagerTransactionKind.ROLLBACK,
          );

          if (!resultado.podeAplicar) {
            return {
              transactionId: txEntity.id,
              status: txEntity.status,
              failureCode: txEntity.failureCode ?? undefined,
              balance: walletDomain.balance.toJSON(),
              idempotentReplay: false,
            };
          }

          const direcaoInvertida = resultado.direcaoInvertida!;

          if (direcaoInvertida === LedgerDirection.DEBIT) {
            // Reversão de crédito: verifica se causaria saldo negativo
            if (balanceBefore.isLessThan(valorOperacao)) {
              txDomain.reject("ROLLBACK_NEGATIVE_BALANCE");
              txEntity.status = txDomain.status;
              txEntity.failureCode = txDomain.failureCode ?? null;
              txEntity.processedAt = txDomain.processedAt ?? null;
              await transacoesRepo.save(txEntity);

              return {
                transactionId: txEntity.id,
                status: txEntity.status,
                failureCode: txEntity.failureCode ?? undefined,
                balance: walletDomain.balance.toJSON(),
                idempotentReplay: false,
              };
            }
            walletDomain.debit(valorOperacao);
          } else {
            walletDomain.credit(valorOperacao);
          }

          await this.aplicarMovimentacaoEGravar(
            carteirasRepo,
            ledgerRepo,
            transacoesRepo,
            outboxRepo,
            carteiraEntity,
            walletDomain,
            txDomain,
            txEntity,
            direcaoInvertida,
            valorOperacao,
            balanceBefore,
            resultado.referenceId,
          );
          break;
        }

        default:
          throw new BadRequestException(
            `Tipo de transação não suportado: ${dados.kind}`,
          );
      }

      return {
        transactionId: txEntity.id,
        status: txEntity.status,
        failureCode: txEntity.failureCode ?? undefined,
        balance: walletDomain.balance.toJSON(),
        idempotentReplay: false,
      };
    });
  }

  // Backwards compatibility alias para apostar()
  async apostar(dados: any): Promise<WagerTransactionResponse> {
    const money =
      dados.money ??
      (dados.amount && dados.currency
        ? { amount: dados.amount, currency: dados.currency }
        : undefined);

    return this.processarTransacao({
      ...dados,
      kind: dados.kind ?? WagerTransactionKind.BET,
      money,
    });
  }

  private async processarReversao(
    transacoesRepo: any,
    dados: ProcessarTransacaoInput,
    valorOperacao: Money,
    txDomain: WagerTransaction,
    txEntity: WagerTransactionEntity,
    tipoReversao: WagerTransactionKind,
  ): Promise<{
    podeAplicar: boolean;
    referenceId?: string;
    direcaoInvertida?: LedgerDirection;
  }> {
    const ref = await transacoesRepo.findOne({
      where: {
        providerId: dados.providerId,
        externalTransactionId: dados.referenceExternalTransactionId,
      },
    });

    if (!ref) {
      // Referência ausente: salva como PENDING_REFERENCE para reprocessamento
      txDomain.markPendingReference();
      txEntity.status = txDomain.status;
      await transacoesRepo.save(txEntity);
      return { podeAplicar: false };
    }

    if (ref.status !== WagerTransactionStatus.PROCESSED) {
      return this.rejeitarReversao(
        transacoesRepo,
        txDomain,
        txEntity,
        "INVALID_REFERENCE_STATUS",
      );
    }

    if (
      ref.playerId !== dados.playerId ||
      ref.walletId !== dados.walletId ||
      ref.currency !== dados.money.currency ||
      ref.roundId !== dados.roundId
    ) {
      return this.rejeitarReversao(
        transacoesRepo,
        txDomain,
        txEntity,
        "REFERENCE_MISMATCH",
      );
    }

    if (ref.amount !== valorOperacao.toString()) {
      return this.rejeitarReversao(
        transacoesRepo,
        txDomain,
        txEntity,
        "REFERENCE_AMOUNT_MISMATCH",
      );
    }

    if (tipoReversao === WagerTransactionKind.REFUND) {
      if (ref.kind !== WagerTransactionKind.BET) {
        return this.rejeitarReversao(
          transacoesRepo,
          txDomain,
          txEntity,
          "INVALID_REFERENCE_KIND",
        );
      }
    } else if (tipoReversao === WagerTransactionKind.ROLLBACK) {
      if (
        ref.kind !== WagerTransactionKind.BET &&
        ref.kind !== WagerTransactionKind.WIN &&
        ref.kind !== WagerTransactionKind.REFUND
      ) {
        return this.rejeitarReversao(
          transacoesRepo,
          txDomain,
          txEntity,
          "INVALID_REFERENCE_KIND",
        );
      }
    }

    // Valida se já foi revertida anteriormente pelo mesmo tipo de reversão
    const jaRevertida = await transacoesRepo.findOne({
      where: {
        referenceTransactionId: ref.id,
        kind: tipoReversao,
        status: WagerTransactionStatus.PROCESSED,
      },
    });

    if (jaRevertida) {
      return this.rejeitarReversao(
        transacoesRepo,
        txDomain,
        txEntity,
        "REFERENCE_ALREADY_REVERTED",
      );
    }

    let direcaoInvertida: LedgerDirection = LedgerDirection.CREDIT;
    if (tipoReversao === WagerTransactionKind.ROLLBACK) {
      if (ref.kind === WagerTransactionKind.BET) {
        direcaoInvertida = LedgerDirection.CREDIT;
      } else if (
        ref.kind === WagerTransactionKind.WIN ||
        ref.kind === WagerTransactionKind.REFUND
      ) {
        direcaoInvertida = LedgerDirection.DEBIT;
      }
    }

    return {
      podeAplicar: true,
      referenceId: ref.id,
      direcaoInvertida,
    };
  }

  private async rejeitarReversao(
    transacoesRepo: any,
    txDomain: WagerTransaction,
    txEntity: WagerTransactionEntity,
    code: FailureCode,
  ): Promise<{ podeAplicar: boolean }> {
    txDomain.reject(code);
    txEntity.status = txDomain.status;
    txEntity.failureCode = txDomain.failureCode ?? null;
    txEntity.processedAt = txDomain.processedAt ?? null;
    await transacoesRepo.save(txEntity);
    return { podeAplicar: false };
  }

  private async aplicarMovimentacaoEGravar(
    carteirasRepo: any,
    ledgerRepo: any,
    transacoesRepo: any,
    outboxRepo: any,
    carteiraEntity: WalletEntity,
    walletDomain: Wallet,
    txDomain: WagerTransaction,
    txEntity: WagerTransactionEntity,
    direcao: LedgerDirection,
    valor: Money,
    balanceBefore: Money,
    referenceId?: string,
  ): Promise<void> {
    const balanceAfter = walletDomain.balance;

    // 1. Cria a entidade de domínio do Ledger e valida invariante aritmética isBalanced()
    const ledgerDomain = WalletLedgerEntry.create({
      walletId: walletDomain.id,
      transactionId: txDomain.id,
      direction: direcao,
      money: valor,
      balanceBefore,
      balanceAfter,
    });

    // 2. Salva lançamento no ledger
    const lancamentoEntity = ledgerRepo.create({
      id: ledgerDomain.id,
      walletId: ledgerDomain.walletId,
      transactionId: ledgerDomain.transactionId,
      direction: ledgerDomain.direction,
      amount: ledgerDomain.money.toString(),
      currency: ledgerDomain.money.currency,
      balanceBefore: ledgerDomain.balanceBefore.toString(),
      balanceAfter: ledgerDomain.balanceAfter.toString(),
      createdAt: ledgerDomain.createdAt,
    });
    await ledgerRepo.save(lancamentoEntity);

    // 3. Atualiza a carteira
    carteiraEntity.balance = walletDomain.balance.toString();
    carteiraEntity.version = walletDomain.version;
    carteiraEntity.updatedAt = walletDomain.updatedAt;
    await carteirasRepo.save(carteiraEntity);

    // 4. Marca transação como processada
    txDomain.markProcessed(referenceId, new Date());
    txEntity.status = txDomain.status;
    txEntity.referenceTransactionId = txDomain.referenceTransactionId ?? null;
    txEntity.processedAt = txDomain.processedAt ?? null;
    await transacoesRepo.save(txEntity);

    // Registra o evento de transação processada na Outbox
    await outboxRepo.save(
      outboxRepo.create({
        aggregateId: txEntity.id,
        eventType: "WagerTransactionProcessed",
        payload: {
          transactionId: txEntity.id,
          providerId: txEntity.providerId,
          externalTransactionId: txEntity.externalTransactionId,
          walletId: walletDomain.id,
          playerId: walletDomain.playerId,
          kind: txEntity.kind,
          status: txEntity.status,
          amount: txEntity.amount,
          currency: txEntity.currency,
          balance: walletDomain.balance.toString(),
        },
      }),
    );

    // Registra o evento de alteração de saldo na Outbox
    await outboxRepo.save(
      outboxRepo.create({
        aggregateId: walletDomain.id,
        eventType: "WalletBalanceChanged",
        payload: {
          walletId: walletDomain.id,
          playerId: walletDomain.playerId,
          currency: walletDomain.balance.currency,
          balanceBefore: balanceBefore.toString(),
          balanceAfter: walletDomain.balance.toString(),
          transactionId: txEntity.id,
        },
      }),
    );
  }
}
