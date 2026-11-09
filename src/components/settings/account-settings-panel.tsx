"use client";
import{SecurityPanel}from"./security-panel";import{GithubPanel}from"./github-panel";import{NotificationsPanel}from"./notifications-panel";import{DangerPanel}from"./danger-panel";
export function AccountSettingsPanel({section}:{section:string}){return section==="security"?<SecurityPanel/>:section==="connections"?<GithubPanel/>:section==="notifications"?<NotificationsPanel/>:<DangerPanel/>;}
