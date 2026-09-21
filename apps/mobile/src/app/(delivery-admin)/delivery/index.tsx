import { RoleHomeScreen } from '@/features/dashboard';
import { RoleGate } from '@/features/navigation';

export default function DeliveryAdminRoute() {
  return (
    <RoleGate role="DELIVERY_ADMIN">
      <RoleHomeScreen role="DELIVERY_ADMIN" />
    </RoleGate>
  );
}
