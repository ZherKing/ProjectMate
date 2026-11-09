import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, openSync, closeSync, writeSync } from "node:fs";
import { resolve, join } from "node:path";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { getProjectAccess } from "@/lib/db/project-members";

export type FileKind = "document" | "code";
export class FileError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type ProjectFile = {
  id: string; projectId: string; kind: FileKind; path: string; ownerId: string; ownerName: string | null;
  versionId: string; version: number; size: number; mime: string; uploaderId: string; uploaderName: string | null; updatedAt: number;
};
export type FileVersion = { id: string; version: number; size: number; mime: string; uploaderId: string; uploaderName: string | null; createdAt: number; sha256: string };
const MB = 1024 * 1024;
function limit(name: string, fallback: number) { const value = Number(process.env[name]); return (Number.isFinite(value) && value > 0 ? Math.min(value, 1024) : fallback) * MB; }
export function fileLimits() { return { maxFileBytes: limit("PROJECT_FILE_MAX_MB", 20), maxProjectBytes: limit("PROJECT_STORAGE_MAX_MB", 500) }; }
function root() { const dir = join(resolve(process.env.STORAGE_PATH || "./storage"), "project-files"); mkdirSync(dir, { recursive: true, mode: 0o700 }); return dir; }
function diskPath(key: string) { if (!/^[a-f0-9-]{36}(\.part)?$/.test(key)) throw new FileError("文件存储标识无效。", 500); return join(root(), key); }
function removeBlob(key: string) { try { unlinkSync(diskPath(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("File cleanup failed", (error as NodeJS.ErrnoException).code); } }
export function requireFileAccess(projectId: string, userId: string) { const role = getProjectAccess(projectId, userId); if (!role) throw new FileError("没有当前项目的文件访问权限。", 403); return role; }
export function normalizeFilePath(input: string) {
  const path = input.normalize("NFC");
  if (!path || path.length > 500 || path.split("/").length > 20 || /[\\\u0000-\u001f<>:"|?*]/.test(path) || path.startsWith("/") || path.split("/").some(p => !p || p === "." || p === ".." || p.length > 150 || p !== p.trim())) throw new FileError("文件路径无效，请使用正常的相对目录和文件名。");
  if (path.split("/").some(p => [".git", "node_modules", ".next"].includes(p) || /^\.env(?:\.|$)/i.test(p) && p !== ".env.example")) throw new FileError("不能上传依赖、Git目录或包含密钥的环境文件。");
  return path;
}
const codeExtensions = new Set("ts tsx js jsx mjs cjs json jsonc py java go rs c cc cpp h hpp cs swift kt kts php rb r sh bash zsh ps1 css scss sass less html htm vue svelte sql yaml yml toml ini conf xml svg graphql gql proto ipynb md markdown txt csv lock gitignore editorconfig example".split(" "));
const textDocuments = new Set(["txt", "md", "markdown", "csv"]);
function extension(path: string) { return path.split("/").pop()!.split(".").pop()!.toLowerCase(); }
export function validateFileBytes(kind: FileKind, path: string, bytes: Buffer) {
  if (!bytes.length && kind !== "code") throw new FileError("不能上传空文档。");
  if (bytes.length > fileLimits().maxFileBytes) throw new FileError("文件超过单文件大小限制。", 413);
  const ext = extension(path);
  const text = () => { try { const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); if (content.includes("\0")) throw new Error(); } catch { throw new FileError("请选择 UTF-8 编码的文本或代码文件。"); } return "text/plain; charset=utf-8"; };
  if (kind === "code") {
    const name = path.split("/").pop()!.toLowerCase();
    if (!codeExtensions.has(ext) && !["dockerfile", "makefile", "license", ".gitignore", ".editorconfig"].includes(name)) throw new FileError("暂不支持这种代码文件类型。");
    return text();
  }
  if (textDocuments.has(ext)) return text();
  if (ext === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (ext === "png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (["jpg", "jpeg"].includes(ext) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (ext === "webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (["docx", "xlsx", "pptx"].includes(ext) && bytes.subarray(0, 4).equals(Buffer.from([80,75,3,4]))) return "application/octet-stream";
  if (["doc", "xls", "ppt"].includes(ext) && bytes.subarray(0, 8).equals(Buffer.from([208,207,17,224,161,177,26,225]))) return "application/octet-stream";
  throw new FileError("文件类型不支持，或文件内容与扩展名不符。");
}
function init() { initializeDatabase(); }
export function listProjectFiles(projectId: string, userId: string): ProjectFile[] {
  requireFileAccess(projectId, userId);
  return sqlite.prepare(`SELECT f.id, f.project_id AS projectId, f.kind, f.path, f.owner_id AS ownerId, owner.name AS ownerName,
    v.id AS versionId, v.version, v.size, v.mime, v.uploader_id AS uploaderId, uploader.name AS uploaderName, v.created_at AS updatedAt
    FROM project_files f JOIN project_file_versions v ON v.id=f.latest_version_id
    LEFT JOIN users owner ON owner.id=f.owner_id LEFT JOIN users uploader ON uploader.id=v.uploader_id
    WHERE f.project_id=? ORDER BY v.created_at DESC, f.path ASC`).all(projectId) as ProjectFile[];
}
export function fileUsage(projectId: string, userId: string) {
  requireFileAccess(projectId, userId);
  const row = sqlite.prepare("SELECT COALESCE(SUM(v.size),0) AS used FROM project_file_versions v JOIN project_files f ON f.id=v.file_id WHERE f.project_id=?").get(projectId) as { used: number };
  return { usedBytes: row.used, ...fileLimits() };
}
function getFile(projectId: string, userId: string, fileId: string) {
  const role = requireFileAccess(projectId, userId);
  const file = sqlite.prepare("SELECT id, owner_id AS ownerId, path, kind FROM project_files WHERE id=? AND project_id=?").get(fileId, projectId) as { id: string; ownerId: string; path: string; kind: FileKind } | undefined;
  if (!file) throw new FileError("文件不存在或已删除。", 404);
  return { file, role };
}
function requireWrite(projectId: string, userId: string, path: string, kind: FileKind) {
  const role = requireFileAccess(projectId, userId);
  const old = sqlite.prepare("SELECT id, owner_id AS ownerId, latest_version_id AS latestVersionId FROM project_files WHERE project_id=? AND path=? AND kind=?").get(projectId, path, kind) as { id: string; ownerId: string; latestVersionId: string } | undefined;
  if (!old && kind === "code") {
    const paths = sqlite.prepare("SELECT path FROM project_files WHERE project_id=? AND kind='code'").all(projectId) as Array<{path:string}>;
    if (paths.some(file => path.startsWith(file.path+"/") || file.path.startsWith(path+"/"))) throw new FileError("同一路径不能同时是代码文件和目录。");
  }
  if (old && old.ownerId !== userId && role === "成员") throw new FileError("只能为自己上传的文件提交新版本。", 403);
  return old;
}
export function pruneExpiredUploads() {
  init();
  const expired = sqlite.prepare("SELECT id,storage_key AS key FROM project_file_uploads WHERE expires_at<? LIMIT 100").all(Date.now()) as Array<{ id: string; key: string }>;
  for (const item of expired) { sqlite.prepare("DELETE FROM project_file_uploads WHERE id=?").run(item.id); removeBlob(item.key); }
}
function available(projectId: string, userId: string, bytes: number, exceptUpload = "") {
  const usage = fileUsage(projectId, userId);
  const pending = sqlite.prepare("SELECT COALESCE(SUM(expected_size),0) AS reserved FROM project_file_uploads WHERE project_id=? AND id<>? AND expires_at>?").get(projectId, exceptUpload, Date.now()) as { reserved: number };
  if (usage.usedBytes + pending.reserved + bytes > usage.maxProjectBytes) throw new FileError("项目存储空间不足，历史版本也会占用空间。", 413);
}
export function saveProjectFile(input: { projectId: string; userId: string; path: string; kind: FileKind; bytes: Buffer; uploadId?: string }) {
  requireFileAccess(input.projectId,input.userId);
  const path = normalizeFilePath(input.path);
  if (input.kind !== "document" && input.kind !== "code") throw new FileError("请选择文档区或代码区。");
  const mime = validateFileBytes(input.kind, path, input.bytes);
  pruneExpiredUploads();
  let newKey: string | null = null;
  try {
    return sqlite.transaction(() => {
      const old = requireWrite(input.projectId, input.userId, path, input.kind);
      const sha256 = createHash("sha256").update(input.bytes).digest("hex");
      if (old) {
        const latest = sqlite.prepare("SELECT sha256, version FROM project_file_versions WHERE id=?").get(old.latestVersionId) as { sha256: string; version: number };
        if (latest.sha256 === sha256) return { fileId: old.id, versionId: old.latestVersionId, version: latest.version, unchanged: true };
      }
      available(input.projectId, input.userId, input.bytes.length, input.uploadId);
      const count = sqlite.prepare("SELECT COUNT(*) AS count FROM project_files WHERE project_id=?").get(input.projectId) as { count: number };
      if (!old && count.count >= 1000) throw new FileError("单项目最多保存 1000 个文件。");
      const fileId = old?.id || randomUUID(), versionId = randomUUID();
      const row = sqlite.prepare("SELECT COALESCE(MAX(version),0) AS version FROM project_file_versions WHERE file_id=?").get(fileId) as { version: number };
      if (row.version >= 100) throw new FileError("此文件已有 100 个版本，请另存新文件。");
      const version = row.version + 1;
      newKey = randomUUID();
      writeFileSync(diskPath(newKey), input.bytes, { flag: "wx", mode: 0o600 });
      if (!old) sqlite.prepare("INSERT INTO project_files(id,project_id,kind,path,owner_id,latest_version_id,created_at) VALUES(?,?,?,?,?,?,?)").run(fileId, input.projectId, input.kind, path, input.userId, versionId, Date.now());
      sqlite.prepare("INSERT INTO project_file_versions(id,file_id,version,uploader_id,size,mime,sha256,storage_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(versionId, fileId, version, input.userId, input.bytes.length, mime, sha256, newKey, Date.now());
      sqlite.prepare("UPDATE project_files SET latest_version_id=? WHERE id=?").run(versionId, fileId);
      return { fileId, versionId, version, unchanged: false };
    })();
  } catch (error) { if (newKey) removeBlob(newKey); throw error; }
}
export function listFileVersions(projectId: string, userId: string, fileId: string): FileVersion[] {
  getFile(projectId, userId, fileId);
  return sqlite.prepare(`SELECT v.id,v.version,v.size,v.mime,v.sha256,v.uploader_id AS uploaderId,u.name AS uploaderName,v.created_at AS createdAt
    FROM project_file_versions v LEFT JOIN users u ON u.id=v.uploader_id WHERE v.file_id=? ORDER BY v.version DESC`).all(fileId) as FileVersion[];
}
export function readProjectFile(projectId: string, userId: string, fileId: string, versionId?: string) {
  const { file } = getFile(projectId, userId, fileId);
  const version = sqlite.prepare("SELECT id,storage_key AS key,mime,size,version,sha256 FROM project_file_versions WHERE file_id=? AND (?='' OR id=?) ORDER BY version DESC LIMIT 1").get(fileId, versionId || "", versionId || "") as { id: string; key: string; mime: string; size: number; version: number; sha256: string } | undefined;
  if (!version) throw new FileError("文件版本不存在。", 404);
  let bytes: Buffer;
  try { bytes = readFileSync(diskPath(version.key)); } catch { throw new FileError("文件内容暂不可用，请联系项目管理员。", 404); }
  return { file, version: { id: version.id, mime: version.mime, size: version.size, version: version.version, sha256: version.sha256 }, bytes };
}
export function deleteProjectFile(projectId: string, userId: string, fileId: string) {
  const keys = sqlite.transaction(() => {
    const { file, role } = getFile(projectId, userId, fileId);
    if (file.ownerId !== userId && role === "成员") throw new FileError("只能删除自己上传的文件。", 403);
    const versions = sqlite.prepare("SELECT storage_key AS key FROM project_file_versions WHERE file_id=?").all(fileId) as Array<{ key: string }>;
    sqlite.prepare("DELETE FROM project_file_versions WHERE file_id=?").run(fileId);
    sqlite.prepare("DELETE FROM project_files WHERE id=?").run(fileId);
    return versions;
  })();
  keys.forEach(item => removeBlob(item.key));
}
export function beginFileUpload(input: { projectId: string; userId: string; path: string; kind: FileKind; size: number }) {
  const path = normalizeFilePath(input.path);
  if (input.kind !== "code" && input.kind !== "document") throw new FileError("文件分区无效。");
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > fileLimits().maxFileBytes) throw new FileError("文件大小无效或超过单文件限制。", 413);
  pruneExpiredUploads();
  return sqlite.transaction(() => {
    requireWrite(input.projectId, input.userId, path, input.kind);
    available(input.projectId, input.userId, input.size);
    const count = sqlite.prepare("SELECT COUNT(*) AS count FROM project_file_uploads WHERE uploader_id=?").get(input.userId) as { count: number };
    if (count.count >= 10) throw new FileError("同时上传的文件过多，请先完成已有上传。", 429);
    const id = randomUUID(), key = randomUUID() + ".part", expiresAt = Date.now() + 15 * 60 * 1000;
    writeFileSync(diskPath(key), Buffer.alloc(0), { flag: "wx", mode: 0o600 });
    try { sqlite.prepare("INSERT INTO project_file_uploads(id,project_id,uploader_id,path,kind,expected_size,received,storage_key,expires_at) VALUES(?,?,?,?,?,?,0,?,?)").run(id, input.projectId, input.userId, path, input.kind, input.size, key, expiresAt); }
    catch (error) { removeBlob(key); throw error; }
    return { uploadId: id, expiresAt, chunkMaxBytes: 512 * 1024 };
  })();
}
function uploadRow(projectId: string, userId: string, uploadId: string) {
  requireFileAccess(projectId, userId);
  const row = sqlite.prepare("SELECT id,path,kind,expected_size AS size,received,storage_key AS key,expires_at AS expiresAt FROM project_file_uploads WHERE id=? AND project_id=? AND uploader_id=?").get(uploadId, projectId, userId) as { id: string; path: string; kind: FileKind; size: number; received: number; key: string; expiresAt: number } | undefined;
  if (!row || row.expiresAt <= Date.now()) throw new FileError("上传已过期或不存在，请重新开始。", 404);
  return row;
}
export function appendFileChunk(projectId: string, userId: string, uploadId: string, offset: number, bytes: Buffer) {
  if (!bytes.length || bytes.length > 512 * 1024 || !Number.isSafeInteger(offset) || offset < 0) throw new FileError("分片大小或偏移无效。");
  return sqlite.transaction(() => {
    const row = uploadRow(projectId, userId, uploadId);
    if (offset < row.received && offset + bytes.length <= row.received && readFileSync(diskPath(row.key)).subarray(offset, offset + bytes.length).equals(bytes)) return { receivedBytes: row.received, totalBytes: row.size };
    if (offset !== row.received || offset + bytes.length > row.size) throw new FileError("分片顺序或大小不符，请从已接收的偏移继续。");
    const fd = openSync(diskPath(row.key), "r+");
    try { let written = 0; while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written, offset + written); } finally { closeSync(fd); }
    const received = offset + bytes.length;
    sqlite.prepare("UPDATE project_file_uploads SET received=? WHERE id=?").run(received, row.id);
    return { receivedBytes: received, totalBytes: row.size };
  })();
}
export function finishFileUpload(projectId: string, userId: string, uploadId: string, sha256?: string) {
  const row = uploadRow(projectId, userId, uploadId);
  if (row.received !== row.size) throw new FileError("文件分片尚未上传完整。");
  const bytes = readFileSync(diskPath(row.key));
  if (bytes.length !== row.size || sha256 && createHash("sha256").update(bytes).digest("hex") !== sha256.toLowerCase()) throw new FileError("文件校验不一致，请重新上传。");
  const result = saveProjectFile({ projectId, userId, kind: row.kind, path: row.path, bytes, uploadId });
  sqlite.prepare("DELETE FROM project_file_uploads WHERE id=?").run(uploadId);
  removeBlob(row.key);
  return result;
}
export function decodeBase64(value: string, maxBytes = 1024 * 1024) {
  if (value.length > Math.ceil(maxBytes / 3) * 4 + 4 || (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))) throw new FileError("Base64 数据无效或超过大小限制。");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new FileError("Base64 数据无效。");
  if (bytes.length > maxBytes) throw new FileError("文件分片超过大小限制。", 413);
  return bytes;
}
export function cancelFileUpload(projectId: string, userId: string, uploadId: string) {
  const row = uploadRow(projectId, userId, uploadId);
  sqlite.prepare("DELETE FROM project_file_uploads WHERE id=?").run(uploadId); removeBlob(row.key);
  return { cancelled: true };
}

export function removeStoredProjectBlobs(keys:readonly string[]){keys.forEach(key=>removeBlob(key));}
