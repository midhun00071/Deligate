import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@deligate/types';
import type { RiderInput, RiderQuery } from '@deligate/validation';
import { RiderRepository } from './rider.repository';

@Injectable()
export class RiderService {
  constructor(private readonly repository: RiderRepository) {}

  async scope(actor: AuthenticatedActor): Promise<string> {
    if (actor.role !== 'DELIVERY_ADMIN' || !actor.organizationId)
      throw new ForbiddenException('Delivery organization required');
    await this.repository.assertDeliveryCompany(actor.organizationId);
    return actor.organizationId;
  }

  async list(actor: AuthenticatedActor, query: RiderQuery) {
    return this.repository.list(await this.scope(actor), query);
  }

  async create(actor: AuthenticatedActor, input: RiderInput) {
    return this.repository.create(await this.scope(actor), input);
  }

  async find(actor: AuthenticatedActor, id: string) {
    return this.repository.find(await this.scope(actor), id);
  }

  async update(actor: AuthenticatedActor, id: string, input: RiderInput) {
    return this.repository.update(await this.scope(actor), id, input);
  }
}
