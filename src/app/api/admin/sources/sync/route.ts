import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/files/http";
import { securityBody,securityFailure,field } from "@/lib/security/http";
import { syncCompetitionSource } from "@/lib/crawler/source-sync";
import { revalidatePath } from "next/cache";
export const runtime="nodejs";
export async function POST(request:Request){try{requireSameOrigin(request);const admin=await requireAdmin();if(!admin)return Response.json({message:"没有管理员权限。"},{status:403});const body=await securityBody(request),result=await syncCompetitionSource(field(body,"source",40),admin.userId);for(const path of ["/admin","/admin/sources","/admin/logs","/competitions","/competitions/favorites","/competitions/recommendations","/teams"])revalidatePath(path);return Response.json(result,{status:result.ok?200:502,headers:{"Cache-Control":"no-store"}});}catch(e){return securityFailure(e);}}
