(function(root,factory){var api=factory(typeof module==='object'&&module.exports?require('./batch-core'):root.BatchCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.AiImportPlan=api;})(typeof window!=='undefined'?window:this,function(C){
'use strict';
var FIELDS=[['获奖情况','award'],['参与学校、学院的活动（请罗列）','activity']];
function clone(x){return JSON.parse(JSON.stringify(x));}
function catalog(adapter){var all=[];['ac-3','ac-4','ac-5','pt-0','pt-1','pt-2','pt-3','pt-4','pt-5'].forEach(function(target){var v=target.split('-');adapter.profiles(v[0],Number(v[1])).forEach(function(p){if(p.hours)return;var opts=p.options.filter(function(o){return o.max==null&&Number.isFinite(o.score);});if(opts.length)all.push({target:target,type:p.id,name:p.name,options:opts.map(function(o){return{key:String(o.key),label:o.label,level:o.level,score:o.score};})});});});return all;}
function publicCatalog(all){return all.map(function(p){return{target:p.target,type:p.type,name:p.name,options:p.options.map(function(o){return{key:o.key,label:o.label,level:o.level};})};});}
function resolve(all,part){var p=all.find(function(p){return p.target===part.target&&p.type===part.type;}),o=p&&p.options.find(function(o){return o.key===String(part.option);});if(!o)throw Error('请选择类别和明确的计分依据，信息不足请留待审核。');var v=p.target.split('-');return{cat:v[0],si:Number(v[1]),raw:part.raw,score:o.score,level:o.level,lk:/国家|全国/.test(o.level)?'ln':/省/.test(o.level)?'lp':/市/.test(o.level)?'lm':/院/.test(o.level)?'ly':'ls',scoringType:p.type,ruleOption:o.key,auto:false};}
function create(state,rows,adapter){
 var copied=clone(state),preview=C.planImport(copied,rows),sources=[],all=catalog(adapter);
 preview.entries.forEach(function(entry){if(entry.status==='conflict')return;var rowIndex=entry.sourceIndex;if(!Number.isInteger(rowIndex))throw Error('导入预览缺少原表行号。');var old=entry.targetId?state.members.find(function(m){return m._memberId===entry.targetId;}):null,manual=[];
 if(old&&old._cl)['ac','pt','dc'].forEach(function(cat){old._cl[cat].forEach(function(arr,si){arr.forEach(function(d){if(d.auto===false&&!adapter.issue(cat,si,d))manual.push(d);});});});else if(old)manual=(old._manualItems||[]).filter(function(s){return !adapter.issue(s.cat,s.si,s.item);}).map(function(s){return s.item;});
 FIELDS.forEach(function(f){var lines=adapter.split(entry.data[f[0]]||''),seen=new Set();lines.forEach(function(raw,i){var key=C.materialKey(raw);if(seen.has(key))return;seen.add(key);var reused=manual.some(function(d){return C.materialKey(d.raw)===key||d.sourceRaw&&C.materialKey(d.sourceRaw)===key;});sources.push({id:'r'+rowIndex+':'+f[1]+':'+i,rowIndex:rowIndex,field:f[0],source:f[1],name:entry.data['姓名'],className:entry.data['班级'],text:raw,parts:reused?[{raw:raw,decision:'reuse'}]:null});});});
 });
 if(sources.some(function(s){return s.text.length>3000;}))throw Error('有单段材料超过3000字，请先在表格中按活动分行，再使用AI分析。');
 if(sources.length>1000)throw Error('本次材料超过1000条，请拆成较小的表格分次分析。');
 var inputRows=rows.map(function(row,i){var e=preview.entries.find(function(e){return e.sourceIndex===i;});var out=e?clone(e.data):clone(row);if(typeof row.__rowNum__==='number')out.__rowNum__=row.__rowNum__;return out;});
 return{version:1,baseSignature:C.signature(state),ruleSignature:JSON.stringify(state.rules),rows:inputRows,sources:sources,catalog:all,publicCatalog:publicCatalog(all),cancelled:false,analyzed:0};
}
function assertCurrent(job,state){if(C.signature(state)!==job.baseSignature||JSON.stringify(state.rules)!==job.ruleSignature)throw Error('分析期间人员资料或计分规则已变化，请重新上传核对。');}
function finalize(job,state){
 assertCurrent(job,state);var rows=clone(job.rows),decisions=[];
 job.sources.forEach(function(source){if(!source.parts||source.parts.some(function(p){return !['reuse','approved','pending'].includes(p.decision);}))throw Error('请逐条确认，或明确选择留待人工审核。');source.parts.forEach(function(p){if(p.decision==='approved')resolve(job.catalog,p);if(p.decision!=='reuse')decisions.push(Object.assign({},clone(p),{rowIndex:source.rowIndex,field:source.field}));});});
 job.rows.forEach(function(row,i){FIELDS.forEach(function(f){var sources=job.sources.filter(function(s){return s.rowIndex===i&&s.field===f[0];});if(sources.length)rows[i][f[0]]=sources.flatMap(function(s){return s.parts.map(function(p){return p.raw;});}).join('\n');});});
 return{version:1,rows:rows,decisions:decisions,baseSignature:job.baseSignature,ruleSignature:job.ruleSignature,catalog:job.catalog};
}
function apply(state,review,result){
 if(!review||review.version!==1||!result.rowMemberIds)throw Error('AI 核对结果与导入记录不匹配。');
 var seen=new Map();review.decisions.forEach(function(d){if(!['approved','pending'].includes(d.decision))throw Error('存在未确认的AI结果。');var mid=result.rowMemberIds[d.rowIndex];if(!mid)return;var m=state.members.find(function(m){return m._memberId===mid;});if(!m)throw Error('导入人员匹配失败。');
 var keys=FIELDS.flatMap(function(f){return C.materialLines(m[f[0]]||'').map(C.materialKey);});var key=C.materialKey(d.raw);if(!keys.includes(key))return;var identity=mid+':'+key,previous=seen.get(identity);if(previous&&JSON.stringify([previous.decision,previous.target,previous.type,previous.option])!==JSON.stringify([d.decision,d.target,d.type,d.option]))throw Error('同一材料出现了相互矛盾的确认结果。');if(previous)return;seen.set(identity,d);
 m._manualItems=m._manualItems||[];m._aiReviewItems=(m._aiReviewItems||[]).filter(function(x){return C.materialKey(x.raw)!==key;});
 if(d.decision==='approved'){var item=resolve(review.catalog,d);item.aiReason=String(d.reason||'').slice(0,350);item.analysisSource='deepseek';item.confirmedAt=new Date().toISOString();m._manualItems=m._manualItems.filter(function(s){return C.materialKey(s.item.raw)!==key;});m._manualItems.push({cat:item.cat,si:item.si,item:item});}
 else{m._aiReviewItems.push({raw:d.raw,reason:(d.missing||[]).join('；')||d.reason||'AI建议尚未经人工确认，请核实后归类。',target:d.target||'',source:d.field});}
 m._cl=null;m._unc=null;m._ok=null;
 });
 return state;
}
return{create:create,catalog:catalog,publicCatalog:publicCatalog,resolve:resolve,assertCurrent:assertCurrent,finalize:finalize,apply:apply};
});
