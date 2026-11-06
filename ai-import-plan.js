(function(root,factory){var api=factory(typeof module==='object'&&module.exports?require('./batch-core'):root.BatchCore,typeof module==='object'&&module.exports?require('./ai-import-core'):root.AiImportCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.AiImportPlan=api;})(typeof window!=='undefined'?window:this,function(C,K){
'use strict';
var FIELDS=[['获奖情况','award'],['参与学校、学院的活动（请罗列）','activity']];
function clone(x){return JSON.parse(JSON.stringify(x));}
function catalog(adapter){var all=[];['ac-3','ac-4','ac-5','pt-0','pt-1','pt-2','pt-3','pt-4','pt-5'].forEach(function(target){var v=target.split('-');adapter.profiles(v[0],Number(v[1])).forEach(function(p){if(p.hours)return;var opts=p.options.filter(function(o){return o.max==null&&Number.isFinite(o.score);});if(opts.length)all.push({target:target,type:p.id,name:p.name,options:opts.map(function(o){return{key:String(o.key),label:o.label,level:o.level,score:o.score};})});});});return all;}
var CATEGORY_NAMES={'ac-3':'学科竞赛','ac-4':'创新创业','ac-5':'奖学金/荣誉','pt-0':'党课学习','pt-1':'志愿服务','pt-2':'红色活动','pt-3':'社会实践','pt-4':'国际交流','pt-5':'同辈互助'};
var CATEGORY_SCOPES={'pt-0':'党课组织管理、宣讲；含党课培训组织的参观学习，不含普通活动','pt-1':'志愿服务按累计时长计算；活动记录不另加分','pt-2':'升旗、植树、敬老院慰问、祭扫、红色基地参观、思政课、主题团日班会、青年大学习','pt-3':'三下乡、乡村振兴、百千万、千股、双百、支教、调研等社会实践','pt-4':'中外文化交流、国际学术会议、留学生交流','pt-5':'迎新、运动会、晚会、讲座、献血、巡逻、食堂协助、查寝、体检协助、职业规划、社团、体育文艺辩论演讲参与'};
function publicCatalog(all){return all.map(function(p){return{target:p.target,type:p.type,name:(CATEGORY_NAMES[p.target]||p.target)+" / "+p.name+(CATEGORY_SCOPES[p.target]?"；适用："+CATEGORY_SCOPES[p.target]:""),options:p.options.map(function(o){return{key:o.key,label:o.label,level:o.level};})};});}
function resolve(all,part){if(part.multipleOccurrences&&part.occurrenceRelation!=='same')throw Error('请先核实场次；独立比赛需补全各场记录后分别核对，暂不能按次数加分。');var p=all.find(function(p){return p.target===part.target&&p.type===part.type;}),o=p&&p.options.find(function(o){return o.key===String(part.option);});if(!o)throw Error('请选择类别和明确的计分依据，信息不足请留待审核。');var v=p.target.split('-');return{cat:v[0],si:Number(v[1]),raw:part.raw,score:o.score,level:o.level,lk:/国家|全国/.test(o.level)?'ln':/省/.test(o.level)?'lp':/市/.test(o.level)?'lm':/院/.test(o.level)?'ly':'ls',scoringType:p.type,ruleOption:o.key,auto:false};}
function memoryKey(raw,source){
 var text=String(raw||'').normalize('NFKC').toLowerCase().trim();
 if(source==='activity')text=text.replace(/^(?:20\d{2}\s*(?:年\s*(?:\d{1,2}\s*月\s*(?:\d{1,2}\s*日)?)?|[-/.]\d{1,2}(?:[-/.]\d{1,2})?))\s*[|｜:：、-]*\s*/, '');
 return text.replace(/[\s，,。；;：:|｜、]/g,'');
}
function memories(state){return Array.isArray(state.classificationMemory)?state.classificationMemory.filter(function(m){return m&&m.version===1&&['award','activity'].includes(m.source)&&typeof m.key==='string'&&m.key.length>=6&&m.key===memoryKey(m.example,m.source);}):[];}
function findMemory(state,raw,source,all){
 var key=memoryKey(raw,source),matches=memories(state).filter(function(m){return m.source===source&&m.key===key;});if(!matches.length)return null;
 var latest=matches[matches.length-1],p=all.find(function(p){return p.target===latest.target&&p.type===latest.type;}),o=p&&p.options.find(function(o){return o.key===String(latest.option);});
 if(!o||o.label!==latest.optionLabel||o.level!==latest.optionLevel)return null;
 return latest;
}
function remember(state,d,source,all){
 var key=memoryKey(d.raw,source);if(key.length<6)throw Error('活动名称过短，无法建立可靠分类记忆。');resolve(all,d);
 var p=all.find(function(p){return p.target===d.target&&p.type===d.type;}),o=p.options.find(function(o){return o.key===String(d.option);});
 var entry={version:1,source:source,key:key,example:d.raw,target:d.target,type:d.type,option:String(d.option),optionLabel:o.label,optionLevel:o.level,confirmedAt:new Date().toISOString()};
 state.classificationMemory=memories(state).filter(function(m){return m.key!==key||m.source!==source;});if(state.classificationMemory.length>=500)throw Error('分类记忆已满500条，请先删除不再需要的记忆。');state.classificationMemory.push(entry);
}
function forgetMemory(state,source,key){state.classificationMemory=memories(state).filter(function(m){return m.source!==source||m.key!==key;});}
function create(state,rows,adapter){
 var copied=clone(state),preview=C.planImport(copied,rows),sources=[],all=catalog(adapter);
 preview.entries.forEach(function(entry){if(entry.status==='conflict')return;var rowIndex=entry.sourceIndex;if(!Number.isInteger(rowIndex))throw Error('导入预览缺少原表行号。');var old=entry.targetId?state.members.find(function(m){return m._memberId===entry.targetId;}):null,manual=[];
 if(old&&old._cl)['ac','pt','dc'].forEach(function(cat){old._cl[cat].forEach(function(arr,si){arr.forEach(function(d){if(d.auto===false&&!adapter.issue(cat,si,d))manual.push(d);});});});else if(old)manual=(old._manualItems||[]).filter(function(s){return !adapter.issue(s.cat,s.si,s.item);}).map(function(s){return s.item;});
 FIELDS.forEach(function(f){var lines=adapter.split(entry.data[f[0]]||''),seen=new Set();lines.forEach(function(raw,i){var key=C.materialKey(raw);if(seen.has(key))return;seen.add(key);var reused=manual.some(function(d){return C.materialKey(d.raw)===key||d.sourceRaw&&C.materialKey(d.sourceRaw)===key;});sources.push({id:'r'+rowIndex+':'+f[1]+':'+i,rowIndex:rowIndex,field:f[0],source:f[1],name:entry.data['姓名'],className:entry.data['班级'],text:raw,parts:reused?[{raw:raw,decision:'reuse'}]:null});});});
 });
 sources.forEach(function(s){if(s.parts)return;var entry=preview.entries.find(function(e){return e.sourceIndex===s.rowIndex;}),old=entry&&entry.targetId?state.members.find(function(m){return m._memberId===entry.targetId;}):null;if(old&&(old._aiReviewItems||[]).some(function(p){return p.excluded===true&&C.materialKey(p.raw)===C.materialKey(s.text);})){s.parts=[{raw:s.text,decision:'annotation',reason:'此前管理员已确认仅作说明，不计分。'}];return;}var m=findMemory(state,s.text,s.source,all);if(m)s.parts=[{raw:s.text,target:m.target,type:m.type,option:m.option,reason:'沿用管理员确认的同名活动分类；分数按当前评分规则重新计算，仍需本次确认。',missing:[],needsReview:true,fromMemory:true}];});
 if(sources.some(function(s){return s.text.length>3000;}))throw Error('有单段材料超过3000字，请先在表格中按活动分行，再使用AI分析。');
 if(sources.length>1000)throw Error('本次材料超过1000条，请拆成较小的表格分次分析。');
 var inputRows=rows.map(function(row,i){var e=preview.entries.find(function(e){return e.sourceIndex===i;});var out=e?clone(e.data):clone(row);if(typeof row.__rowNum__==='number')out.__rowNum__=row.__rowNum__;return out;});
 return{version:1,baseSignature:C.signature(state),ruleSignature:JSON.stringify(state.rules),memorySignature:JSON.stringify(state.classificationMemory||[]),rows:inputRows,sources:sources,catalog:all,publicCatalog:publicCatalog(all),cancelled:false,analyzed:0};
}
function needsSplitReview(source){var raw=String(source.text||'');return source.parts&&source.parts.length>1||raw.length>120||((raw.match(/20\d{2}年/g)||[]).length>1)||((raw.match(/一等奖|二等奖|三等奖|金奖|银奖|铜奖|奖学金|专利|著作权/g)||[]).length>1);}
function repartition(job,sourceId,quotes){
 var source=job.sources.find(function(s){return s.id===sourceId;});if(!source)throw Error('找不到原始材料。');if(source.parts&&source.parts.some(function(p){return p.decision==='reuse';}))throw Error('已沿用原有确认记录，不能在这里重新拆分。');
 if(!Array.isArray(quotes)||!quotes.length||quotes.some(function(q){return typeof q!=='string'||!q.trim();}))throw Error('请每行填写一项原文，不要留空或添加说明。');
 var request={items:[{id:source.id,text:source.text,source:source.source}],catalog:job.publicCatalog};
 var validated=K.validateResponse(request,{results:[{id:source.id,parts:quotes.map(function(q){return{quote:q,needsReview:true,reason:'人工调整拆分后，需重新确认每项类别。'};})}]})[0].parts;
 source.parts=validated;delete source.annotationFor;source.splitChecked=true;source.manuallySplit=true;return source;
}
function previousSource(job,sourceId){var index=job.sources.findIndex(function(s){return s.id===sourceId;});if(index<1)return null;var source=job.sources[index];for(var i=index-1;i>=0;i--){var prev=job.sources[i];if(prev.rowIndex===source.rowIndex&&prev.field===source.field){if(prev.parts&&prev.parts.every(function(p){return p.decision==='annotation';}))continue;return prev;}}return null;}
function linkAnnotation(job,sourceId){var source=job.sources.find(function(s){return s.id===sourceId;}),prev=previousSource(job,sourceId);if(!source||!prev)throw Error('没有可关联的上一项材料，请保留为独立说明。');if(source.parts&&source.parts.some(function(p){return p.decision==='reuse';}))throw Error('已沿用的确认记录不能直接改成补充说明。');source.parts=[{raw:source.text,decision:'annotation',materialKind:'annotation',reason:'管理员确认：作为上一项的补充说明，不单独计分。',relatedMaterial:prev.text,missing:[]}];source.annotationFor=prev.id;source.splitChecked=true;delete source.pendingSplitText;return prev;}
function snapshot(job){var copy=clone(job);copy.running=false;copy.cancelled=false;return copy;}
function restore(state,saved,adapter){
 if(!saved||saved.version!==1||!Array.isArray(saved.rows)||!Array.isArray(saved.sources))throw Error('草稿格式不正确。');assertCurrent(saved,state);
 var fresh=create(state,saved.rows,adapter);if(fresh.sources.length!==saved.sources.length)throw Error('草稿与当前材料不一致，原草稿仍保留。');
 fresh.sources.forEach(function(source,i){var old=saved.sources[i];if(!old||old.id!==source.id||old.text!==source.text||old.source!==source.source)throw Error('草稿原文与导入材料不一致。');if(!old.parts)return;
  if(source.parts&&source.parts[0]&&source.parts[0].decision==='reuse'){if(old.parts.length!==1||old.parts[0].decision!=='reuse')throw Error('原有确认材料已变化。');return;}
  var validated=K.validateResponse({items:[{id:source.id,text:source.text,source:source.source}],catalog:fresh.publicCatalog},{results:[{id:source.id,parts:old.parts.map(function(p){return Object.assign({},p,{quote:p.raw,target:'',type:'',option:null});})}]})[0].parts;
  source.parts=validated.map(function(p,n){var oldPart=old.parts[n];if(oldPart.decision&&!['approved','pending','annotation'].includes(oldPart.decision))throw Error('草稿包含无效确认状态。');p.target=typeof oldPart.target==='string'?oldPart.target:'';p.type=typeof oldPart.type==='string'?oldPart.type:'';p.option=oldPart.option==null?'':String(oldPart.option);p.reason=String(oldPart.reason||'').slice(0,350);p.missing=Array.isArray(oldPart.missing)?oldPart.missing.filter(function(x){return typeof x==='string';}).slice(0,5):[];p.decision=oldPart.decision;p.remember=!!oldPart.remember;p.occurrenceRelation=oldPart.occurrenceRelation;if(p.decision==='approved'){resolve(fresh.catalog,p);}p.fromMemory=!!oldPart.fromMemory;if(p.decision==='annotation'&&old.annotationFor){var previous=previousSource(fresh,source.id);if(!previous||previous.id!==old.annotationFor||oldPart.relatedMaterial!==previous.text)throw Error('补充说明关联已变化，请重新核对。');p.relatedMaterial=previous.text;source.annotationFor=previous.id;}return p;});source.splitChecked=!!old.splitChecked;source.manuallySplit=!!old.manuallySplit;if(typeof old.pendingSplitText==='string')source.pendingSplitText=old.pendingSplitText.slice(0,3040);
 });
 fresh.view=saved.view==='split'?'split':'review';fresh.splitSourceId=String(saved.splitSourceId||'');fresh.source=String(saved.source||'恢复的导入草稿');fresh.cursor=Math.max(0,Number(saved.cursor)||0);fresh.analyzed=Number(saved.analyzed)||0;fresh.batchLimit=saved.batchLimit===1?1:undefined;fresh.draftId=typeof saved.draftId==='string'?saved.draftId:'';return fresh;
}
function assertCurrent(job,state){if(job.memorySignature!=null&&job.memorySignature!==JSON.stringify(state.classificationMemory||[]))throw Error('分类记忆已变化，请重新上传核对。');if(C.signature(state)!==job.baseSignature||JSON.stringify(state.rules)!==job.ruleSignature)throw Error('分析期间人员资料或计分规则已变化，请重新上传核对。');}
function finalize(job,state){
 assertCurrent(job,state);var rows=clone(job.rows),decisions=[];
 job.sources.forEach(function(source){if(!source.parts||source.parts.some(function(p){return !['reuse','approved','pending','annotation'].includes(p.decision);}))throw Error('请逐条确认，或明确选择留待人工审核。');source.parts.forEach(function(p){if(p.decision==='approved')resolve(job.catalog,p);if(p.decision!=='reuse')decisions.push(Object.assign({},clone(p),{rowIndex:source.rowIndex,field:source.field}));});});
 job.rows.forEach(function(row,i){FIELDS.forEach(function(f){var sources=job.sources.filter(function(s){return s.rowIndex===i&&s.field===f[0];});if(sources.length)rows[i][f[0]]=sources.flatMap(function(s){return s.parts.map(function(p){return p.raw;});}).join('\n');});});
 return{version:1,draftId:job.draftId,materialPartitions:job.sources.filter(function(s){return s.parts&&s.parts.length>1&&!s.parts.some(function(p){return p.decision==='reuse';});}).map(function(s){return{rowIndex:s.rowIndex,field:s.field,original:s.text,parts:s.parts.map(function(p){return p.raw;})};}),rows:rows,decisions:decisions,baseSignature:job.baseSignature,ruleSignature:job.ruleSignature,memorySignature:job.memorySignature,catalog:job.catalog};
}
function apply(state,review,result){
 if(review&&review.memorySignature!=null&&review.memorySignature!==JSON.stringify(state.classificationMemory||[]))throw Error('分类记忆已变化，请重新上传核对。');
 if(!review||review.version!==1||!result.rowMemberIds)throw Error('AI 核对结果与导入记录不匹配。');
 (review.materialPartitions||[]).forEach(function(partition){
  if(!FIELDS.some(function(f){return f[0]===partition.field;})||!Array.isArray(partition.parts)||partition.parts.length<2)throw Error('拆分记录无效。');
  K.validateResponse({items:[{id:'partition',text:partition.original,source:partition.field===FIELDS[0][0]?'award':'activity'}],catalog:publicCatalog(review.catalog)},{results:[{id:'partition',parts:partition.parts.map(function(raw){return{quote:raw,needsReview:true};})}]});
  var mid=result.rowMemberIds[partition.rowIndex],member=state.members.find(function(m){return m._memberId===mid;});if(!member)return;
  var originalKey=C.materialKey(partition.original),lines=C.materialLines(member[partition.field]||'');
  if(lines.some(function(raw){return C.materialKey(raw)===originalKey;})){
   member[partition.field]=C.mergeLines(lines.filter(function(raw){return C.materialKey(raw)!==originalKey;}).join('\n'),partition.parts.join('\n'));
   member._manualItems=(member._manualItems||[]).filter(function(s){return C.materialKey(s.item.raw)!==originalKey;});member._aiReviewItems=(member._aiReviewItems||[]).filter(function(p){return C.materialKey(p.raw)!==originalKey;});
  }
  member._materialSplitOrigins=(member._materialSplitOrigins||[]).filter(function(p){return !(p.field===partition.field&&C.materialKey(p.original)===originalKey);});member._materialSplitOrigins.push({field:partition.field,original:partition.original,parts:partition.parts.slice()});member._cl=null;member._ok=null;
 });
 var memoryChoices=new Map();review.decisions.forEach(function(d){if(d.decision!=='approved'||!d.remember)return;var source=FIELDS.find(function(f){return f[0]===d.field;});if(!source)return;var key=source[1]+':'+memoryKey(d.raw,source[1]),choice=JSON.stringify([d.target,d.type,String(d.option)]);if(memoryChoices.has(key)&&memoryChoices.get(key)!==choice)throw Error('同名活动有不同分类记忆，请统一后再导入。');memoryChoices.set(key,choice);});
 var seen=new Map();review.decisions.forEach(function(d){if(!['approved','pending','annotation'].includes(d.decision))throw Error('存在未确认的AI结果。');var mid=result.rowMemberIds[d.rowIndex];if(!mid)return;var m=state.members.find(function(m){return m._memberId===mid;});if(!m)throw Error('导入人员匹配失败。');
 var keys=FIELDS.flatMap(function(f){return C.materialLines(m[f[0]]||'').map(C.materialKey);});var key=C.materialKey(d.raw);if(!keys.includes(key))return;var identity=mid+':'+key,previous=seen.get(identity);if(previous&&JSON.stringify([previous.decision,previous.target,previous.type,previous.option])!==JSON.stringify([d.decision,d.target,d.type,d.option]))throw Error('同一材料出现了相互矛盾的确认结果。');if(previous)return;seen.set(identity,d);
 m._manualItems=m._manualItems||[];m._aiReviewItems=(m._aiReviewItems||[]).filter(function(x){return C.materialKey(x.raw)!==key;});
 if(d.decision==='approved'){var item=resolve(review.catalog,d);item.aiReason=String(d.reason||'').slice(0,350);item.analysisSource='deepseek';item.confirmedAt=new Date().toISOString();m._manualItems=m._manualItems.filter(function(s){return C.materialKey(s.item.raw)!==key;});m._manualItems.push({cat:item.cat,si:item.si,item:item});if(d.remember){var source=FIELDS.find(function(f){return f[0]===d.field;});if(source)remember(state,d,source[1],review.catalog);}}
 else if(d.decision==='annotation'){m._manualItems=m._manualItems.filter(function(s){return C.materialKey(s.item.raw)!==key;});m._aiReviewItems.push({raw:d.raw,excluded:true,reason:'管理员确认：仅作补充说明，不作为独立项目计分。',relatedMaterial:d.relatedMaterial||'',source:d.field});}
 else{m._aiReviewItems.push({raw:d.raw,reason:(d.missing||[]).join('；')||d.reason||'AI建议尚未经人工确认，请核实后归类。',target:d.target||'',source:d.field});}
 m._cl=null;m._unc=null;m._ok=null;
 });
 return state;
}
return{previousSource:previousSource,linkAnnotation:linkAnnotation,needsSplitReview:needsSplitReview,repartition:repartition,snapshot:snapshot,restore:restore,memoryKey:memoryKey,memories:memories,findMemory:findMemory,forgetMemory:forgetMemory,create:create,catalog:catalog,publicCatalog:publicCatalog,resolve:resolve,assertCurrent:assertCurrent,finalize:finalize,apply:apply};
});
