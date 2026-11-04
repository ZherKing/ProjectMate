const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const icons = require('lucide-react');
const sources = { home: '_2', competitions: '_1', dashboard: '_3', projects: 'ai_1', teams: 'ai_2', login: '登陆页面' };
const map = {
 account_balance:'Landmark', account_circle:'CircleUserRound', lock:'LockKeyhole', visibility:'Eye', visibility_off:'EyeOff', mark_email_read:'MailCheck', encrypted:'ShieldCheck', add:'Plus', add_circle:'CirclePlus', alarm:'AlarmClock', alt_route:'Route', arrow_forward:'ArrowRight', auto_awesome:'Sparkles', auto_fix_high:'WandSparkles', bolt:'Zap', bookmark_border:'Bookmark', bookmarks:'BookMarked', calendar_today:'CalendarDays', check_circle:'CircleCheck', checklist:'ListChecks', close:'X', cloud:'Cloud', code:'CodeXml', commit:'GitCommitHorizontal', content_copy:'Copy', database:'Database', directions_car:'Car', diversity_3:'UsersRound', done_all:'CheckCheck', donut_large:'ChartPie', download:'Download', emoji_events:'Trophy', error:'CircleAlert', event:'Calendar', explore:'Compass', fast_forward:'FastForward', favorite_border:'Heart', file_download:'FileDown', filter_list:'ListFilter', flag:'Flag', group:'Users', group_add:'UserPlus', group_work:'Network', groups:'UsersRound', gshield:'ShieldCheck', health_and_safety:'ShieldPlus', hub:'Network', info:'Info', lightbulb:'Lightbulb', login:'LogIn', mark_email_unread:'Mail', model_training:'BrainCircuit', notifications:'Bell', offline_bolt:'Zap', open_in_new:'ExternalLink', palette:'Palette', pending:'CircleEllipsis', person:'UserRound', person_add:'UserPlus', person_outline:'UserRound', play_arrow:'Play', play_circle:'CirclePlay', precision_manufacturing:'Bot', priority_high:'CircleAlert', psychology:'BrainCircuit', psychology_alt:'Brain', query_stats:'ChartNoAxesCombined', refresh:'RefreshCw', remove_circle_outline:'CircleMinus', rocket_launch:'Rocket', satellite_alt:'Satellite', schedule:'Clock3', school:'GraduationCap', search:'Search', search_spark:'SearchCheck', send:'Send', settings:'Settings', smart_display:'MonitorPlay', smart_toy:'Bot', sync:'RefreshCw', sync_problem:'Unplug', task_alt:'CircleCheck', terminal:'SquareTerminal', thumb_up:'ThumbsUp', timer:'Timer', tips_and_updates:'Lightbulb', trending_up:'TrendingUp', troubleshoot:'ScanSearch', tune:'SlidersHorizontal', undo:'Undo2', verified:'BadgeCheck', verified_user:'ShieldCheck', view_kanban:'Kanban', warning:'TriangleAlert', workspace_premium:'Award'
};
const out={};const iconNames=new Set();let count=0;
for(const [name,dir] of Object.entries(sources)){
 const $=cheerio.load(fs.readFileSync(path.join('stitch_projectmate_ui_design',dir,'code.html'),'utf8'));
 $('script,style,link,meta,title').remove();
 $('[class*=material-symbols]').each((_,el)=>{
   const key=$(el).text().trim(); const icon=icons[map[key]];
   if(!icon) throw Error('Missing SVG: '+key);
   iconNames.add(key);count++;
   const cls=($(el).attr('class')||'').replace(/material-symbols-outlined/g,'design-icon');
   const markup=renderToStaticMarkup(React.createElement(icon,{size:20,strokeWidth:1.7,className:cls,'data-icon':key,'aria-hidden':'true',focusable:'false',style:{width:'1em',height:'1em',display:'inline-block',verticalAlign:'middle',flexShrink:0}}));
   $(el).replaceWith(markup);
 });
 $('img[alt="ProjectMate Brand Logo"]').attr('src','/assets/logo.svg').attr('width','32').attr('height','32').attr('class','h-8 w-8 object-contain');
 // Preserve original interactions as declarative labels; no scripts or inline handlers execute.
 $('*').each((_,el)=>{for(const [attr,value] of Object.entries(el.attribs||{})){if(/^on/i.test(attr)){if(attr==='onclick')$(el).attr('data-design-handler',value);$(el).removeAttr(attr);}if((attr==='href'||attr==='src')&&/^javascript:/i.test(value))$(el).removeAttr(attr);}});
 $('#toast-container').empty();$('#interactive-toast').remove();
 // A real session controls access; no guest/logged-in toggle controls.
 $('button,a').filter((_,e)=>/游客态|登录态/.test($(e).text())).remove();
 const navMap={'competitions-hub':'/competitions','team-hall':'/teams','project-workspace':'/projects','product-overview':'/#workflow','guest-home':'/','dashboard':'/dashboard'};
 $('header [data-path="product-overview"]').remove();
 $('header input[placeholder*="搜索比赛、赛道"]').closest('div.flex-1').remove();
 $('header input[placeholder*="搜索比赛、赛道"]').remove();
 $('[data-path]').each((_,e)=>{const dest=navMap[$(e).attr('data-path')];if(dest)$(e).attr('href',dest);});
 $('header').attr('data-design-header','');
 $('body > main').attr('data-design-main',name);
 out[name]=$('body').html();
}
const assetMap=fs.existsSync('src/design/asset-map.json')?JSON.parse(fs.readFileSync('src/design/asset-map.json','utf8')):{};
for(const key of Object.keys(out))for(const [remote,local] of Object.entries(assetMap))out[key]=out[key].split(remote).join(local);
fs.writeFileSync('src/design/screens.json',JSON.stringify(out,null,2)+'\n');
fs.writeFileSync('public/assets/logo.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#3525cd"/><path d="M10 24V8h8a5 5 0 0 1 0 10h-8m6-10v16" fill="none" stroke="white" stroke-width="2.4" stroke-linejoin="round"/></svg>');
fs.writeFileSync('src/design/manifest.json',JSON.stringify({screens:sources,sourceSvgReplacements:count,svgOccurrences:Object.values(out).reduce((sum,html)=>sum+(html.match(/<svg[^>]*data-icon=/g)||[]).length,0),icons:[...iconNames].sort()},null,2)+'\n');
console.log('Imported '+Object.keys(out).length+' screens; '+count+' inline SVG occurrences; '+iconNames.size+' distinct icons.');
