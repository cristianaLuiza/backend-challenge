import {
  Controller,
  Get,
} from '@nestjs/common';

@Controller('health')
export class HealthController {
  constructor() {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      application: 'up',
    };
  }

}