import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { accessInputSchema, type AccessInput } from '@deligate/validation';

@Injectable()
export class AccessInputPipe implements PipeTransform<unknown, AccessInput> {
  transform(value: unknown): AccessInput {
    const parsed = accessInputSchema.safeParse(value);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'Check the temporary access scope.',
      });
    return parsed.data;
  }
}
