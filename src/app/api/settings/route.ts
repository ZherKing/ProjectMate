import sharp from "sharp";
import { fileFailure, readBody, requireSameOrigin } from "@/lib/files/http";
import { auth } from "@/auth";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { getProfile, saveProfile } from "@/lib/db/profile";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ message: "请先登录。" }, { status: 401 });
  try {
    requireSameOrigin(request);
    const form = await new Response(new Uint8Array(await readBody(request,2*1024*1024+65536)),{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
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
      try {
        const metadata=await sharp(bytes,{limitInputPixels:16000000,animated:false}).metadata();
        if(!metadata.width||!metadata.height||!["jpeg","png","webp"].includes(metadata.format||""))throw new Error();
        avatar={bytes:await sharp(bytes,{limitInputPixels:16000000}).rotate().resize(400,400,{fit:"cover"}).webp({quality:88}).toBuffer(),type:"image/webp"};
      }catch{return Response.json({message:"图片损坏或尺寸过大，请重新选择。"},{status:400});}
    }
    initializeDatabase();
    const userId = session.user.id;
    sqlite.transaction(() => {
      const old = getProfile(userId);
      sqlite.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
      saveProfile(userId, { school, skills, education: old?.education ?? null, roles: old?.roles ?? null, interests: old?.interests ?? null, weeklyHours: old?.weeklyHours ?? null });
      if (avatar) { const previous=sqlite.prepare("SELECT updated_at AS version FROM user_avatars WHERE user_id=?").get(userId) as {version:number}|undefined;sqlite.prepare("INSERT INTO user_avatars VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET content=excluded.content, content_type=excluded.content_type, updated_at=excluded.updated_at").run(userId,avatar.bytes,avatar.type,Math.max(Date.now(),(previous?.version||0)+1)); }
    })();
    revalidatePath("/", "layout");
    const saved=sqlite.prepare("SELECT updated_at AS version FROM user_avatars WHERE user_id=?").get(userId) as {version:number}|undefined;
    return Response.json({ok:true,userId,name,avatarUrl:saved?`/api/avatars/${encodeURIComponent(userId)}?v=${saved.version}`:null},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return fileFailure(error); }
}
