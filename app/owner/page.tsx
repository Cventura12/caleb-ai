// Protected owner control panel.
// The proxy has already verified the session before this page renders.
// All interaction is handled by the OwnerPanel client component,
// which talks to /api/owner/connectors (also session-gated).

import OwnerPanel from "@/components/OwnerPanel";

export default function OwnerPage() {
  return <OwnerPanel />;
}
