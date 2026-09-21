import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { EidStackError } from '@deligate/eidstack';
import type { Response } from 'express';

@Catch(EidStackError)
export class IssuerErrorFilter implements ExceptionFilter<EidStackError> {
  catch(error: EidStackError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(503)
      .json({ code: error.code, message: error.message });
  }
}
