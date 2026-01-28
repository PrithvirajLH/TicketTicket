import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { EmailProcessorService } from './email-processor.service';

const QUEUE_NAME = 'notification-email';

@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<{ outboxId: string }> | null = null;
  private worker: Worker<{ outboxId: string }> | null = null;
  private connection: IORedis | null = null;
  private enabled = true;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: EmailProcessorService,
  ) {}

  onModuleInit() {
    this.enabled =
      this.config.get<string>('NOTIFICATIONS_QUEUE_ENABLED') !== 'false';
    if (!this.enabled) {
      return;
    }

    const redisUrl = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST') ?? '127.0.0.1';
    const port = Number(this.config.get<string>('REDIS_PORT') ?? '6379');
    const password = this.config.get<string>('REDIS_PASSWORD');

    this.connection = redisUrl
      ? new IORedis(redisUrl, { maxRetriesPerRequest: null })
      : new IORedis({ host, port, password, maxRetriesPerRequest: null });

    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        await this.processor.process(job.data.outboxId);
      },
      { connection: this.connection, concurrency: 4 },
    );

    this.worker.on('failed', (job, error) => {
      console.error('Email job failed', job?.id, error);
    });
  }

  async enqueue(outboxId: string) {
    if (!this.enabled) {
      await this.processor.process(outboxId);
      return;
    }

    if (!this.queue) {
      await this.processor.process(outboxId);
      return;
    }

    await this.queue.add(
      'send',
      { outboxId },
      { attempts: 5, backoff: { type: 'exponential', delay: 10000 } },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
