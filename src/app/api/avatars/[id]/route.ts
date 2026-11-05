import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDatabase();
  const { id } = await params;
  const row = sqlite.prepare("SELECT content, content_type AS type FROM user_avatars WHERE user_id = ?").get(id) as { content: Buffer; type: string } | undefined;
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.content), { headers: { "Content-Type": row.type, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" } });
}
