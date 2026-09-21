import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { riderInputSchema, riderQuerySchema, revokeInputSchema } from '@deligate/validation';
import type { ZodType, ZodTypeDef } from 'zod';

export class IssuerDtoPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'Check the permitted fields and input limits.',
      });
    return parsed.data;
  }
}

@Injectable()
export class RiderInputPipe extends IssuerDtoPipe<ReturnType<typeof riderInputSchema.parse>> {
  constructor() {
    super(riderInputSchema);
  }
}
@Injectable()
export class RiderQueryPipe extends IssuerDtoPipe<ReturnType<typeof riderQuerySchema.parse>> {
  constructor() {
    super(riderQuerySchema);
  }
}
@Injectable()
export class RevokeInputPipe extends IssuerDtoPipe<ReturnType<typeof revokeInputSchema.parse>> {
  constructor() {
    super(revokeInputSchema);
  }
}
