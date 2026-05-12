import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PrismaService {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    this.logger.log('PrismaService initialized (placeholder)');
  }
}
