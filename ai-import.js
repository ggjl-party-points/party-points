(function(){
'use strict';
var P=window.AiImportPlan,K=window.AiImportCore,J=null,FUNCTION_NAME='party-points-ai-import';
function el(id){return document.getElementById(id);}function safe(x){return esc(x==null?'':String(x));}
var draftStore=null,draftFailure='';
function drafts(){if(draftStore)return draftStore;if(!window.AiImportDrafts||typeof localStorage==='undefined'||typeof _encrypt!=='function'||typeof _decrypt!=='function')return null;var owner=typeof CLOUD!=='undefined'?CLOUD.env+':'+CLOUD.adminUid:'local-admin';draftStore=window.AiImportDrafts.create({storage:localStorage,owner:owner,getKey:function(){return _cloudKey;},encrypt:_encrypt,decrypt:_decrypt,snapshot:P.snapshot});return draftStore;}
function draftStatus(message){var node=el('aiDraftStatus');if(node)node.textContent=message;}
function saveDraft(job){if(!job||!job.draftId)return Promise.resolve();var store=drafts();if(!store){draftStatus('当前环境不支持草稿保存，请勿刷新。');return Promise.resolve();}if(J===job)draftStatus('正在加密保存草稿…');return store.save(job).then(function(info){draftFailure='';if(J===job)draftStatus(store.pending()?'正在保存最新核对…':'草稿已保存于当前浏览器 '+new Date(info.savedAt).toLocaleTimeString('zh-CN',{hour12:false}));return info;}).catch(function(e){draftFailure=e.message;if(J===job)draftStatus(e.message);throw e;});}
function checkpoint(){if(J)saveDraft(J).catch(function(){});}
function newDraftId(){return 'draft-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}
async function saveAndClose(){if(!J)return close();var job=J;job.cancelled=true;try{await saveDraft(job);close();}catch(e){showReviewError(e.message);}}
async function openDrafts(){
 if(!_cloudKey)return toast('请先登录管理员后恢复草稿。','err');var store=drafts();if(!store)return toast('当前浏览器无法保存草稿。','err');
 var d=el('aiDraftListDialog');if(!d){d=document.createElement('dialog');d.id='aiDraftListDialog';d.className='ai-import-dialog';document.body.appendChild(d);}var entries=store.list();
 d.innerHTML='<div class="ai-import-shell"><header><h2>继续核对草稿</h2><button class="btn" id="draftListClose">×</button></header><div class="ai-import-body"><p>草稿加密保存在当前电脑的当前浏览器，不写入成员积分。登录后可恢复；清理浏览器数据会删除草稿。</p><p id="draftListError" class="ai-warning" role="alert"></p>'+(entries.length?entries.map(function(entry,i){return '<article class="ai-memory-row"><p>保存时间：'+safe(new Date(entry.savedAt).toLocaleString('zh-CN'))+'</p><button class="btn btn-p" data-draft-resume="'+i+'">继续核对</button> <button class="btn" data-draft-remove="'+i+'">删除草稿</button></article>';}).join(''):'<p>暂无草稿。下次分析和人工核对时会自动保存。</p>')+'</div></div>';
 if(!d.open)d.showModal();el('draftListClose').onclick=function(){d.close();};
 d.querySelectorAll('[data-draft-resume]').forEach(function(button){button.onclick=async function(){try{if(J&&J.running)throw Error('请先停止当前分析。');if(J)await saveDraft(J);var saved=await store.load(entries[Number(button.getAttribute('data-draft-resume'))].id),job=P.restore(APP,saved,{split:sp,profiles:scoringProfiles,issue:scoringIssue});J=job;d.close();var splitSource=job.sources.find(function(s){return s.id===job.splitSourceId;});if(job.view==='split'&&splitSource&&splitSource.parts)editSplit(splitSource,job.cursor);else if(job.sources.some(function(s){return !s.parts;}))ready();else if(flat(job).length)review(job.cursor);else ready();}catch(e){el('draftListError').textContent=e.message;}};});
 d.querySelectorAll('[data-draft-remove]').forEach(function(button){button.onclick=async function(){if(!confirm('删除这份未导入草稿？不会删除成员或积分。'))return;try{await store.remove(entries[Number(button.getAttribute('data-draft-remove'))].id);openDrafts();}catch(e){el('draftListError').textContent=e.message;}};});
}
function importCommitted(id){var store=drafts();if(store&&id)store.remove(id).catch(function(e){toast('导入已完成，但草稿清理失败：'+e.message,'err');});}
function dialog(){var d=el('aiImportDialog');if(d)return d;d=document.createElement('dialog');d.id='aiImportDialog';d.className='ai-import-dialog';d.setAttribute('aria-labelledby','aiImportTitle');document.body.appendChild(d);d.addEventListener('cancel',function(e){e.preventDefault();cancel();});return d;}
function shell(title,body,actions){var d=dialog();d.innerHTML='<div class="ai-import-shell"><header><div><span>AI辅助导入 · 确认前不写入成员积分</span><p id="aiDraftStatus" role="status" aria-live="polite"></p><h2 id="aiImportTitle">'+safe(title)+'</h2></div><button class="btn" id="aiImportClose" aria-label="关闭AI导入">×</button></header><div class="ai-import-body">'+body+'</div><footer>'+actions+'</footer></div>';if(!d.open)d.showModal();el('aiImportClose').onclick=cancel;checkpoint();}
function close(){if(J)J.cancelled=true;J=null;var d=el('aiImportDialog');if(d&&d.open)d.close();}
function cancel(){if(!J)return close();if(J.running&&!confirm('停止分析并保存已完成部分？当前已提交请求仍可能产生费用。'))return;var store=drafts();if(store){saveAndClose();return;}if((J.running||J.analyzed)&&!confirm('当前环境无法保存草稿，关闭会丢失未导入结果。继续关闭？'))return;close();}
async function call(data){if(!_cloudApp||!_cloudKey||!CLOUD_ENABLED)throw Error('请先登录学院管理员账号。');await _cloudLogin();var response=await _cloudApp.callFunction({name:FUNCTION_NAME,data:data,timeout:90000});var r=response&&response.result;if(typeof r==='string'){try{r=JSON.parse(r);}catch(e){r=null;}}if(!r||typeof r.ok!=='boolean')throw Error('AI后台响应无效，请检查云函数配置。');if(!r.ok){var failure=Error(r.message||'AI分析未完成，请稍后重试。');failure.code=r.code;throw failure;}return r;}
function statusText(text){var e=el('aiConnectionStatus');if(e)e.textContent=text;}
async function checkConnection(){statusText('正在检查AI后台…');try{var r=await call({action:'status'});statusText(r.configured?(r.promptRevision==='context-v3'?'AI后台已连接，分类指令已更新。':'AI后台已连接，但分类指令需更新至context-v3后再分析。'):'AI后台已连接，尚未配置DeepSeek密钥。');return !!r.configured;}catch(e){statusText('AI尚未接通，可继续使用规则识别。');toast('AI尚未接通：请先部署云函数并配置密钥。','err');return false;}}
function fallback(){if(!J)return;var rows=J.rows,source=J.source;close();AppWorkflow.previewImport(rows,source);}
function showReviewError(message){var error=el('aiReviewError');if(!error){error=document.createElement('p');error.id='aiReviewError';error.className='ai-warning';var d=dialog();var body=d.querySelector?d.querySelector('.ai-import-body'):null;(body||d).appendChild(error);}error.setAttribute('role','alert');error.textContent=message;if(error.scrollIntoView)error.scrollIntoView({block:'nearest'});}
function preview(){
 if(!J||J.running)return;var job=J;
 if(job.sources.some(function(s){return !s.parts;})){ready('还有材料未完成分析，请继续分析，或明确选择“其余留待审核并预览”。');return;}
 var all=flat(job),first=all.findIndex(function(x){return !x.part.decision;});if(first>=0){review(first);showReviewError('还有 '+all.filter(function(x){return !x.part.decision;}).length+' 条尚未确认。已定位第一条：请选择“确认本条”或“留待人工审核”。仅点“下一条”不算确认。');return;}
 try{var payload=P.finalize(job,APP),source=job.source;var opened=AppWorkflow.previewImport(payload.rows,source,payload);if(opened===false){showReviewError('导入预览未能打开，核对结果仍保留。请检查登录和数据是否发生变化。');return;}close();}catch(e){showReviewError(e.message||'预览未能打开，核对结果仍保留。');}
}
function remainPending(){if(!J||J.running)return;if(!confirm('其余未确认的材料将保留为待人工审核，暂不计分。确认进入导入预览？'))return;J.sources.forEach(function(s){if(!s.parts)s.parts=[{raw:s.text,reason:'本条尚未完成AI分析，请人工核对。',decision:'pending',missing:[]}];s.parts.forEach(function(p){if(!p.decision)p.decision='pending';});});preview();}
function flat(job){var all=[];job.sources.forEach(function(s){(s.parts||[]).forEach(function(p,i){if(p.decision!=='reuse')all.push({source:s,part:p,index:i});});});return all;}
function editSplit(source,index){
 J.view='split';J.splitSourceId=source.id;
 var previous=P.previousSource(J,source.id);
 var original=J.rows[source.rowIndex]&&J.rows[source.rowIndex][source.field]||source.text;
 shell('原文对照与拆分核对','<section class="ai-source"><h3>该成员此栏完整原文</h3><p>'+safe(original)+'</p></section><section class="ai-source"><h3>当前分析的原文段落</h3><p>'+safe(source.text)+'</p></section><p>每行一项。只在原文中换行：可拆成多项，也可合并相邻项；不能删改、调换或添加原文。补充说明可单独保留，稍后标为“仅作说明”。</p><textarea id="aiSplitText" maxlength="3040" rows="10" aria-label="每行一项原文">'+safe(source.pendingSplitText!=null?source.pendingSplitText:(source.parts||[{raw:source.text}]).map(function(p){return p.raw;}).join('\n'))+'</textarea><p id="aiReviewError" class="ai-warning" role="alert"></p>',(previous?'<button class="btn" id="aiAttachNote">作为上一项的补充说明，不计分</button>':'')+'<button class="btn" id="aiSplitCancel">返回核对</button><button class="btn" id="aiSplitChecked">原拆分完整，不作调整</button><button class="btn btn-p" id="aiSplitSave">保存拆分／合并，重新核对本段</button>');
 if(el('aiAttachNote'))el('aiAttachNote').onclick=function(){if(!confirm('将当前段落关联到上一项：'+previous.text+'\n仅当前说明不计分，上一项的确认结果保持不变。继续？'))return;try{P.linkAnnotation(J,source.id);checkpoint();review(index);}catch(e){showReviewError(e.message);}};
 el('aiSplitText').oninput=function(){source.pendingSplitText=this.value;checkpoint();};
 el('aiSplitCancel').onclick=function(){review(index);};el('aiSplitChecked').onclick=function(){delete source.pendingSplitText;source.splitChecked=true;checkpoint();review(index);};el('aiSplitSave').onclick=function(){try{P.repartition(J,source.id,el('aiSplitText').value.split(/\r?\n/).filter(function(s){return s.trim();}));delete source.pendingSplitText;checkpoint();review(Math.max(0,flat(J).findIndex(function(x){return x.source.id===source.id;})));}catch(e){showReviewError('保存未完成：这里只能拆分或合并“当前分析的原文段落”，不能补入上一段文字。若这是上一项的说明，请使用“作为上一项的补充说明”。原始提示：'+e.message);}};
}
function review(index){
 var job=J;if(!job)return;var all=flat(job),remaining=all.filter(function(x){return !x.part.decision;}).length;
 if(!all.length&&job.sources.some(function(s){return !s.parts;})){ready('尚无已完成的分析，请先开始或继续AI分析。');return;}
 if(!all.length){shell('没有待核对的新材料','<p>原来人工确认过的条目已沿用，没有需要重复调用AI的材料。</p>','<button class="btn btn-p" id="aiFinish">进入导入预览</button>');el('aiFinish').onclick=preview;return;}
 job.view='review';
 index=Math.max(0,Math.min(index==null?(job.cursor||0):index,all.length-1));job.cursor=index;var current=all[index],s=current.source,p=current.part;if(p.decision==='annotation'){p.target='';p.type='';p.option='';p.remember=false;}
 var linked=s.parts&&s.parts[0]&&s.parts[0].relatedMaterial;
 var title=s.name+' · '+(s.source==='award'?'获奖材料':'活动经历');
 shell(title,(linked?'<section class="ai-source"><h3>已关联到上一项（说明不单独计分）</h3><p>'+safe(linked)+'</p></section>':'')+'<div class="ai-review-progress">第 '+(index+1)+' / '+all.length+' 条 · 尚未确认 '+remaining+' 条 · 已沿用 '+job.sources.filter(function(s){return s.parts&&s.parts[0]&&s.parts[0].decision==='reuse';}).length+' 条原有确认记录</div><div class="ai-split-overview"><span>本段原文已拆为 '+s.parts.length+' 项'+(P.needsSplitReview(s)&&!s.splitChecked?' · 请核对是否漏拆':'')+'</span><button class="btn btn-s" id="aiEditSplit">原文对照／拆分／合并</button></div><section class="ai-source"><h3>当前条目原文</h3><p>'+safe(p.raw)+'</p></section><section class="ai-reason"><strong>AI建议依据</strong><p>'+safe(p.reason||'需要人工判断。')+'</p>'+(p.missing&&p.missing.length?'<p class="ai-warning">缺少：'+safe(p.missing.join('；'))+'</p>':'')+'<small>AI只提供建议。没有原文或佐证依据的级别，请留待审核。</small></section>'+(p.multipleOccurrences?'<section class="ai-warning"><strong>多次获奖需要核对</strong><p>同一赛事不同阶段只取最高等级；独立场次需有各自明确记录。不能因“两次”直接加倍。</p><select id="aiOccurrence"><option value="">请选择场次关系</option><option value="same">同一赛事不同阶段／重复描述，只计一项</option><option value="separate">两场独立比赛，需补全各场日期及证明，暂留待审核</option></select></section>':'')+'<div class="ai-score-fields"><label>归类到<select id="aiTarget"></select></label><label>材料类型<select id="aiType"></select></label><label>级别／计分依据<select id="aiOption"></select></label><div class="ai-score-result">系统按规则计算：<strong id="aiPoints">待确认</strong></div></div><label class="ai-remember"><input type="checkbox" id="aiRemember"> 记住此活动的分类，下次同名活动优先沿用（最终确认导入后保存）</label><p id="aiReviewError" class="ai-warning"></p><p>当前状态：'+(p.decision==='approved'?'已人工确认':p.decision==='pending'?'已标记待人工审核':p.decision==='annotation'?'仅作说明，不计分':'尚未确认')+'</p>',
 '<div><button class="btn" id="aiPrev"'+(index?'':' disabled')+'>上一条</button><button class="btn" id="aiNext"'+(index<all.length-1?'':' disabled')+'>下一条</button></div><div><button class="btn" id="aiAnnotation">仅作说明，不计分</button><button class="btn" id="aiPending">留待人工审核</button><button class="btn btn-p" id="aiApprove">确认本条</button></div><div class="ai-finish-actions"><button class="btn" id="aiContinue">返回分析进度</button><button class="btn" id="aiRestPending">其余留待审核并预览</button><button class="btn btn-p" id="aiFinish">全部核对完成，预览导入</button></div>');
 el('aiEditSplit').onclick=function(){editSplit(s,index);};
 el('aiRemember').checked=!!p.remember;if(el('aiOccurrence'))el('aiOccurrence').value=p.occurrenceRelation||'';
 var targets=Array.from(new Set(job.catalog.map(function(c){return c.target;})));el('aiTarget').innerHTML='<option value="">请选择类别</option>'+targets.map(function(t){var v=t.split('-');return'<option value="'+t+'">'+safe((v[0]==='ac'?AC:PS)[Number(v[1])])+'</option>';}).join('');el('aiTarget').value=p.target||'';
 function score(){if(p.decision==='annotation'){el('aiPoints').textContent='0分（仅作说明，不计分）';return;}if(p.decision==='pending'){el('aiPoints').textContent='暂不计分（待人工审核）';return;}try{var item=P.resolve(job.catalog,{raw:p.raw,multipleOccurrences:p.multipleOccurrences,occurrenceRelation:el('aiOccurrence')?el('aiOccurrence').value:p.occurrenceRelation,target:el('aiTarget').value,type:el('aiType').value,option:el('aiOption').value});el('aiPoints').textContent=(item.score>0?'+':'')+item.score+'分';}catch(e){el('aiPoints').textContent='信息不足，暂不计分';}}
 function options(initial){var type=job.catalog.find(function(c){return c.target===el('aiTarget').value&&c.type===el('aiType').value;});el('aiOption').innerHTML='<option value="">请选择明确依据</option>'+(type?type.options.map(function(o){return'<option value="'+safe(o.key)+'">'+safe(o.label)+' · '+o.score+'分</option>';}).join(''):'');el('aiOption').value=initial&&p.option!=null?String(p.option):'';score();}
 function types(initial){var choices=job.catalog.filter(function(c){return c.target===el('aiTarget').value;});el('aiType').innerHTML='<option value="">请选择材料类型</option>'+choices.map(function(c){return'<option value="'+safe(c.type)+'">'+safe(c.name)+'</option>';}).join('');el('aiType').value=initial?p.type||'':'';options(initial);}
 el('aiTarget').onchange=function(){types(false);};el('aiType').onchange=function(){options(false);};function captureFields(){p.target=el('aiTarget').value;p.type=el('aiType').value;p.option=el('aiOption').value;if(el('aiOccurrence'))p.occurrenceRelation=el('aiOccurrence').value;delete p.decision;checkpoint();score();}
 el('aiTarget').onchange=function(){types(false);captureFields();};el('aiType').onchange=function(){options(false);captureFields();};el('aiOption').onchange=captureFields;if(el('aiOccurrence'))el('aiOccurrence').onchange=captureFields;el('aiRemember').onchange=function(){p.remember=this.checked;checkpoint();};types(true);
 function advance(){checkpoint();review(Math.min(index+1,all.length-1));}
 el('aiApprove').onclick=function(){if(p.decision==='annotation'){delete p.decision;checkpoint();review(index);return;}try{var changed=Object.assign({},p,{target:el('aiTarget').value,type:el('aiType').value,option:el('aiOption').value,decision:'approved',occurrenceRelation:el('aiOccurrence')?el('aiOccurrence').value:p.occurrenceRelation,remember:el('aiRemember').checked,missing:[]});if(P.needsSplitReview(s)&&!s.splitChecked)throw Error('请先点击“原文对照／拆分／合并”，核对本段是否包含多个项目。');P.resolve(job.catalog,changed);if(changed.remember&&P.memoryKey(changed.raw,s.source).length<6)throw Error('名称过短，请取消记住分类，或补全活动名称后再导入。');s.parts[current.index]=changed;advance();}catch(e){el('aiReviewError').textContent=e.message;}};
 el('aiAnnotation').onclick=function(){p.decision='annotation';p.remember=false;p.target='';p.type='';p.option='';p.missing=[];p.reason='管理员已确认：此条仅作补充说明，不单独计分。';checkpoint();review(index);};el('aiPending').onclick=function(){if(el('aiOccurrence'))p.occurrenceRelation=el('aiOccurrence').value;p.decision='pending';advance();};el('aiPrev').onclick=function(){review(index-1);};el('aiNext').onclick=function(){review(index+1);};if(p.decision==='annotation'){['aiTarget','aiType','aiOption','aiRemember','aiOccurrence','aiAnnotation'].forEach(function(id){if(el(id))el(id).disabled=true;});el('aiApprove').textContent='改为计分条目';var notice=document.createElement('p');notice.id='aiAnnotationDone';notice.className='ai-confirmation';notice.setAttribute('role','status');notice.textContent='已标记为补充说明：0分。此条已处理，可点“下一条”；若尚未确认为0，可点“全部核对完成，预览导入”。';var body=dialog().querySelector?dialog().querySelector('.ai-import-body'):null;if(body)body.insertBefore(notice,body.firstChild);else dialog().appendChild(notice);}
 el('aiContinue').onclick=function(){ready();};el('aiRestPending').onclick=remainPending;el('aiFinish').onclick=preview;
}
function ready(error){
 var job=J;if(!job)return;var todo=job.sources.filter(function(s){return !s.parts;}),reused=job.sources.filter(function(s){return s.parts&&s.parts[0]&&s.parts[0].decision==='reuse';}).length;
 var remembered=job.sources.filter(function(s){return s.parts&&s.parts.some(function(p){return p.fromMemory;});}).length;
 shell('AI分析前核对','<p>本次有 '+todo.length+' 段待分析材料，'+reused+' 段原来人工确认过的材料将直接沿用。</p><p>另有 '+remembered+' 段匹配分类记忆，无需调用AI，仍需本次核对确认。</p><p>只发送活动、获奖文字，不发送姓名、班级、学号等表格字段。调用DeepSeek会产生接口费用。</p><p>AI结果需要逐条确认；分数由系统按现有规则计算。关闭或停止分析不会保存资料。</p>'+(error?'<p class="ai-warning">'+safe(error)+'</p>':'')+'<p id="aiRunProgress"></p>',
 '<button class="btn" id="aiUseRules">改用规则识别</button><button class="btn" id="aiReviewReady">核对已分析材料</button><button class="btn btn-p" id="aiStart">'+(todo.length?'开始／继续AI分析':'查看核对结果')+'</button>');
 el('aiUseRules').onclick=fallback;el('aiReviewReady').onclick=function(){review();};el('aiStart').onclick=function(){if(todo.length)run();else review();};
}
async function run(){
 var job=J;if(!job||job.running)return;job.running=true;job.cancelled=false;
 shell('正在分析材料','<p id="aiRunProgress">正在检查后台连接…</p><p>按小批次依次分析。停止后不再发起后续请求；已经提交的请求可能计费。</p>','<button class="btn" id="aiStop">停止后核对已完成部分</button>');
 el('aiStop').onclick=function(){job.cancelled=true;el('aiRunProgress').textContent='正在停止，等待当前批次结束…';};
 try{
  await saveDraft(job);var status=await call({action:'status'});if(!status.configured)throw Error('后台尚未配置DeepSeek密钥。请先在腾讯云云函数中配置，或改用规则识别。');
  if(status.promptRevision!=='context-v3')throw Error('云端分类指令仍是旧版，请将party-points-ai-import更新为context-v3后再分析。本次尚未调用DeepSeek，也未修改成员。');
  while(J===job&&!job.cancelled){
   P.assertCurrent(job,APP);var todo=job.sources.filter(function(s){return !s.parts;});if(!todo.length)break;var batch=[],chars=0;for(var i=0;i<todo.length&&batch.length<(job.batchLimit||K.MAX_ITEMS);i++){if(todo[i].text.length>K.MAX_TEXT)throw Error('有一段材料超过'+K.MAX_TEXT+'字，请拆分表格内容后重新上传。');if(chars+todo[i].text.length>K.MAX_TOTAL)break;batch.push(todo[i]);chars+=todo[i].text.length;}
   var request={version:1,action:'analyze',items:batch.map(function(s){return{id:s.id,text:s.text,source:s.source};}),catalog:job.publicCatalog};K.validateRequest(request.items,request.catalog);
   el('aiRunProgress').textContent='已分析 '+job.analyzed+' / '+job.sources.filter(function(s){return !s.parts||s.parts[0].decision!=='reuse';}).length+' 段，正在处理下一批…';
   try{
    var result=await call(request);if(J!==job)return;
    var data={results:(result.results||[]).map(function(r){return{id:r.id,parts:(r.parts||[]).map(function(p){return Object.assign({},p,{quote:p.raw});})};})};
    var validated;try{validated=K.validateResponse(request,data);}catch(validationError){validationError.code='INVALID_RESULT';throw validationError;}
    validated.forEach(function(r){var source=job.sources.find(function(s){return s.id===r.id;});source.parts=r.parts;});job.analyzed+=batch.length;await saveDraft(job);
   }catch(batchError){
    if(J!==job)return;
    if(batchError.code!=='INVALID_RESULT')throw batchError;
    job.batchLimit=1;
    if(batch.length>1)throw Error('本批结果未通过原文完整性检查。已完成的分析仍保留；点击“开始 / 继续AI分析”后，将逐段处理剩余材料，不会重跑已完成部分。');
    batch[0].parts=[{raw:batch[0].text,target:'',type:'',option:'',reason:'AI结果未通过原文完整性检查，已完整保留原始填写内容，请人工分类核对。',missing:['需要人工核对原文'],needsReview:true,confidence:0}];job.analyzed++;await saveDraft(job);
   }
  }
  if(J===job){job.running=false;if(job.sources.some(function(s){return !s.parts;}))ready('分析已停止。可以继续分析，或先核对已完成部分。');else review();}
 }catch(e){if(J===job){job.running=false;ready(e.message||'AI分析未完成。');}}finally{job.running=false;}
}
function manageMemory(){
 var all=P.catalog({profiles:scoringProfiles}),items=P.memories(APP),d=el('classificationMemoryDialog');if(!d){d=document.createElement('dialog');d.id='classificationMemoryDialog';d.className='ai-import-dialog';document.body.appendChild(d);d.addEventListener('cancel',function(e){e.preventDefault();d.close();});}
 d.innerHTML='<div class="ai-import-shell"><header><div><h2>分类记忆</h2><p>仅保存管理员明确勾选并完成导入的分类；同名活动仍需确认，积分按当前规则计算。</p></div><button class="btn" id="memoryClose" aria-label="关闭分类记忆">×</button></header><div class="ai-import-body">'+(items.length?items.map(function(m,i){var p=all.find(function(p){return p.target===m.target&&p.type===m.type;}),o=p&&p.options.find(function(o){return o.key===m.option;}),v=m.target.split('-'),valid=o&&o.label===m.optionLabel&&o.level===m.optionLevel;return '<article class="ai-memory-row"><p>'+safe(m.example)+'</p><p>'+safe((v[0]==='ac'?AC:PS)[Number(v[1])])+' · '+safe(p?p.name:m.type)+' · '+safe(m.optionLabel)+(valid?' · 当前 '+o.score+'分':' · 规则已变，暂停沿用')+'</p><button class="btn" data-memory-edit="'+i+'">修改</button> <button class="btn" data-memory-delete="'+i+'">删除</button></article>';}).join(''):'<p>暂无分类记忆。在材料核对时勾选“记住此活动的分类”，最终确认导入后就会显示在这里。</p>')+'</div></div>';
 if(!d.open)d.showModal();el('memoryClose').onclick=function(){d.close();};
 function saveMemoryChange(){if(typeof _cloudConflict!=='undefined'&&_cloudConflict)throw Error('请先处理云端数据冲突。');}
 function bindAttribute(attr,handler){d.querySelectorAll('['+attr+']').forEach(function(b){b.onclick=function(){handler(Number(b.getAttribute(attr)));};});}
 bindAttribute('data-memory-delete',function(i){if(!confirm('删除这条分类记忆？不会删除成员材料或改变已保存积分。'))return;try{saveMemoryChange();P.forgetMemory(APP,items[i].source,items[i].key);svNow();manageMemory();}catch(e){toast(e.message,'err');}});
 bindAttribute('data-memory-edit',function(i){var m=items[i];d.innerHTML='<div class="ai-import-shell"><header><h2>修改分类记忆</h2><button class="btn" id="memoryBack">取消</button></header><div class="ai-import-body"><p>'+safe(m.example)+'</p><label>分类与材料类型<select id="memoryType">'+all.map(function(p,n){var v=p.target.split('-');return '<option value="'+n+'">'+safe((v[0]==='ac'?AC:PS)[Number(v[1])])+' / '+safe(p.name)+'</option>';}).join('')+'</select></label><label>计分依据<select id="memoryOption"></select></label><p>仅影响下次识别，不修改已保存的成员积分。</p></div><footer><button class="btn btn-p" id="memorySave">保存修改</button></footer></div>';var type=el('memoryType'),option=el('memoryOption');type.value=String(Math.max(0,all.findIndex(function(p){return p.target===m.target&&p.type===m.type;})));function options(){var p=all[Number(type.value)];option.innerHTML=p.options.map(function(o){return '<option value="'+safe(o.key)+'">'+safe(o.label)+' · '+o.score+'分</option>';}).join('');}type.onchange=options;options();option.value=m.option;el('memoryBack').onclick=manageMemory;el('memorySave').onclick=function(){try{saveMemoryChange();var p=all[Number(type.value)],o=p.options.find(function(o){return o.key===option.value;});if(!o)throw Error('请选择计分依据。');var live=P.memories(APP).find(function(x){return x.key===m.key&&x.source===m.source;});if(!live||JSON.stringify(live)!==JSON.stringify(m))throw Error('分类记忆已变化，请重新打开。');live.target=p.target;live.type=p.type;live.option=o.key;live.optionLabel=o.label;live.optionLevel=o.level;live.confirmedAt=new Date().toISOString();svNow();manageMemory();}catch(e){toast(e.message,'err');}};});
}
function sampleLabelMatches(actual,expected){function normalize(text){return String(text||'').normalize('NFKC').replace(/[\s/、，,；;：:（）()]/g,'');}return normalize(actual)===normalize(expected);}
var sampleRunning=false;
async function testSamples(){
 if(sampleRunning)return;if(!confirm('将用10条材料示例测试系统AI，会产生少量接口费用；仅显示首次分析结果，不导入任何人员或保存分类记忆。继续？'))return;
 var d=el('aiSampleDialog');if(!d){d=document.createElement('dialog');d.id='aiSampleDialog';d.className='ai-import-dialog';document.body.appendChild(d);}
 var stopped=false;d.oncancel=function(e){e.preventDefault();stopped=true;d.close();};
 d.innerHTML='<div class="ai-import-shell"><header><h2>AI分类小测试</h2><button class="btn" id="sampleClose">×</button></header><div class="ai-import-body"><p id="sampleProgress">检查云端指令版本…</p><div id="sampleResults"></div></div></div>';d.showModal();el('sampleClose').onclick=function(){stopped=true;d.close();};sampleRunning=true;
 try{
  var status=await call({action:'status'});if(stopped)return;if(status.promptRevision!=='context-v3')throw Error('云端仍是旧分类指令。请先更新party-points-ai-import代码，再运行测试；本次尚未调用DeepSeek。');
  if(!status.configured)throw Error('云端未配置DeepSeek密钥。');
  var cat=P.catalog({profiles:scoringProfiles}),publicCat=P.publicCatalog(cat),samples=window.AiImportSamples,passed=0,completed=0;
  for(var i=0;i<samples.length&&!stopped;i++){
   var sample=samples[i],request={action:'analyze',version:1,items:[{id:'sample:'+i,text:sample.text,source:sample.source}],catalog:publicCat};el('sampleProgress').textContent='正在测试 '+(i+1)+' / '+samples.length+'；每条只请求一次，不自动重试。';
   try{var r=await call(request);if(stopped)return;var verified=K.validateResponse(request,{results:r.results.map(function(x){return{id:x.id,parts:x.parts.map(function(p){return Object.assign({},p,{quote:p.raw});})};})}),parts=verified[0].parts,p=parts[0],rule=cat.find(function(c){return c.target===p.target&&c.type===p.type;}),option=rule&&rule.options.find(function(o){return o.key===p.option;}),ok=parts.length===1&&p.target===sample.target&&p.type===sample.type;
    if(sample.multiple)ok=ok&&p.multipleOccurrences&&p.needsReview;if(sample.annotation)ok=ok&&p.materialKind==='annotation';if(sample.pending)ok=ok&&!p.option&&p.needsReview;else ok=ok&&!!option&&(!sample.optionLabel||sampleLabelMatches(option.label,sample.optionLabel))&&(!sample.optionLevel||option.level===sample.optionLevel);
    if(ok)passed++;completed++;var v=(p.target||'').split('-'),expected=sample.target.split('-');el('sampleResults').innerHTML+='<article class="ai-memory-row"><strong>'+(ok?'符合预期':'需要检查')+'</strong><p>'+safe(sample.text)+'</p><p>预期：'+safe(sample.annotation?'仅作说明，不计分':(expected[0]==='ac'?AC:PS)[Number(expected[1])])+' / '+safe(sample.type)+(sample.pending?' / 暂不计分':'')+'</p><p>实际：'+safe(rule?((v[0]==='ac'?AC:PS)[Number(v[1])])+' / '+rule.name:'未分类')+' / '+safe(option?option.label+'（'+option.score+'分）':'无计分依据')+'</p><p>'+safe(p.reason)+'</p></article>';
   }catch(e){if(stopped)return;completed++;el('sampleResults').innerHTML+='<article class="ai-memory-row"><strong>测试未完成</strong><p>'+safe(sample.text)+'</p><p>'+safe(e.message)+'</p></article>';break;}
  }
  if(!stopped)el('sampleProgress').textContent='完成 '+completed+' / '+samples.length+' 条，其中 '+passed+' 条符合预期。这只是小样本测试，不代表所有材料都能正确分类；未修改成员、积分或分类记忆。';
 }catch(e){if(!stopped)el('sampleProgress').textContent=e.message;}finally{sampleRunning=false;}
}
function open(rows,source){
 if(!_cloudApp||!_cloudKey||!CLOUD_ENABLED){toast('请先登录管理员账号后使用AI分析。','err');return;}
 try{if(J&&J.running)throw Error('已有一份材料正在分析，请先完成或停止。');if(J)checkpoint();var job=P.create(APP,rows,{split:sp,profiles:scoringProfiles,issue:scoringIssue});job.source=source;job.cursor=0;job.draftId=newDraftId();J=job;ready();}catch(e){toast(e.message,'err');}
}
var toggle=el('useAiImport');if(toggle)toggle.onchange=function(){el('btnProcess').textContent=this.checked?'AI分析后核对':'开始处理';};
var memoryButton=el('manageClassificationMemory');if(memoryButton)memoryButton.onclick=manageMemory;
var sampleButton=el('testAiSamples');if(sampleButton)sampleButton.onclick=testSamples;
var draftButton=el('resumeAiDrafts');if(draftButton)draftButton.onclick=openDrafts;
if(window.addEventListener)window.addEventListener('beforeunload',function(e){var store=drafts();if(J&&store&&(store.pending()||draftFailure)){e.preventDefault();e.returnValue='草稿尚未保存完成，请稍候。';}});
var check=el('checkAiImport');if(check)check.onclick=checkConnection;
window.AiImport={open:open,checkConnection:checkConnection,close:cancel,flushDraft:function(){var store=drafts();return store?store.flush():Promise.resolve();},openDrafts:openDrafts,importCommitted:importCommitted};
})();
