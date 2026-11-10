import { captchaConfig, verifyCaptcha, type CaptchaProof } from "@/lib/security/geetest";
import { SecurityError } from "@/lib/security/error";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
function failure(error: unknown) {
  if (error instanceof SecurityError) return Response.json({ ok: false, message: error.message, code: error.code }, { status: error.status, headers });
  return Response.json({ ok: false, message: "人机验证暂不可用，请稍后重试。", code: "captcha_unavailable" }, { status: 503, headers });
}
export async function GET() {
  try { return Response.json(captchaConfig(), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    // Kept local to avoid importing auth-dependent HTTP helpers back into the auth module.
    const origin = request.headers.get("origin"), allowed = new Set([new URL(request.url).origin]);
    if (process.env.AUTH_URL) allowed.add(new URL(process.env.AUTH_URL).origin);
    if (!origin || !allowed.has(origin)) throw new SecurityError("请求来源无效。", 403);
    const length = Number(request.headers.get("content-length"));
    if (length > 24_576) throw new SecurityError("验证参数过长。", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new SecurityError("验证参数无效。");
    const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        total += part.value.length;
        if (total > 24_576) { await reader.cancel(); throw new SecurityError("验证参数过长。", 413); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    let body: CaptchaProof;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new SecurityError("验证参数无效。"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new SecurityError("验证参数无效。");
    // No trusted proxy setting exists: forwarded headers are client-controlled here.
    // Use a site-wide cap plus the per-subject cap instead of trusting a spoofable IP.
    return Response.json(await verifyCaptcha(body, "public"), { headers });
  } catch (error) { return failure(error); }
}
