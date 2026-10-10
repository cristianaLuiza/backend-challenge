
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEntity } from './ledger.entity';

@Injectable()
export class LedgerRepository {
  constructor(
    @InjectRepository(LedgerEntity)
    private readonly banco: Repository<LedgerEntity>,
  ) {}

  async buscarPorTransacao(
    transactionId: string,
  ): Promise<LedgerEntity | null> {
    return this.banco.findOne({
      where: { transactionId },
    });
  }

  async listarPorCarteira(
    walletId: string,
  ): Promise<LedgerEntity[]> {
    return this.banco.find({
      where: { walletId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }
}
