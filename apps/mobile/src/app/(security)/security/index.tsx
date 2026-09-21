import { SecurityVerifierScreen } from '@/features/verification';
import { AppShell, RoleGate } from '@/features/navigation';

export default function SecurityRoute() {
  return (
    <RoleGate role="BUILDING_SECURITY">
      <AppShell role="BUILDING_SECURITY">
        <SecurityVerifierScreen />
      </AppShell>
    </RoleGate>
  );
}
