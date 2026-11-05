import { auth } from "@/auth";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { getProfile, saveProfile } from "@/lib/db/profile";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "请先登录。" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return Response.json({ message: "请求来源无效。" }, { status: 403 });
  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const school = String(form.get("school") || "").trim();
    const skills = String(form.get("skills") || "").trim();
    if (!name || name.length > 40 || school.length > 120 || skills.length > 500) return Response.json({ message: "昵称需为 1—40 字，学校不超过 120 字，技能不超过 500 字。" }, { status: 400 });
    const file = form.get("avatar");
    let avatar: { bytes: Buffer; type: string } | null = null;
    if (file instanceof File && file.size) {
      if (file.size > 2 * 1024 * 1024) return Response.json({ message: "头像不能超过 2MB。" }, { status: 400 });
      const bytes = Buffer.from(await file.arrayBuffer());
      const type = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg"
        : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP" ? "image/webp" : "";
      if (!type) return Response.json({ message: "请选择 PNG、JPEG 或 WebP 图片。" }, { status: 400 });
      avatar = { bytes, type };
    }
    initializeDatabase();
    const userId = session.user.id;
    sqlite.transaction(() => {
      const old = getProfile(userId);
      sqlite.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
      saveProfile(userId, { school, skills, education: old?.education ?? null, roles: old?.roles ?? null, interests: old?.interests ?? null, weeklyHours: old?.weeklyHours ?? null });
      if (avatar) sqlite.prepare("INSERT INTO user_avatars VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET content=excluded.content, content_type=excluded.content_type, updated_at=excluded.updated_at").run(userId, avatar.bytes, avatar.type, Date.now());
    })();
    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch { return Response.json({ message: "保存未完成，请稍后重试。" }, { status: 500 }); }
}
