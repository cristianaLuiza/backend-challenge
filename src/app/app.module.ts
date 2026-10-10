/** @format */

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { WalletEntity } from "../infraestrutura/wallet.entity";
import { WalletRepository } from "../infraestrutura/wallet.repository";
import { WalletService } from "../aplicacoes/wallet.service";
import { WalletController } from "../apresentacao/wallet.controller";
import { WagerTransactionEntity } from "../infraestrutura/wager-transaction.entity";
import { LedgerEntity } from "../infraestrutura/ledger.entity";
import { LedgerRepository } from "../infraestrutura/ledger.repository";
import { WageringService } from "../aplicacoes/wagering.service";
import { WageringController } from "../apresentacao/wagering.controller";
import { OutboxEntity } from "src/infraestrutura/outbox.entity";
import { OutboxMessageRepository } from "src/infraestrutura/outbox-message.repository";
import { HealthController } from "src/apresentacao/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("DATABASE_HOST", "localhost"),
        port: Number(configService.get<number>("DATABASE_PORT", 5432)),
        username: configService.get<string>("DATABASE_USER", "jungle"),
        password: configService.get<string>("DATABASE_PASSWORD", "jungle"),
        database: configService.get<string>("DATABASE_NAME", "jungle"),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([
      WalletEntity,
      WagerTransactionEntity,
      LedgerEntity,
      OutboxEntity,
    ]),
  ],
  controllers: [AppController, WalletController, WageringController, HealthController],
  providers: [
    AppService,
    WageringService,
    WalletRepository,
    WalletService,
    LedgerRepository,
    OutboxMessageRepository
  ],
})
export class AppModule {}
