import type { Request } from 'express';

import type { AuthenticatedActor } from '@deligate/types';

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor;
}
