import { revalidatePath } from "next/cache";
import { currentUserId, fileFailure, readBody, requireSameOrigin } from "@/lib/files/http";
import { getProjectSettings, listUserProjects, ProjectSettingsError, selectActiveProject } from "@/lib/db/project-settings";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const userId=await currentUserId(),projectId=new URL(request.url).searchParams.get("project"),projects=listUserProjects(userId);const settings=projectId&&projects.some(p=>p.id===projectId)?getProjectSettings(projectId,userId):null;return Response.json({projects,settings},{headers:{"Cache-Control":"no-store"}});}catch(error){return fileFailure(error);}}
export async function POST(request:Request){try{requireSameOrigin(request);const userId=await currentUserId(),body=JSON.parse((await readBody(request,4096)).toString());if(typeof body?.projectId!=="string"||!body.projectId||body.projectId.length>200)throw new ProjectSettingsError("请选择要切换的项目。");selectActiveProject(userId,body.projectId);revalidatePath("/projects","layout");return Response.json({ok:true});}catch(error){if(error instanceof ProjectSettingsError)return Response.json({message:error.message},{status:error.status});return fileFailure(error);}}
