import { DeliveryAdminScreen } from '@/features/issuance/DeliveryAdminScreen';
import { RoleGate } from '@/features/navigation';

export default function DeliveryAdminRoute() {
  return (
    <RoleGate role="DELIVERY_ADMIN">
      <DeliveryAdminScreen />
    </RoleGate>
  );
}
