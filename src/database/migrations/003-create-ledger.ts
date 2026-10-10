import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateLedger1760000000003 implements MigrationInterface { //Como meu saldo chegou aqui?
  name = 'CreateLedger1760000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wallet_ledger_entry',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'wallet_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'transaction_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'direction',
            type: 'varchar',
            length: '10',
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
            name: 'balance_before',
            type: 'numeric',
            precision: 19,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balance_after',
            type: 'numeric',
            precision: 19,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_ledger_transaction',
            columnNames: ['transaction_id'],
          },
        ],
        checks: [
          {
            name: 'CK_ledger_amount_positive',
            expression: 'amount > 0',
          },
          {
            name: 'CK_ledger_balance_before_non_negative',
            expression: 'balance_before >= 0',
          },
          {
            name: 'CK_ledger_balance_after_non_negative',
            expression: 'balance_after >= 0',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'wallet_ledger_entry',
      new TableForeignKey({
        name: 'FK_ledger_wallet',
        columnNames: ['wallet_id'],
        referencedTableName: 'wallet',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'wallet_ledger_entry',
      new TableForeignKey({
        name: 'FK_ledger_transaction',
        columnNames: ['transaction_id'],
        referencedTableName: 'wager_transaction',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('wallet_ledger_entry');
  }
}