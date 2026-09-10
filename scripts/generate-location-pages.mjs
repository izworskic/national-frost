import fs from 'node:fs';
import path from 'node:path';

const tool = {
  slug: 'frost',
  parent: 'public/national-tools/frost/index.html',
  label: 'Frost & Freeze',
  locations: [
    { slug:'minneapolis-mn', name:'Minneapolis, Minnesota', query:'Minneapolis, MN', title:'Minneapolis Frost Dates & Freeze Risk | Chris Izworski', description:'See Minneapolis frost dates, freeze risk and the live planting-season window using local climatology and current weather.', intro:'Minneapolis has a compressed growing season where a few cold nights can change planting and harvest decisions quickly.', why:'This page runs the national frost engine for Minneapolis so the answer reflects local freeze climatology and current conditions rather than a generic state calendar.' },
    { slug:'denver-co', name:'Denver, Colorado', query:'Denver, CO', title:'Denver Frost Dates & Freeze Risk | Chris Izworski', description:'See Denver frost dates, freeze risk and the live planting-season window using local climatology and current weather.', intro:'Denver’s elevation and large temperature swings make calendar-only frost guidance especially weak.', why:'This page runs the national frost engine for Denver so shoulder-season risk is tied to the local climate and current forecast.' },
    { slug:'boston-ma', name:'Boston, Massachusetts', query:'Boston, MA', title:'Boston Frost Dates & Freeze Risk | Chris Izworski', description:'See Boston frost dates, freeze risk and the live planting-season window using local climatology and current weather.', intro:'Boston’s coastal influence can separate city frost timing from colder inland New England locations.', why:'This page runs the national frost engine for Boston and keeps the result tied to the local point rather than a statewide average.' },
    { slug:'raleigh-nc', name:'Raleigh, North Carolina', query:'Raleigh, NC', title:'Raleigh Frost Dates & Freeze Risk | Chris Izworski', description:'See Raleigh frost dates, freeze risk and the live planting-season window using local climatology and current weather.', intro:'Raleigh’s long season still has meaningful spring and fall freeze boundaries for vegetables, flowers and tender plants.', why:'This page runs the national frost engine for Raleigh so gardeners can use the local season window instead of a broad zone-only rule.' }
  ]
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const root = process.cwd();
const source = fs.readFileSync(path.join(root, tool.parent), 'utf8');
if (!source.includes('<title>') || !source.includes('rel="canonical"')) throw new Error('Parent SEO shell not found');

for (const loc of tool.locations) {
  const canonical = `https://chrisizworski.com/national-tools/${tool.slug}/${loc.slug}/`;
  const faq = [
    {q:`When is frost likely in ${loc.name}?`,a:`The live tool combines local freeze climatology with current conditions. Use the dates as risk windows, not guarantees, because individual cold events can arrive earlier or later.`},
    {q:`Does this page use live weather for ${loc.name}?`,a:'Yes. The underlying national frost engine uses the resolved local point and current weather inputs alongside historical freeze timing.'},
    {q:'Is the result the same as a USDA hardiness zone?',a:'No. Hardiness zones describe long-term extreme minimum temperature. Frost timing answers a different question: when damaging cold is likely around the growing season.'}
  ];
  let html = source;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(loc.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${esc(loc.description)}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${canonical}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${canonical}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${esc(loc.title)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${esc(loc.description)}">`);
  html = html.replace(/<h1([^>]*)>[\s\S]*?<\/h1>/i, `<h1$1>Frost dates and freeze risk for ${esc(loc.name)}</h1>`);
  const structured = `<script type="application/ld+json" data-location-seo>${json({'@context':'https://schema.org','@graph':[{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'U.S. Outdoor Tools',item:'https://chrisizworski.com/national-tools/'},{'@type':'ListItem',position:2,name:'Frost & Freeze',item:'https://chrisizworski.com/national-tools/frost/'},{'@type':'ListItem',position:3,name:loc.name,item:canonical}]},{'@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}))}]})}</script>`;
  html = html.replace('</head>', `${structured}</head>`);
  const panel = `<section class="section seo-location-context" data-seo-location="${esc(loc.slug)}"><div class="wrap"><div style="border:1px solid #ddd7cb;background:#fff;padding:18px;border-radius:6px"><div class="eyebrow">Local frost decision page</div><h2>${esc(loc.name)} growing-season context</h2><p>${esc(loc.intro)}</p><p>${esc(loc.why)}</p><p><a href="/national-tools/frost/">Check another U.S. location</a></p></div></div></section>`;
  const mainOpen = html.match(/<main[^>]*>/i)?.[0];
  if (!mainOpen) throw new Error('Parent main element not found');
  html = html.replace(mainOpen, `${mainOpen}${panel}`);
  const preset = `<script data-location-preset>(()=>{const preset=${json(loc.query)};const run=()=>{const inputs=[...document.querySelectorAll('form input')].filter(i=>!['hidden','checkbox','radio','number','submit','button'].includes((i.type||'text').toLowerCase()));const input=inputs.find(i=>/city|zip|location|place/i.test([i.placeholder,i.getAttribute('aria-label'),i.name,i.id].filter(Boolean).join(' ')))||inputs[0];if(!input||input.dataset.seoPresetDone)return;input.dataset.seoPresetDone='1';input.value=preset;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));const form=input.closest('form');if(form)setTimeout(()=>{if(form.requestSubmit)form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));},350)};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true}):setTimeout(run,0)})();</script>`;
  html = html.replace('</body>', `${preset}</body>`);
  const out = path.join(root, `public/national-tools/${tool.slug}/${loc.slug}/index.html`);
  fs.mkdirSync(path.dirname(out), {recursive:true});
  fs.writeFileSync(out, html);
  const built = fs.readFileSync(out,'utf8');
  for (const needle of [canonical, `data-seo-location="${loc.slug}"`, 'data-location-preset', loc.name, 'FAQPage']) if (!built.includes(needle)) throw new Error(`SEO location build failed for ${loc.slug}: ${needle}`);
  if (/noindex/i.test((built.match(/<meta name="robots"[^>]*>/i)||[''])[0])) throw new Error(`Location page became noindex: ${loc.slug}`);
}
console.log(`Generated and verified ${tool.locations.length} ${tool.label} location pages.`);
