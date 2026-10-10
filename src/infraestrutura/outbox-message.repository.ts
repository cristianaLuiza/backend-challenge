
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEntity } from './outbox.entity';

@Injectable()
export class OutboxMessageRepository {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly banco: Repository<OutboxEntity>,
  ) {}

}
