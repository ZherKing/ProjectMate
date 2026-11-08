"use server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { completeConsent } from "@/lib/mcp/oauth";
export async function authorizeMcpAction(form: FormData) {
  const user = (await auth())?.user;
  if (!user?.id) redirect("/login");
  let destination: string;
  try { destination=completeConsent(user.id,String(form.get("nonce")||""),String(form.get("projectId")||""),form.get("write")==="yes",form.get("decision")==="allow"); }
  catch (error) { redirect("/mcp/error?message="+encodeURIComponent(error instanceof Error?error.message:"授权未完成，请重新连接。")); }
  redirect(destination!);
}
