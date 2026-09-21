import { RoleHomeScreen } from '@/features/dashboard';
import { RoleGate } from '@/features/navigation';

/** This companion route is status-only; it does not implement a holder wallet. */
export default function RiderRoute() {
  return (
    <RoleGate role="RIDER">
      <RoleHomeScreen role="RIDER" />
    </RoleGate>
  );
}
