import{securityActor,securityBody,securityFailure,field}from"@/lib/security/http";import{notificationPreferences,notificationTest,saveNotificationPreferences,verifyNotificationEmail}from"@/lib/notifications/store";import{sendSecurityCode}from"@/lib/security/service";import{scheduleNotifications}from"@/lib/notifications/schedule";import{SecurityError}from"@/lib/security/error";
export async function GET(){try{return Response.json(notificationPreferences(await securityActor()),{headers:{"Cache-Control":"no-store"}});}catch(e){return securityFailure(e);}}
export async function POST(request:Request){try{const id=await securityActor(request),b=await securityBody(request);let data:unknown;
 if(b.action==="send-email")data=await sendSecurityCode(id,"notify-email",field(b,"email",255));
 else if(b.action==="verify-email")data={preferences:verifyNotificationEmail(id,field(b,"email",255),field(b,"code"))};
 else if(b.action==="save")data=await saveNotificationPreferences(id,{emailEnabled:b.emailEnabled===true,webhookEnabled:b.webhookEnabled===true,webhookUrl:field(b,"webhookUrl",2001),rotate:b.rotate===true});
 else if(b.action==="test"){notificationTest(id);scheduleNotifications();data={message:"测试通知已进入投递队列，请查看下方记录。"};}
 else throw new SecurityError("无效操作。");return Response.json({ok:true,...data as object},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return securityFailure(e);}}
