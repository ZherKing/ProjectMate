import{securityActor,securityFailure}from"@/lib/security/http";import{teamMatches,explainTeamMatches}from"@/lib/teams/matching";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(teamMatches(await securityActor()),{headers:{"Cache-Control":"no-store"}});}catch(e){return securityFailure(e);}}
export async function POST(request:Request){try{return Response.json(await explainTeamMatches(await securityActor(request)),{headers:{"Cache-Control":"no-store"}});}catch(e){return securityFailure(e);}}
