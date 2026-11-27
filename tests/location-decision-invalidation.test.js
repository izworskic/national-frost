const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync("public/national-tools/frost/index.html",'utf8');
test('A new lookup retires prior decision before awaiting the location and ignores superseded decision responses',()=>{
 assert.match(source,/form.addEventListener\("submit",invalidateDecision,true\)/);
 assert.match(source,/\[data-use-location\],\[data-place-switch\]/);
 assert.match(source,/function invalidateDecision\(\)[\s\S]*?hidden=true/);
 assert.match(source,/if\(ticket!==decisionGeneration\)return/);
});
