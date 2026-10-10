import { Injectable } from "@nestjs/common";
import { WalletEntity } from "./wallet.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly banco: Repository<WalletEntity>,
  ) {}

   async buscarPorId(id: string): Promise<WalletEntity | null> {
    return this.banco.findOne({
      where: { id },
    });
  }

 async buscarPorJogador(
    playerId: string,
  ): Promise<WalletEntity | null> {
    return this.banco.findOne({
      where: { playerId },
    });
  }

  async salvar(wallet: WalletEntity): Promise<WalletEntity>{
    return this.banco.save(wallet);
  }

 async criar(dados: {
  playerId: string;
  currency: string;
}): Promise<WalletEntity> {
  const wallet = this.banco.create({
    playerId: dados.playerId,
    currency: dados.currency,
    balance: '0.00',
    version: 1,
  });

  return this.banco.save(wallet);
}

async buscarPorJogadorEMoeda(
  playerId: string,
  currency: string,
): Promise<WalletEntity | null> {
  return this.banco.findOne({
    where: {
      playerId,
      currency,
    },
  });
}
}