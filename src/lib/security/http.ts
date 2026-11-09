import { FileError } from "@/lib/files/store";
import { auth } from "@/auth";
import { readBody,requireSameOrigin } from "@/lib/files/http";
import { SecurityError } from "./error";
export async function securityActor(request?:Request){if(request)requireSameOrigin(request);const user=(await auth())?.user;if(!user?.id)throw new SecurityError("请先登录。",401);return user.id;}
export async function securityBody(request:Request){const body=JSON.parse((await readBody(request,16384)).toString()||"{}");if(!body||typeof body!=="object"||Array.isArray(body))throw new SecurityError("请求格式无效。");return body as Record<string,unknown>;}
export const field=(body:Record<string,unknown>,name:string,max=512)=>{const value=body[name];return typeof value==="string"?value.slice(0,max):"";};
export function securityFailure(error:unknown){if(error instanceof FileError)return Response.json({message:error.message},{status:error.status});if(error instanceof SecurityError)return Response.json({message:error.message,code:error.code},{status:error.status,headers:{"Cache-Control":"no-store"}});if(error instanceof SyntaxError)return Response.json({message:"请求格式无效。"},{status:400});return Response.json({message:"操作未完成，请稍后重试。"},{status:500,headers:{"Cache-Control":"no-store"}});}
