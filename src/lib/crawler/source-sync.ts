import { randomUUID } from "node:crypto";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { SecurityError } from "@/lib/security/error";
import { normalizeCompetition } from "./normalize";
import { competitionSources,sourceAdapter,type SourceId } from "./sources";
function tables(){initializeDatabase();sqlite.exec(`CREATE TABLE IF NOT EXISTS competition_source_syncs(source TEXT PRIMARY KEY,token TEXT NOT NULL,status TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER,added INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL DEFAULT 0,tracks INTEGER NOT NULL DEFAULT 0,message TEXT NOT NULL);`);}
export function latestSourceSync(source:string){tables();return sqlite.prepare("SELECT status,started_at AS startedAt,finished_at AS finishedAt,added,updated,tracks,message FROM competition_source_syncs WHERE source=?").get(source) as {status:string;startedAt:number;finishedAt:number|null;added:number;updated:number;tracks:number;message:string}|undefined;}
export async function syncCompetitionSource(source:string,actorId:string){
 const entry=competitionSources.find(s=>s.id===source);if(!entry)throw new SecurityError("请选择有效数据源。");tables();
 const token=randomUUID(),now=Date.now();
 sqlite.transaction(()=>{const previous=latestSourceSync(source);if(previous?.status==="running"&&previous.startedAt>now-600000)throw new SecurityError("该数据源正在同步，请稍后刷新查看。",409);if(previous&&previous.startedAt>now-60000)throw new SecurityError("请间隔一分钟后再同步该数据源。",429);sqlite.prepare("INSERT INTO competition_source_syncs(source,token,status,started_at,finished_at,message) VALUES(?,?,'running',?,NULL,'正在抓取与校验公开资料…') ON CONFLICT(source) DO UPDATE SET token=excluded.token,status='running',started_at=excluded.started_at,finished_at=NULL,added=0,updated=0,tracks=0,message=excluded.message").run(source,token,now);}).immediate();
 let added=0,updated=0,tracks=0,message="",ok=false;
 try{
  const {adapter,url}=sourceAdapter(entry.id as SourceId);const items=await adapter.fetchAndParse(url);
  if(!items.length)throw new Error("empty-source");
  sqlite.transaction(()=>{
   const current=sqlite.prepare("SELECT token FROM competition_source_syncs WHERE source=?").get(source) as {token:string};if(current.token!==token)throw new Error("superseded");
   const put=sqlite.prepare("INSERT INTO competitions(id,platform,name,season,status,source_url,updated_at,review_status) VALUES(@id,@platform,@name,@season,@status,@sourceUrl,@updatedAt,'pending') ON CONFLICT(id) DO UPDATE SET name=excluded.name,season=excluded.season,status=excluded.status,source_url=excluded.source_url,updated_at=excluded.updated_at");
   for(const item of items){if(!item.name?.trim()||!/^https?:\/\//i.test(item.sourceUrl)||item.platform!==entry.name)throw new Error("invalid-source");const row=normalizeCompetition(item);const exists=sqlite.prepare("SELECT id FROM competitions WHERE id=?").get(row.id);put.run(row);if(exists)updated++;else added++;
    for(const track of item.tracks||[]){const deadline=track.deadline?Date.parse(track.deadline):NaN;sqlite.prepare("INSERT INTO competition_tracks(id,competition_id,name,description,deadline) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,deadline=excluded.deadline").run(adapter.sourceName+":"+(track.externalId||track.name),row.id,track.name,track.description||null,Number.isFinite(deadline)?deadline:null);tracks++;}
   }
   message=`同步完成：新增 ${added} 项，更新 ${updated} 项，赛道 ${tracks} 条。新增赛事需审核通过后才会显示在比赛中心。`;
   sqlite.prepare("UPDATE competition_source_syncs SET status='success',finished_at=?,added=?,updated=?,tracks=?,message=? WHERE source=? AND token=?").run(Date.now(),added,updated,tracks,message,source,token);
  }).immediate();ok=true;
 }catch(error){added=0;updated=0;tracks=0;message=error instanceof Error&&error.message==="empty-source"?"未获取到有效赛事，请检查公开来源是否可用或页面结构是否变化；已有数据保持不变。":"同步失败，请检查容器到该数据源的网络、接口配置或来源结构；已有数据保持不变。";sqlite.prepare("UPDATE competition_source_syncs SET status='failed',finished_at=?,message=? WHERE source=? AND token=?").run(Date.now(),message,source,token);}
 sqlite.prepare("INSERT INTO admin_audit_logs(id,actor_id,action,target_type,target_id,details,created_at) VALUES(?,?,?,?,?,?,?)").run(randomUUID(),actorId,"source.sync","source",source,JSON.stringify({ok,added,updated,tracks,message}),Date.now());
 return {ok,message,added,updated,tracks,source:entry.id};
}
