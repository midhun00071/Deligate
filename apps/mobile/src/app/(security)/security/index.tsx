import { SecurityVerifierScreen } from '@/features/verification';
import { RoleGate } from '@/features/navigation';

export default function SecurityRoute() {
  return (
    <RoleGate role="BUILDING_SECURITY">
      <SecurityVerifierScreen />
    </RoleGate>
  );
}
