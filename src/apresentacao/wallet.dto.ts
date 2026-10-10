
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class InitialBalanceDto {
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsIn(['BRL', 'USD', 'EUR'])
  currency: string;
}

export class CriarWalletDto {
  @IsUUID()
  playerId: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => InitialBalanceDto)
  initialBalance: InitialBalanceDto;
}
