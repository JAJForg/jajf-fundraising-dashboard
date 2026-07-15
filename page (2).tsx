import { getSnapshot } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export const revalidate = 900; // 15 minutes

export default async function BoardPage() {
  const snapshot = await getSnapshot();
  return <Dashboard snapshot={snapshot} variant="board" />;
}
