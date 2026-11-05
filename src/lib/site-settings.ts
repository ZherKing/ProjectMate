import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";

const key = createHash("sha256").update(process.env.AUTH_SECRET ?? "projectmate-development-secret").digest();
export type SmtpSettings = { host: string; port: number; secure: boolean; user: string; password: string; fromName: string; fromEmail: string };
export function getSiteSetting(name: string) { initializeDatabase(); return (sqlite.prepare("SELECT value FROM site_settings WHERE key=?").get(name) as { value: string } | undefined)?.value ?? ""; }
export function saveSiteSetting(name: string, value: string) { initializeDatabase(); sqlite.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(name, value, Date.now()); }
export function encryptSetting(value: string) { const iv=randomBytes(12); const cipher=createCipheriv("aes-256-gcm",key,iv); const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]); return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`; }
export function decryptSetting(value: string) { try { const [iv,tag,data]=value.split("."); const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64url")); decipher.setAuthTag(Buffer.from(tag,"base64url")); return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8"); } catch { return ""; } }
export function getSmtpSettings(): SmtpSettings | null { const host=getSiteSetting("smtp.host"); if(!host) return null; return {host,port:Number(getSiteSetting("smtp.port")||587),secure:getSiteSetting("smtp.secure")==="true",user:getSiteSetting("smtp.user"),password:decryptSetting(getSiteSetting("smtp.password")),fromName:getSiteSetting("smtp.fromName")||"ProjectMate",fromEmail:getSiteSetting("smtp.fromEmail")}; }
