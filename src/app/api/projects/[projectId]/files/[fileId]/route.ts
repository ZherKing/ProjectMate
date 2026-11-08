import { revalidatePath } from "next/cache";
import { currentUserId, fileFailure, requireSameOrigin } from "@/lib/files/http";
import { deleteProjectFile, listFileVersions, readProjectFile } from "@/lib/files/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const language: Record<string,string> = { ts:"typescript",tsx:"tsx",js:"javascript",jsx:"jsx",mjs:"javascript",cjs:"javascript",json:"json",jsonc:"jsonc",py:"python",java:"java",go:"go",rs:"rust",c:"c",cpp:"cpp",h:"c",hpp:"cpp",cs:"csharp",swift:"swift",kt:"kotlin",php:"php",rb:"ruby",r:"r",sh:"bash",bash:"bash",zsh:"bash",css:"css",scss:"scss",html:"html",htm:"html",vue:"vue",svelte:"svelte",sql:"sql",yaml:"yaml",yml:"yaml",toml:"toml",xml:"xml",svg:"xml",md:"markdown",graphql:"graphql",proto:"proto" };
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string; fileId: string }> }) {
  try {
    const userId = await currentUserId(), { projectId, fileId } = await params, query = new URL(request.url).searchParams;
    if (query.has("versions")) return Response.json({ versions: listFileVersions(projectId, userId, fileId) }, { headers: { "Cache-Control": "no-store" } });
    const { file, version, bytes } = readProjectFile(projectId, userId, fileId, query.get("version") || undefined);
    if (query.has("download") || query.has("inline")) {
      const inline = query.has("inline") && (version.mime === "application/pdf" || version.mime.startsWith("image/"));
      const name = encodeURIComponent(file.path.split("/").pop()!).replace(/['()*]/g, c=>`%${c.charCodeAt(0).toString(16)}`);
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": inline ? version.mime : "application/octet-stream", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${name}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'", "Vary": "Cookie" } });
    }
    const ext = file.path.split(".").pop()!.toLowerCase();
    const fullText = version.mime.startsWith("text/") ? bytes.toString("utf8") : null;
    let text = fullText?.slice(0,200000) ?? null;
    if (file.kind === "code" && text !== null) text = text.split("\n",5001).slice(0,5000).join("\n");
    let html: string | null = null;
    if (file.kind === "code" && text !== null) {
      const { codeToHtml } = await import("shiki");
      html = await codeToHtml(text, { lang: language[ext] || "text", theme: "github-light", tokenizeMaxLineLength: 2000 });
    }
    return Response.json({ version, text, html, truncated: text !== null && fullText !== null && fullText.length > text.length, markdown: file.kind === "document" && ["md","markdown"].includes(ext) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fileFailure(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string; fileId: string }> }) {
  try { requireSameOrigin(request); const userId = await currentUserId(), { projectId, fileId } = await params; deleteProjectFile(projectId, userId, fileId); revalidatePath("/projects/files"); return Response.json({ ok: true }); } catch (error) { return fileFailure(error); }
}
