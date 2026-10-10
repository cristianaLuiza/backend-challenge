import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { WageringService } from '../aplicacoes/wagering.service';
import { SubmitWagerTransactionDto } from './criar-aposta.dto';
import { computeCanonicalPayloadHash } from '../utils/canonical-json';

@Controller('wagering/transactions')
export class WageringController {
  constructor(private readonly wageringService: WageringService) {}

  @Post()
  async criar(
    @Body() dados: SubmitWagerTransactionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException(
        'O cabeçalho Idempotency-Key é obrigatório.',
      );
    }

    // Hash de JSON canônico apenas dos campos de negócio
    const businessPayload = {
      amount: dados.money.amount,
      currency: dados.money.currency,
      externalTransactionId: dados.externalTransactionId,
      gameId: dados.gameId,
      kind: dados.kind,
      playerId: dados.playerId,
      providerId: dados.providerId,
      referenceExternalTransactionId:
        dados.referenceExternalTransactionId ?? null,
      roundId: dados.roundId,
      walletId: dados.walletId,
    };

    const payloadHash = computeCanonicalPayloadHash(businessPayload);

    return this.wageringService.processarTransacao({
      ...dados,
      idempotencyKey: idempotencyKey.trim(),
      payloadHash,
    });
  }
}
