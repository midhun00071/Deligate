import type { AppRole } from '@deligate/types';

export const roleHomePath: Record<AppRole, '/delivery' | '/security' | '/rider'> = {
  DELIVERY_ADMIN: '/delivery',
  BUILDING_SECURITY: '/security',
  RIDER: '/rider',
};

export const roleLabels: Record<AppRole, string> = {
  DELIVERY_ADMIN: 'Delivery Admin',
  BUILDING_SECURITY: 'Building Security',
  RIDER: 'Rider companion',
};
