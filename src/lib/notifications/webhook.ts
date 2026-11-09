import {lookup} from "node:dns/promises";
import {request as httpsRequest} from "node:https";
import {request as httpRequest} from "node:http";
import {createHmac} from "node:crypto";
import ipaddr from "ipaddr.js";
import {SecurityError} from "@/lib/security/error";
export function publicAddress(address:string){try{const parsed=ipaddr.process(address);return parsed.range()==="unicast";}catch{return false;}}
export async function webhookTarget(value:string){
 let url:URL;try{url=new URL(value);}catch{throw new SecurityError("Webhook地址无效。");}
 const host=url.hostname.replace(/^\[|\]$/g,"");const test=process.env.NODE_ENV!=="production"&&process.env.NOTIFICATION_TEST_ALLOW_LOOPBACK==="true"&&["127.0.0.1","localhost","::1"].includes(host);
 if(value.length>2000||url.username||url.password||url.hash||url.protocol!=="https:"&&!(test&&url.protocol==="http:"))throw new SecurityError("Webhook需为不含账户密码或片段的HTTPS地址。");
 let addresses:Array<{address:string;family:number}>;try{addresses=await lookup(host,{all:true,verbatim:true});}catch{throw new SecurityError("Webhook域名无法解析。");}
 if(!addresses.length||addresses.some(item=>!publicAddress(item.address)&&!(test&&ipaddr.process(item.address).range()==="loopback")))throw new SecurityError("Webhook不能指向本机、内网或云服务元数据地址。");
 return{url,host,address:addresses[0]};
}
export async function postWebhook(value:string,secret:string,event:unknown,id:string){
 const{url,address}=await webhookTarget(value),body=JSON.stringify(event),timestamp=String(Math.floor(Date.now()/1000)),signature=createHmac("sha256",secret).update(timestamp+"."+body).digest("hex");
 return new Promise<void>((resolve,reject)=>{
  const send=url.protocol==="https:"?httpsRequest:httpRequest;
  const req=send(url,{method:"POST",lookup:((_hostname:unknown,options:unknown,callback:unknown)=>{const done=callback as (...args:unknown[])=>void;if((options as {all?:boolean})?.all)done(null,[address]);else done(null,address.address,address.family);}) as never,headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),"User-Agent":"ProjectMate-Webhook/1.0","X-ProjectMate-Id":id,"X-ProjectMate-Timestamp":timestamp,"X-ProjectMate-Signature":"sha256="+signature}},response=>{let count=0;response.on("data",chunk=>{count+=chunk.length;if(count>65536){response.destroy();reject(new Error("Webhook响应过大"));}});response.on("end",()=>response.statusCode&&response.statusCode>=200&&response.statusCode<300?resolve():reject(new Error("Webhook返回状态"+(response.statusCode||0))));response.on("error",()=>reject(new Error("Webhook响应中断")));});
  const totalTimer=setTimeout(()=>req.destroy(new Error("Webhook总耗时超限")),8000);req.on("close",()=>clearTimeout(totalTimer));
  req.setTimeout(5000,()=>req.destroy(new Error("Webhook连接超时")));req.on("error",()=>reject(new Error("Webhook网络请求失败")));req.end(body);
 });
}
