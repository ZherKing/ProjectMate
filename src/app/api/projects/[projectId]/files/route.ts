import { revalidatePath } from "next/cache";
import { currentUserId, fileFailure, readBody, requireSameOrigin } from "@/lib/files/http";
import { FileError, fileLimits, fileUsage, listProjectFiles, requireFileAccess, saveProjectFile } from "@/lib/files/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try { const userId = await currentUserId(), { projectId } = await params; return Response.json({ files: listProjectFiles(projectId, userId), usage: fileUsage(projectId, userId) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return fileFailure(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    requireSameOrigin(request);
    const userId = await currentUserId(), { projectId } = await params;
    requireFileAccess(projectId,userId);
    const body = await readBody(request, fileLimits().maxFileBytes + 1024 * 1024);
    const form = await new Response(new Uint8Array(body), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file"), kind = String(form.get("kind"));
    if (!(file instanceof File) || !["code", "document"].includes(kind)) throw new FileError("请选择有效的文件和分区。");
    const result = saveProjectFile({ projectId, userId, path: String(form.get("path") || file.name), kind: kind as "code" | "document", bytes: Buffer.from(await file.arrayBuffer()) });
    revalidatePath("/projects/files");
    return Response.json({ ok: true, ...result, message: result.unchanged ? "文件内容未变化，已保留当前版本。" : "文件已上传并保存版本。" });
  } catch (error) { return fileFailure(error); }
}
