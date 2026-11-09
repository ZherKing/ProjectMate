import{securityActor,securityFailure}from"@/lib/security/http";import{sendSecurityCode}from"@/lib/security/service";
export async function POST(request:Request){try{return Response.json({ok:true,...await sendSecurityCode(await securityActor(request),"password-change")},{headers:{"Cache-Control":"no-store"}});}catch(error){return securityFailure(error);}}
