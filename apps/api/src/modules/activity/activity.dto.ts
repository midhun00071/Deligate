import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { activityQuerySchema, type ActivityQuery } from '@deligate/validation';

@Injectable()
export class ActivityQueryPipe implements PipeTransform<unknown, ActivityQuery> {
  transform(value: unknown): ActivityQuery {
    const parsed = activityQuerySchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Check page and limit.' });
    return parsed.data;
  }
}
