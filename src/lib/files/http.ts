import { auth } from "@/auth";
import { FileError } from "./store";

export async function currentUserId() { const session = await auth(); if (!session?.user?.id) throw new FileError("请先登录。", 401); return session.user.id; }
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.AUTH_URL) allowed.add(new URL(process.env.AUTH_URL).origin);
  if (!origin || !allowed.has(origin)) throw new FileError("请求来源无效。", 403);
}
export async function readBody(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes) throw new FileError("请求超过大小限制。", 413);
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = []; let total = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; total += part.value.length; if (total > maxBytes) { await reader.cancel(); throw new FileError("请求超过大小限制。", 413); } parts.push(part.value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}
export function fileFailure(error: unknown) {
  if (error instanceof FileError) return Response.json({ message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  console.error("Project file request failed", error instanceof Error ? error.name : "unknown");
  return Response.json({ message: "文件操作未完成，请稍后重试。" }, { status: 500 });
}
