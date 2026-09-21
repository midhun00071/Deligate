import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { verificationInputSchema, type VerificationInput } from '@deligate/validation';

@Injectable()
export class VerificationInputPipe implements PipeTransform<unknown, VerificationInput> {
  transform(value: unknown): VerificationInput {
    const parsed = verificationInputSchema.safeParse(value);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'Check the building and zone.',
      });
    return parsed.data;
  }
}
