const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const screens=JSON.parse(fs.readFileSync('src/design/screens.json','utf8'));
const map={};fs.mkdirSync('public/assets/fonts',{recursive:true});fs.mkdirSync('public/assets/avatars',{recursive:true});
const fontSource=fs.existsSync('/tmp/projectmate-fonts.css')?'/tmp/projectmate-fonts.css':'src/design/fonts.css';
let fonts=fs.readFileSync(fontSource,'utf8');let i=0;
for(const match of fonts.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)){
 const url=match[1],name='design-font-'+(++i)+'.ttf',dest=path.join('public/assets/fonts',name);
 if(!fs.existsSync(dest)){const r=spawnSync('curl',['-fLsS','--max-time','25',url,'-o',dest],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
 fonts=fonts.replace(url,'/assets/fonts/'+name);
}
fs.writeFileSync('src/design/fonts.css',fonts);
const urls=new Set(Object.values(screens).flatMap(html=>[...html.matchAll(/src="(https:[^"]+)"/g)].map(m=>m[1])));
for(const url of urls){
 if(new URL(url).hostname!=='lh3.googleusercontent.com')throw Error('Unexpected asset host');
 const name=crypto.createHash('sha256').update(url).digest('hex').slice(0,12)+'.jpg',dest=path.join('public/assets/avatars',name);
 if(!fs.existsSync(dest)){const r=spawnSync('curl',['-fLsS','--max-time','20',url,'-o',dest],{encoding:'utf8'});if(r.status!==0){console.log('Unreachable avatar, use local fallback:',name);map[url]='/assets/avatar-fallback.svg';continue;}}
 map[url]='/assets/avatars/'+name;
}
fs.writeFileSync('src/design/asset-map.json',JSON.stringify(map,null,2)+'\n');
for(const key of Object.keys(screens))for(const [remote,local] of Object.entries(map))screens[key]=screens[key].split(remote).join(local);
fs.writeFileSync('src/design/screens.json',JSON.stringify(screens,null,2)+'\n');
fs.writeFileSync('public/assets/avatar-fallback.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="#e2dfff"/><circle cx="20" cy="15" r="7" fill="#4f46e5"/><path d="M7 35a13 13 0 0 1 26 0" fill="#4f46e5"/></svg>');
console.log('Cached '+i+' font files and '+urls.size+' avatar images.');
