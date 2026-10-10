
import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixWagerIdempotency1760000000005
  implements MigrationInterface
{
  name = 'FixWagerIdempotency1760000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wager_transaction
      DROP CONSTRAINT IF EXISTS "UQ_wager_idempotency_key";
    `);

    await queryRunner.query(`
      ALTER TABLE wager_transaction
      ADD CONSTRAINT "UQ_wager_provider_idempotency"
      UNIQUE (provider_id, idempotency_key);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wager_transaction
      DROP CONSTRAINT IF EXISTS "UQ_wager_provider_idempotency";
    `);

    await queryRunner.query(`
      ALTER TABLE wager_transaction
      ADD CONSTRAINT "UQ_wager_idempotency_key"
      UNIQUE (idempotency_key);
    `);
  }
}
