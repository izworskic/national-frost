const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
const paths=["public/national-tools/frost/cover-plants-tonight/index.html"];
for(const filename of paths){
 test("location input is compact on desktop and on mobile: "+filename,()=>{
  const html=fs.readFileSync(path.join(__dirname,"..",filename),"utf8");
  const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(css,"expected inline tool CSS");
  assert.match(css,/\.locator input\{flex:0 1 290px;width:290px;max-width:100%;height:44px/);
  assert.match(css,/@media\(max-width:760px\)\{\.locator\{flex-direction:column;align-items:stretch\}\.locator input,\.locator button\{flex:0 0 auto;width:100%;height:44px/);
  assert.doesNotMatch(css,/\.locator (?:input|button)\{flex:(?:1|2) 1 (?:150|160|170)px\}/);
  assert.match(html,/<form[^>]+class="locator"|<form[^>]+class='locator'|<form class="locator"/);
 });
}
