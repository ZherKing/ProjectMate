import { requireAdmin } from "@/lib/auth/guards";
import { sendMail } from "@/lib/mailer";
export async function POST(request:Request){if(!(await requireAdmin()))return Response.json({message:'没有管理员权限'},{status:403});const body=await request.json();const to=String(body.to||'').trim();if(!/^\S+@\S+\.\S+$/.test(to))return Response.json({message:'请输入有效测试收件邮箱'},{status:400});try{await sendMail(to,'ProjectMate SMTP 测试邮件','SMTP 配置测试成功。');return Response.json({ok:true,message:'测试邮件已发送'});}catch(error){return Response.json({message:error instanceof Error?error.message:'SMTP 测试发送失败'},{status:400});}}
