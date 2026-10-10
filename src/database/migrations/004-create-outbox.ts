import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateOutbox1760000000004 implements MigrationInterface { //O que preciso publicar/processar sem perder ou duplicar?
  name = 'CreateOutbox1760000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inbox_message',
        columns: [
          {
            name: 'message_id',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'consumer_name',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'payload_hash',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'received_at',
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
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'outbox_message',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'aggregate_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'occurred_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'attempts',
            type: 'integer',
            isNullable: false,
            default: '0',
          },
          {
            name: 'next_attempt_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'published_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
        checks: [
          {
            name: 'CK_outbox_attempts_non_negative',
            expression: 'attempts >= 0',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'outbox_message',
      new TableIndex({
        name: 'IDX_outbox_pending',
        columnNames: ['published_at', 'next_attempt_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('outbox_message');
    await queryRunner.dropTable('inbox_message');
  }
}