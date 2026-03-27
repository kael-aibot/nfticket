import { PrismaClient, Prisma } from '@prisma/client';
import type { PersistenceAdapter } from '../../../lib/repository';

/**
 * Prisma-backed persistence adapter for PostgreSQL storage.
 * Maps domain collections to Prisma models.
 */
export class PrismaPersistenceAdapter implements PersistenceAdapter {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  async readAll<T extends { id: string }>(collection: string): Promise<T[]> {
    const records = await this.queryCollection(collection);
    return records as T[];
  }

  async writeAll<T extends { id: string }>(collection: string, records: T[]): Promise<void> {
    await this.replaceCollection(collection, records);
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private queryCollection(collection: string): Promise<unknown[]> {
    switch (collection) {
      case 'events':
        return this.prisma.event.findMany();
      case 'orders':
        return this.prisma.order.findMany();
      case 'tickets':
        return this.prisma.ticket.findMany();
      case 'payouts':
        return this.prisma.payout.findMany();
      case 'scans':
        return this.prisma.scan.findMany();
      case 'identities':
        return this.prisma.userIdentity.findMany();
      default:
        throw new Error(`Unknown collection: ${collection}`);
    }
  }

  private async replaceCollection(collection: string, records: unknown[]): Promise<void> {
    // Clear and re-insert for simplicity in this adapter
    // In production, use upsert for better performance
    switch (collection) {
      case 'events':
        await this.prisma.$transaction([
          this.prisma.event.deleteMany(),
          this.prisma.event.createMany({ data: records as Prisma.EventCreateManyInput[] }),
        ]);
        break;
      case 'orders':
        await this.prisma.$transaction([
          this.prisma.order.deleteMany(),
          this.prisma.order.createMany({ data: records as Prisma.OrderCreateManyInput[] }),
        ]);
        break;
      case 'tickets':
        await this.prisma.$transaction([
          this.prisma.ticket.deleteMany(),
          this.prisma.ticket.createMany({ data: records as Prisma.TicketCreateManyInput[] }),
        ]);
        break;
      case 'payouts':
        await this.prisma.$transaction([
          this.prisma.payout.deleteMany(),
          this.prisma.payout.createMany({ data: records as Prisma.PayoutCreateManyInput[] }),
        ]);
        break;
      case 'scans':
        await this.prisma.$transaction([
          this.prisma.scan.deleteMany(),
          this.prisma.scan.createMany({ data: records as Prisma.ScanCreateManyInput[] }),
        ]);
        break;
      case 'identities':
        await this.prisma.$transaction([
          this.prisma.userIdentity.deleteMany(),
          this.prisma.userIdentity.createMany({ data: records as Prisma.UserIdentityCreateManyInput[] }),
        ]);
        break;
      default:
        throw new Error(`Unknown collection: ${collection}`);
    }
  }
}
