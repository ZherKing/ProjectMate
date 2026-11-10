import { createHash, createHmac, randomBytes } from "node:crypto";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { SecurityError } from "./error";

const purposes = ["login", "register", "email-send", "email-login", "github"] as const;
export type CaptchaPurpose = typeof purposes[number];
export type CaptchaProof = {
  purpose: CaptchaPurpose;
  subject: string;
  lot_number: string;
  captcha_output: string;
  pass_token: string;
  gen_time: string;
};
const ttl = 5 * 60_000;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

function config() {
  const enabled = /^(true|1)$/i.test(process.env.GEETEST_ENABLED?.trim() || "");
  if (!enabled) return { enabled: false as const };
  const id = process.env.GEETEST_ID?.trim(), key = process.env.GEETEST_KEY?.trim();
  if (!id || !/^[a-f0-9]{32}$/i.test(id) || !key || key.length > 256) {
    throw new SecurityError("人机验证配置暂不可用，请联系管理员。", 503, "captcha_unavailable");
  }
  return { enabled: true as const, id, key };
}

export function geetestConfig() {
  const value = config();
  return value.enabled ? { enabled: true as const, captchaId: value.id } : { enabled: false as const };
}

export const captchaConfig = geetestConfig;

function binding(purpose: unknown, subject: unknown) {
  if (!purposes.includes(purpose as CaptchaPurpose) || typeof subject !== "string") {
    throw new SecurityError("人机验证用途无效。", 400, "captcha_invalid");
  }
  const normalized = subject.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || (purpose === "github" ? normalized !== "github" : !/^\S+@\S+\.\S+$/.test(normalized))) {
    throw new SecurityError("请先填写有效登录邮箱。", 400, "captcha_invalid");
  }
  return { purpose: purpose as CaptchaPurpose, subjectHash: digest(normalized) };
}

function tables() {
  initializeDatabase();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS captcha_lots(hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS captcha_tickets(hash TEXT PRIMARY KEY,purpose TEXT NOT NULL,subject_hash TEXT NOT NULL,captcha_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS captcha_tickets_expiry_idx ON captcha_tickets(expires_at);
  `);
}

function limit(key: string, max: number) {
  const now = Date.now();
  sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM security_limits WHERE expires_at<=?").run(now);
    const row = sqlite.prepare("SELECT count FROM security_limits WHERE key=?").get(key) as { count: number } | undefined;
    if (row && row.count >= max) throw new SecurityError("人机验证尝试较频繁，请稍后重试。", 429, "rate_limited");
    sqlite.prepare("INSERT INTO security_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(key, now + 5 * 60_000);
  }).immediate();
}

/** Validate only with GeeTest's fixed HTTPS endpoint; never trust a client success flag. */
export async function verifyCaptcha(input: CaptchaProof, remoteKey = "unknown") {
  const settings = config();
  if (!settings.enabled) return { ok: true as const, enabled: false as const };
  const bound = binding(input?.purpose, input?.subject);
  const { lot_number: lot, captcha_output: output, pass_token: pass, gen_time: generated } = input;
  if (typeof lot !== "string" || !/^[a-f0-9]{32}$/i.test(lot)
    || typeof output !== "string" || !output || output.length > 16_384
    || typeof pass !== "string" || !pass || pass.length > 4096
    || typeof generated !== "string" || !/^\d{10,13}$/.test(generated)) {
    throw new SecurityError("请重新完成人机验证。", 400, "captcha_invalid");
  }
  tables();
  limit("captcha:subject:" + bound.subjectHash, 30);
  limit("captcha:remote:" + digest(remoteKey.slice(0, 200)), 300);
  // Keep a hash of each lot permanently: retries and concurrent requests must not mint multiple tickets.
  const claim = sqlite.prepare("INSERT OR IGNORE INTO captcha_lots(hash,created_at) VALUES(?,?)").run(digest(lot.toLowerCase()), Date.now());
  if (!claim.changes) throw new SecurityError("本次人机验证已使用，请重新验证。", 400, "captcha_replayed");
  const form = new URLSearchParams({
    lot_number: lot, captcha_output: output, pass_token: pass, gen_time: generated,
    sign_token: createHmac("sha256", settings.key).update(lot).digest("hex"),
  });
  let result: unknown;
  try {
    const response = await fetch("https://gcaptcha4.geetest.com/validate?captcha_id=" + encodeURIComponent(settings.id), {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form,
      signal: AbortSignal.timeout(8000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) throw new Error("provider unavailable");
    const body = await response.text();
    if (body.length > 65_536) throw new Error("oversized response");
    result = JSON.parse(body);
  } catch {
    throw new SecurityError("人机验证服务暂不可用，请稍后重试。", 503, "captcha_unavailable");
  }
  if (!result || typeof result !== "object" || (result as { result?: unknown }).result !== "success") {
    throw new SecurityError("人机验证未通过，请重新验证。", 400, "captcha_invalid");
  }
  const args = (result as { captcha_args?: { lot_number?: unknown } }).captcha_args;
  if (args?.lot_number !== undefined && args.lot_number !== lot) {
    throw new SecurityError("人机验证结果不匹配，请重新验证。", 400, "captcha_invalid");
  }
  const ticket = randomBytes(32).toString("hex"), now = Date.now();
  sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM captcha_tickets WHERE expires_at<=?").run(now);
    sqlite.prepare("INSERT INTO captcha_tickets(hash,purpose,subject_hash,captcha_id,expires_at) VALUES(?,?,?,?,?)")
      .run(digest(ticket), bound.purpose, bound.subjectHash, settings.id, now + ttl);
  }).immediate();
  return { ok: true as const, enabled: true as const, ticket, expiresIn: ttl / 1000 };
}

/** Consume before the protected action. No credentials, plaintext email or vendor secret is stored. */
export function consumeCaptcha(ticket: unknown, purpose: CaptchaPurpose, subject: string): void {
  const settings = config();
  if (!settings.enabled) return;
  const bound = binding(purpose, subject);
  if (typeof ticket !== "string" || !/^[a-f0-9]{64}$/.test(ticket)) {
    throw new SecurityError("请先完成人机验证。", 400, "captcha_required");
  }
  tables();
  const consumed = sqlite.transaction(() => {
    const result = sqlite.prepare("DELETE FROM captcha_tickets WHERE hash=? AND purpose=? AND subject_hash=? AND captcha_id=? AND expires_at>?")
      .run(digest(ticket), bound.purpose, bound.subjectHash, settings.id, Date.now());
    return result.changes === 1;
  }).immediate();
  if (!consumed) throw new SecurityError("人机验证已失效，请重新验证。", 400, "captcha_required");
}
