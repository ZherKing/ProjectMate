"use client";
import { useEffect, useState } from "react";
import { accountAvatarSrc } from "@/lib/account/avatar";
export function AccountAvatar({userId,name,image}:{userId:string;name?:string|null;image?:string|null}) {
  const [value,setValue]=useState({name,image});
  useEffect(()=>setValue({name,image}),[name,image]);
  useEffect(()=>{const changed=(event:Event)=>{const data=(event as CustomEvent).detail;if(data?.userId!==userId)return;const image=typeof data.avatarUrl==="string"&&data.avatarUrl.startsWith(`/api/avatars/${encodeURIComponent(userId)}?v=`)?data.avatarUrl:null;setValue({name:typeof data.name==="string"?data.name:name,image});};window.addEventListener("projectmate:profile-updated",changed);return()=>window.removeEventListener("projectmate:profile-updated",changed);},[userId,name]);
  return <img src={accountAvatarSrc(value.name,value.image)} alt="个人头像" width={32} height={32} data-account-avatar={userId}/>;
}
