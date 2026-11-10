import { BoxueguAdapter } from "./adapters/boxuegu";
import { SaikrAdapter } from "./adapters/saikr";
import { Xiaoyuan172Adapter } from "./adapters/xiaoyuan172";
export const competitionSources = [
  { id:"boxuegu", name:"传智杯", description:"赛事与赛道公开接口适配器" },
  { id:"xiaoyuan172", name:"172校园赛事网", description:"开发应用分类公开赛事抓取适配器" },
  { id:"saikr", name:"赛氪", description:"公开页面或已配置的JSON接口适配器" },
] as const;
export type SourceId = typeof competitionSources[number]["id"];
export function sourceAdapter(id:SourceId){
  if(id==="boxuegu")return {adapter:new BoxueguAdapter(),url:process.env.BOXUEGU_CONTESTS_URL||"https://www.boxuegu.com/matchTrack/"};
  if(id==="xiaoyuan172")return {adapter:new Xiaoyuan172Adapter(),url:process.env.XIAOYUAN172_CONTESTS_URL||"http://bisai.172xiaoyuan.com/kaifayingyong/"};
  return {adapter:new SaikrAdapter(),url:process.env.SAIKR_CONTESTS_URL||"https://www.saikr.com/contests"};
}
