import { getSnapshot } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export const revalidate = 900; // 15 minutes

export default async function TeamPage() {
  const snapshot = await getSnapshot();
  return <Dashboard snapshot={snapshot} variant="team" />;
}
