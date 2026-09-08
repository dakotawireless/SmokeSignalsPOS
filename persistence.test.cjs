const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/persistence-layer.js', 'utf8');
const saved = new Map();
const localStorage = {getItem: key => saved.get(key) ?? null, setItem: (key,value) => saved.set(key,String(value))};
const catalog = [{id:'a',name:'A',quickPick:false,inventory:0},{id:'b',name:'B'},{id:'c',name:'C'}];
const run = () => vm.runInNewContext(source,{localStorage,window:{SMOKE_SIGNALS_IMPORTED_PRODUCTS:catalog}});
const products = () => JSON.parse(saved.get('sspos_products_v2'));
run();
assert.equal(products().length,3);
localStorage.setItem('sspos_products_v2',JSON.stringify([
  {...catalog[0],quickPick:true,inventory:17,price:19},
  {...catalog[1],archived:true,quickPick:false},
  {id:'local',name:'Local product'}
]));
catalog.push({id:'new',name:'New imported product'});
run();
run();
const result = products();
assert.equal(result.find(p=>p.id==='a').quickPick,true);
assert.equal(result.find(p=>p.id==='a').inventory,17);
assert.equal(result.find(p=>p.id==='a').price,19);
assert.equal(result.find(p=>p.id==='b').archived,true);
assert.equal(result.some(p=>p.id==='c'),false);
assert.ok(JSON.parse(saved.get('sspos_deleted_product_ids_v1')).includes('c'));
assert.ok(result.some(p=>p.id==='local'));
assert.equal(result.filter(p=>p.id==='new').length,1);
console.log('PASS: quick picks, edits, stock, archives, deletion tombstones, local products and new catalog imports survive repeated startup.');
