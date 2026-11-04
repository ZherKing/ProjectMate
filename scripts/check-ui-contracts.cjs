const fs=require('node:fs');
const assert=require('node:assert/strict');
const cheerio=require('cheerio');
const screens=require('../src/design/screens.json');
const manifest=require('../src/design/manifest.json');
let icons=0;
for(const [name,html] of Object.entries(screens)){
 const $=cheerio.load(html);
 assert.equal($('script').length,0,name+': no exported simulation scripts');
 assert.equal($('[class*=material-symbols]').length,0,name+': all font icons replaced');
 assert.equal($('main').length,1,name+': preserve main layout');
 $('*').each((_,el)=>{for(const key of Object.keys(el.attribs||{}))assert.ok(!/^on/i.test(key),name+': no inline handlers');});
 $('img').each((_,el)=>{
   const src=$(el).attr('src');assert.ok(src?.startsWith('/assets/'),name+': local image '+src);
   assert.ok(fs.existsSync('public'+src),name+': missing local image '+src);
 });
 icons+=$('svg[data-icon]').length;
 for(const modal of ['#creator-modal','#poster-modal','#ai-synergy-modal','#demo-modal'])if($(modal).length)assert.ok($(modal).hasClass('hidden'),name+': modal hidden by default');
 console.log(name+': local assets, SVG icons, layout and script removal verified');
}
assert.equal(icons,manifest.svgOccurrences);
assert.equal(Object.keys(screens).length,9);
for(const name of ['competitionDetail','settings','admin'])assert.ok(screens[name],name+': imported future screen');
const fonts=fs.readFileSync('src/design/fonts.css','utf8');
for(const m of fonts.matchAll(/url\(([^)]+)\)/g))assert.ok(fs.existsSync('public'+m[1]),'local font missing');
assert.ok(fs.readFileSync('.gitignore','utf8').includes('/stitch_projectmate_ui_design/'));
console.log(icons+' inline SVG occurrences, '+manifest.icons.length+' icon types; '+Object.keys(screens).length+' screens verified.');
