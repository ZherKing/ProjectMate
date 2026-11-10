"use client";
type CaptchaPurpose='login'|'register'|'email-send'|'email-login'|'github';
type Validation={lot_number:string;captcha_output:string;pass_token:string;gen_time:string};
type Captcha={onReady:(cb:()=>void)=>Captcha;onSuccess:(cb:()=>void)=>Captcha;onError:(cb:()=>void)=>Captcha;onClose:(cb:()=>void)=>Captcha;showCaptcha:()=>void;getValidate:()=>Validation|false;destroy:()=>void};
declare global {interface Window {initGeetest4?:(config:{captchaId:string;product:string;language:string;protocol:string},ready:(captcha:Captcha)=>void)=>void}}
let loading:Promise<void>|null=null;
function loadSdk(){if(window.initGeetest4)return Promise.resolve();if(loading)return loading;loading=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='https://static.geetest.com/v4/gt4.js';script.async=true;const timer=setTimeout(()=>{script.remove();loading=null;reject(new Error('人机验证加载超时，请重试。'));},15000);script.onload=()=>{clearTimeout(timer);if(window.initGeetest4)resolve();else{loading=null;reject(new Error('人机验证加载失败，请重试。'));}};script.onerror=()=>{clearTimeout(timer);script.remove();loading=null;reject(new Error('人机验证暂时无法加载，请稍后重试。'));};document.head.appendChild(script);});return loading;}
export async function captchaTicket(purpose:CaptchaPurpose,subject:string):Promise<string>{
 const configResponse=await fetch('/api/auth/captcha',{cache:'no-store',signal:AbortSignal.timeout(10000)});const config=await configResponse.json();if(!configResponse.ok)throw new Error(config.message||'人机验证配置不可用。');if(!config.enabled)return '';
 await loadSdk();
 const validation=await new Promise<Validation>((resolve,reject)=>{let captcha:Captcha|undefined,finished=false;const timer=setTimeout(()=>finish(new Error('人机验证已超时，请重试。')),120000);function finish(error?:Error,result?:Validation){if(finished)return;finished=true;clearTimeout(timer);setTimeout(()=>captcha?.destroy(),0);if(error)reject(error);else resolve(result!);}
 window.initGeetest4!({captchaId:config.captchaId,product:'bind',language:'zho',protocol:'https://'},object=>{if(finished){object.destroy();return;}captcha=object;object.onReady(()=>object.showCaptcha()).onSuccess(()=>{const result=object.getValidate();if(result)finish(undefined,result);else finish(new Error('请完成人机验证。'));}).onError(()=>finish(new Error('人机验证服务异常，请重试。'))).onClose(()=>finish(new Error('已取消人机验证。')));});});
 const response=await fetch('/api/auth/captcha',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({purpose,subject,...validation})});const result=await response.json();if(!response.ok)throw new Error(result.message||'人机验证失败，请重新验证。');return result.ticket||'';
}
