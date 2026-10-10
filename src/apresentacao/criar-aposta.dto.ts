import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WagerTransactionKind } from '../domain/wager-transaction/wager-transaction';

export class MoneyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount deve ser um valor decimal com até duas casas decimais.',
  })
  amount: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency deve ser um código ISO-4217 de 3 letras maiúsculas.',
  })
  currency: string;
}

export class SubmitWagerTransactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  providerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  externalTransactionId: string;

  @IsUUID()
  walletId: string;

  @IsUUID()
  playerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  roundId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  gameId: string;

  @IsEnum(WagerTransactionKind, {
    message:
      'kind deve ser um dos seguintes: BET, WIN, LOSS, REFUND, ROLLBACK.',
  })
  kind: WagerTransactionKind;

  @ValidateNested()
  @Type(() => MoneyDto)
  money: MoneyDto;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referenceExternalTransactionId?: string;
}

export { SubmitWagerTransactionDto as CriarApostaDto };
