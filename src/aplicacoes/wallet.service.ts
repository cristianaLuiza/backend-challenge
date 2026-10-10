import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WalletRepository } from '../infraestrutura/wallet.repository';
import { WalletEntity } from '../infraestrutura/wallet.entity';
import {
  WagerTransactionEntity,
  WagerTransactionKind,
  WagerTransactionStatus,
} from '../infraestrutura/wager-transaction.entity';
import {
  LedgerEntity,
  LedgerDirection,
} from '../infraestrutura/ledger.entity';
import { CriarWalletDto } from '../apresentacao/wallet.dto';
import { Money } from '../domain/money/money';
import { Wallet } from '../domain/wallet/wallet';
import { computeCanonicalPayloadHash } from '../utils/canonical-json';

export interface WalletResponseDto {
  id: string;
  playerId: string;
  balance: {
    amount: string;
    currency: string;
  };
  version: number;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly dataSource: DataSource,
  ) {}

  async buscarPorId(id: string): Promise<WalletResponseDto> {
    const carteira = await this.walletRepository.buscarPorId(id);
    if (!carteira) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    return {
      id: carteira.id,
      playerId: carteira.playerId,
      balance: {
        amount: carteira.balance,
        currency: carteira.currency,
      },
      version: carteira.version,
    };
  }

  async buscarPorJogador(playerId: string) {
    return this.walletRepository.buscarPorJogador(playerId);
  }

  async criar(dados: CriarWalletDto): Promise<WalletResponseDto> {
    const valorInicial = Money.from({
      amount: dados.initialBalance.amount,
      currency: dados.initialBalance.currency,
    });

    if (valorInicial.isNegative()) {
      throw new ConflictException('O saldo inicial não pode ser negativo.');
    }

    return this.dataSource.transaction(async (manager) => {
      const carteiras = manager.getRepository(WalletEntity);
      const transacoes = manager.getRepository(WagerTransactionEntity);
      const ledger = manager.getRepository(LedgerEntity);

      const carteiraExistente = await carteiras.findOne({
        where: {
          playerId: dados.playerId,
          currency: dados.initialBalance.currency,
        },
      });

      if (carteiraExistente) {
        throw new ConflictException(
          'Este jogador já possui uma carteira nesta moeda.',
        );
      }

      // Cria a entidade de domínio Wallet para validar regras de negócio
      const walletDomain = Wallet.open({
        id: crypto.randomUUID(),
        playerId: dados.playerId,
        initialBalance: valorInicial,
      });

      const carteira = carteiras.create({
        id: walletDomain.id,
        playerId: walletDomain.playerId,
        currency: walletDomain.currency,
        balance: walletDomain.balance.toString(),
        version: walletDomain.version,
      });

      await carteiras.save(carteira);

      if (valorInicial.isPositive()) {
        const providerId = 'internal';
        const externalTransactionId = `opening-${carteira.id}`;
        const idempotencyKey = `opening-${carteira.id}`;

        const payloadHash = computeCanonicalPayloadHash({
          amount: valorInicial.toString(),
          currency: dados.initialBalance.currency,
          externalTransactionId,
          gameId: 'system',
          kind: WagerTransactionKind.OPENING,
          playerId: dados.playerId,
          providerId,
          roundId: 'opening-balance',
          walletId: carteira.id,
        });

        const transacao = transacoes.create({
          providerId,
          externalTransactionId,
          idempotencyKey,
          payloadHash,
          walletId: carteira.id,
          playerId: dados.playerId,
          roundId: 'opening-balance',
          gameId: 'system',
          kind: WagerTransactionKind.OPENING,
          amount: valorInicial.toString(),
          currency: dados.initialBalance.currency,
          status: WagerTransactionStatus.PROCESSED,
          referenceExternalTransactionId: null,
          referenceTransactionId: null,
          failureCode: null,
          processedAt: new Date(),
        });

        await transacoes.save(transacao);

        const lancamento = ledger.create({
          walletId: carteira.id,
          transactionId: transacao.id,
          direction: LedgerDirection.CREDIT,
          amount: valorInicial.toString(),
          currency: dados.initialBalance.currency,
          balanceBefore: '0.00',
          balanceAfter: valorInicial.toString(),
        });

        await ledger.save(lancamento);
      }

      return {
        id: carteira.id,
        playerId: carteira.playerId,
        balance: {
          amount: carteira.balance,
          currency: carteira.currency,
        },
        version: carteira.version,
      };
    });
  }
}
