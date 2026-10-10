import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateWagerTransaction1760000000002 implements MigrationInterface { //O que aconteceu?
  name = 'CreateWagerTransaction1760000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wager_transaction',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'provider_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'external_transaction_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'payload_hash',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'wallet_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'player_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'round_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'game_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'kind',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 19,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
          },
          {
            name: 'reference_external_transaction_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'reference_transaction_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            isNullable: false,
            default: "'PENDING'",
          },
          {
            name: 'failure_code',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'processed_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_wager_provider_external',
            columnNames: ['provider_id', 'external_transaction_id'],
          },
          {
            name: 'UQ_wager_idempotency_key',
            columnNames: ['idempotency_key'],
          },
        ],
        checks: [
          {
            name: 'CK_wager_amount_positive',
            expression: 'amount > 0',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'wager_transaction',
      new TableForeignKey({
        name: 'FK_wager_wallet',
        columnNames: ['wallet_id'],
        referencedTableName: 'wallet',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('wager_transaction');
  }
}