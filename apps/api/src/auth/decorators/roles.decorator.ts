import { SetMetadata } from '@nestjs/common';

import type { AppRole } from '@deligate/types';

export const ROLES_METADATA_KEY = 'deligate:roles';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_METADATA_KEY, roles);
