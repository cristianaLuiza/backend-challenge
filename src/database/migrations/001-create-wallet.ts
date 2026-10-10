import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWallet1760000000001 implements MigrationInterface { //Quanto em dinheiro?
  name = 'CreateWallet1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wallet',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'player_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
          },
          {
            name: 'balance',
            type: 'numeric',
            precision: 19,
            scale: 2,
            isNullable: false,
            default: '0',
          },
          {
            name: 'version',
            type: 'integer',
            isNullable: false,
            default: '1',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_wallet_player_currency',
            columnNames: ['player_id', 'currency'],
          },
        ],
        checks: [
          {
            name: 'CK_wallet_balance_non_negative',
            expression: 'balance >= 0',
          },
          {
            name: 'CK_wallet_version_positive',
            expression: 'version >= 1',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('wallet');
  }
}