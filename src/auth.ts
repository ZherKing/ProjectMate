import { consumeCaptcha } from "@/lib/security/geetest";
import NextAuth,{CredentialsSignin} from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { seedDatabase } from "@/lib/db/seed";
import { verifyPassword } from "@/lib/auth/password";
import { syncConfiguredUserRole } from "@/lib/auth/permissions";
import { factorValid,limitSecurity,readTicket,securityUser,userByEmail } from "@/lib/security/service";
import { SecurityError } from "@/lib/security/error";
class FactorRequired extends CredentialsSignin{code="two_factor_required";}
class InvalidFactor extends CredentialsSignin{code="invalid_two_factor";}
class CaptchaRequired extends CredentialsSignin{code="captcha_required";}
class LoginLimited extends CredentialsSignin{code="rate_limited";}
export const {handlers,auth,signIn,signOut}=NextAuth({
 secret:process.env.AUTH_SECRET??"projectmate-development-secret",session:{strategy:"jwt"},
 callbacks:{
  jwt({token,user}){initializeDatabase();if(user?.id){const account=securityUser(user.id);if(!account||(user as {sessionVersion?:number}).sessionVersion!==account.version)return null;token.sub=user.id;token.sessionVersion=account.version;token.factorVerified=(user as {factorVerified?:boolean}).factorVerified===true;token.authMethod=(user as {authMethod?:string}).authMethod;token.githubId=(user as {githubId?:string}).githubId;}if(!token.sub)return null;if(token.authMethod==="github"){const linked=sqlite.prepare("SELECT github_id AS id FROM github_accounts WHERE user_id=?").get(token.sub) as {id:string}|undefined;if(!linked||linked.id!==token.githubId)return null;}const account=securityUser(token.sub);if(!account||Number(token.sessionVersion??0)!==account.version||account.enabled&&token.factorVerified!==true)return null;return token;},
  session({session,token}){if(session.user&&token.sub){const account=securityUser(token.sub);if(!account||account.version!==Number(token.sessionVersion??0))throw new Error("Session revoked");session.user.id=account.id;session.user.name=account.name;session.user.email=account.email;const avatar=sqlite.prepare("SELECT updated_at AS version FROM user_avatars WHERE user_id=?").get(account.id) as {version:number}|undefined;session.user.image=avatar?`/api/avatars/${encodeURIComponent(account.id)}?v=${avatar.version}`:null;}return session;}
 },
 providers:[Credentials({credentials:{email:{type:"email"},password:{type:"password"},factor:{type:"text"},authTicket:{type:"text"},captchaTicket:{type:"text"}},async authorize(credentials){
  initializeDatabase();seedDatabase();
  try{
   let account,method="password",githubId:string|undefined;
   if(credentials?.authTicket){const verified=readTicket(String(credentials.authTicket),"session",true);account=verified.user;method=verified.data.provider||"password";githubId=verified.data.githubId;}
   else{const email=String(credentials?.email||"").trim();try{consumeCaptcha(credentials?.captchaTicket,"login",email);}catch{throw new CaptchaRequired();}limitSecurity("login:"+email.toLowerCase(),40,5*60000);account=userByEmail(email);const password=String(credentials?.password||"");if(!account||password.length>128||!verifyPassword(password,account.passwordHash))return null;if(account.enabled&&!credentials.factor)throw new FactorRequired();if(account.enabled)factorValid(account.id,String(credentials.factor||""));}
   syncConfiguredUserRole(account.id,account.email);return{id:account.id,email:account.email,name:account.name,sessionVersion:account.version,factorVerified:true,authMethod:method,githubId};
  }catch(error){if(error instanceof FactorRequired||error instanceof CaptchaRequired)throw error;if(error instanceof SecurityError){if(error.status===429)throw new LoginLimited();if(error.code==="two_factor_required")throw new FactorRequired();if(error.code==="invalid_two_factor")throw new InvalidFactor();return null;}throw error;}
 }})]
});
