(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AiImportCore=api;})(typeof window!=='undefined'?window:this,function(){
'use strict';
var VERSION=1,MAX_ITEMS=6,MAX_TEXT=3000,MAX_TOTAL=12000;
function fail(message){throw Error(message);}
function clean(v,n){return typeof v==='string'?v.slice(0,n):'';}
function validCatalog(catalog){
 if(!Array.isArray(catalog)||!catalog.length||catalog.length>25)fail('计分类别无效。');
 var seen=new Set();return catalog.map(function(p){if(!p||!/^ac-[345]$|^pt-[0-5]$/.test(p.target)||!/^[a-z][a-z-]{0,35}$/.test(p.type)||!Array.isArray(p.options)||!p.options.length||p.options.length>20)fail('计分类别无效。');
 var key=p.target+':'+p.type;if(seen.has(key))fail('计分类别重复。');seen.add(key);
 return{target:p.target,type:p.type,name:clean(p.name,60),options:p.options.map(function(o){if(!o||!/^\d{1,2}$/.test(String(o.key)))fail('计分档位无效。');return{key:String(o.key),label:clean(o.label,120),level:clean(o.level,100)};})};});
}
function validateRequest(items,catalog){
 var cat=validCatalog(catalog),seen=new Set(),total=0;
 if(!Array.isArray(items)||!items.length||items.length>MAX_ITEMS)fail('每次分析最多 '+MAX_ITEMS+' 段材料。');
 var safe=items.map(function(x){if(!x||typeof x.id!=='string'||!/^[a-z0-9:-]{1,70}$/i.test(x.id)||seen.has(x.id))fail('材料标识无效。');seen.add(x.id);
 if(typeof x.text!=='string'||!x.text.trim()||x.text.length>MAX_TEXT)fail('单段材料为空或超过 '+MAX_TEXT+' 字，请拆分后重试。');
 if(x.source!=='award'&&x.source!=='activity')fail('材料来源无效。');total+=x.text.length;return{id:x.id,text:x.text,source:x.source};});
 if(total>MAX_TOTAL)fail('本次材料文字过多，请分批分析。');return{items:safe,catalog:cat};
}
function separatorOnly(text){return /^[\s|｜;；,，、。:：]*$/.test(text);}
function validateResponse(request,payload){
 var input=validateRequest(request.items,request.catalog);
 if(!payload||!Array.isArray(payload.results)||payload.results.length!==input.items.length)fail('AI 返回条目不完整，未采用结果。');
 var seen=new Set();return input.items.map(function(source){
 var matches=payload.results.filter(function(r){return r&&r.id===source.id;});if(matches.length!==1||seen.has(source.id))fail('AI 返回标识不匹配。');seen.add(source.id);var result=matches[0];
 if(!Array.isArray(result.parts)||!result.parts.length||result.parts.length>40)fail('AI 未返回有效的原文拆分。');var cursor=0;
 var parts=result.parts.map(function(p){
 if(!p||typeof p.quote!=='string'||!p.quote.trim())fail('AI 缺少原文依据。');var quote=p.quote.trim(),start=source.text.indexOf(quote,cursor);
 if(start<0||!separatorOnly(source.text.slice(cursor,start)))fail('AI 改写或遗漏了原文，未采用结果。');cursor=start+quote.length;
 var target=clean(p.target,12),type=clean(p.type,36),key=p.option==null?'':String(p.option);
 var rule=input.catalog.find(function(c){return c.target===target&&c.type===type;}),option=rule&&rule.options.find(function(o){return o.key===key;});
 var missing=Array.isArray(p.missing)?p.missing.filter(function(s){return typeof s==='string';}).slice(0,5).map(function(s){return s.slice(0,120);}):[];
 var needsReview=p.needsReview!==false||!option||!!missing.length;
 return{raw:quote,target:rule?target:'',type:rule?type:'',option:option?key:'',reason:clean(p.reason,350),missing:missing,needsReview:needsReview,confidence:typeof p.confidence==='number'?Math.max(0,Math.min(1,p.confidence)):0};
 });
 if(!separatorOnly(source.text.slice(cursor)))fail('AI 遗漏了原文尾部，未采用结果。');return{id:source.id,parts:parts};
 });
}
return{VERSION:VERSION,MAX_ITEMS:MAX_ITEMS,MAX_TEXT:MAX_TEXT,MAX_TOTAL:MAX_TOTAL,validateRequest:validateRequest,validateResponse:validateResponse};
});
