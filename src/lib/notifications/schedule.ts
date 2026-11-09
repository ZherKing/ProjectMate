import{after}from"next/server";import{dispatchNotifications,startNotificationWorker}from"./dispatch";
export function scheduleNotifications(){after(async()=>{startNotificationWorker();await dispatchNotifications().catch(()=>{});});}
