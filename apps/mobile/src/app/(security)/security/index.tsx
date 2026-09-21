import { RoleHomeScreen } from '@/features/dashboard';
import { RoleGate } from '@/features/navigation';

export default function SecurityRoute() {
  return (
    <RoleGate role="BUILDING_SECURITY">
      <RoleHomeScreen role="BUILDING_SECURITY" />
    </RoleGate>
  );
}
