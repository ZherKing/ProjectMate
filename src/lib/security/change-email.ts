import {verifyPassword} from "@/lib/auth/password";
import {sqlite} from "@/lib/db/client";
import {changed,consumeSecurityCode,securityUser,sendSecurityCode,verifySensitive,provePassword} from "./service";
import {SecurityError} from "./error";
export function newEmail(userId:string,input:string){const user=securityUser(userId);if(!user)throw new SecurityError("请先登录。",401);const email=input.trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===user.email.toLowerCase())throw new SecurityError("请输入与当前邮箱不同的有效邮箱。");if(sqlite.prepare("SELECT id FROM users WHERE lower(email)=? AND id<>?").get(email,userId))throw new SecurityError("此邮箱已被其他账号使用。",409);return email;}
export async function sendEmailChangeCode(userId:string,password:string,input:string,target:"old"|"new"){provePassword(userId,password);const email=newEmail(userId,input);return sendSecurityCode(userId,target==="old"?"email-change-old":"email-change-new",target==="new"?email:undefined);}
export function changeLoginEmail(userId:string,input:{email:string;password:string;factor:string;oldCode:string;newCode:string}){
 const email=newEmail(userId,input.email);const user=verifySensitive(userId,input.password,input.factor);
 // Failed attempts must commit individually; success is claimed atomically below.
 function validate(purpose:string,target:string){const row=sqlite.prepare("SELECT id,code_hash AS hash,expires_at AS expiresAt,attempts FROM security_codes WHERE user_id=? AND purpose=? AND email=? AND status='sent' ORDER BY created_at DESC LIMIT 1").get(userId,purpose,target) as {id:string;hash:string;expiresAt:number;attempts:number}|undefined;return row;}
 const old=validate("email-change-old",user.email.toLowerCase()),next=validate("email-change-new",email);
 // consumeSecurityCode records wrong attempts; only delete valid codes together after both match.
 if(!old||old.expiresAt<Date.now()||old.attempts>=5||!/^\d{6}$/.test(input.oldCode)||!verifyPassword(input.oldCode,old.hash))consumeSecurityCode(userId,"email-change-old",input.oldCode);
 if(!next||next.expiresAt<Date.now()||next.attempts>=5||!/^\d{6}$/.test(input.newCode)||!verifyPassword(input.newCode,next.hash))consumeSecurityCode(userId,"email-change-new",input.newCode,email);
 return sqlite.transaction(()=>{if(securityUser(userId)?.version!==user.version)throw new SecurityError("账号状态已变化，请重新验证。",409);newEmail(userId,email);consumeSecurityCode(userId,"email-change-old",input.oldCode);consumeSecurityCode(userId,"email-change-new",input.newCode,email);sqlite.prepare("UPDATE users SET email=? WHERE id=?").run(email,userId);changed(userId);sqlite.prepare("DELETE FROM security_codes WHERE user_id=?").run(userId);sqlite.prepare("DELETE FROM github_states WHERE user_id=?").run(userId);return {email};}).immediate();
}
