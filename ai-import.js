(function(){
'use strict';
var P=window.AiImportPlan,K=window.AiImportCore,J=null,FUNCTION_NAME='party-points-ai-import';
function el(id){return document.getElementById(id);}function safe(x){return esc(x==null?'':String(x));}
function dialog(){var d=el('aiImportDialog');if(d)return d;d=document.createElement('dialog');d.id='aiImportDialog';d.className='ai-import-dialog';d.setAttribute('aria-labelledby','aiImportTitle');document.body.appendChild(d);d.addEventListener('cancel',function(e){e.preventDefault();cancel();});return d;}
function shell(title,body,actions){var d=dialog();d.innerHTML='<div class="ai-import-shell"><header><div><span>AI辅助导入 · 确认前不保存</span><h2 id="aiImportTitle">'+safe(title)+'</h2></div><button class="btn" id="aiImportClose" aria-label="关闭AI导入">×</button></header><div class="ai-import-body">'+body+'</div><footer>'+actions+'</footer></div>';if(!d.open)d.showModal();el('aiImportClose').onclick=cancel;}
function close(){if(J)J.cancelled=true;J=null;var d=el('aiImportDialog');if(d&&d.open)d.close();}
function cancel(){if(J&&(J.running||J.analyzed)&&!confirm('分析结果尚未导入，关闭后不会保存。已提交的分析可能计费，确定关闭？'))return;close();}
async function call(data){if(!_cloudApp||!_cloudKey||!CLOUD_ENABLED)throw Error('请先登录学院管理员账号。');await _cloudLogin();var response=await _cloudApp.callFunction({name:FUNCTION_NAME,data:data,timeout:90000});var r=response&&response.result;if(typeof r==='string'){try{r=JSON.parse(r);}catch(e){r=null;}}if(!r||typeof r.ok!=='boolean')throw Error('AI后台响应无效，请检查云函数配置。');if(!r.ok)throw Error(r.message||'AI分析未完成，请稍后重试。');return r;}
function statusText(text){var e=el('aiConnectionStatus');if(e)e.textContent=text;}
async function checkConnection(){statusText('正在检查AI后台…');try{var r=await call({action:'status'});statusText(r.configured?'AI后台已连接，可选择AI辅助分析。':'AI后台已连接，尚未配置DeepSeek密钥。');return !!r.configured;}catch(e){statusText('AI尚未接通，可继续使用规则识别。');toast('AI尚未接通：请先部署云函数并配置密钥。','err');return false;}}
function fallback(){if(!J)return;var rows=J.rows,source=J.source;close();AppWorkflow.previewImport(rows,source);}
function preview(){if(!J||J.running)return;try{var review=P.finalize(J,APP),source=J.source;close();AppWorkflow.previewImport(review.rows,source,review);}catch(e){toast(e.message,'err');}}
function remainPending(){if(!J||J.running)return;if(!confirm('其余未确认的材料将保留为待人工审核，暂不计分。确认进入导入预览？'))return;J.sources.forEach(function(s){if(!s.parts)s.parts=[{raw:s.text,reason:'本条尚未完成AI分析，请人工核对。',decision:'pending',missing:[]}];s.parts.forEach(function(p){if(!p.decision)p.decision='pending';});});preview();}
function flat(job){var all=[];job.sources.forEach(function(s){(s.parts||[]).forEach(function(p,i){if(p.decision!=='reuse')all.push({source:s,part:p,index:i});});});return all;}
function review(index){
 var job=J;if(!job)return;var all=flat(job),remaining=all.filter(function(x){return !x.part.decision;}).length;
 if(!all.length&&job.sources.some(function(s){return !s.parts;})){ready('尚无已完成的分析，请先开始或继续AI分析。');return;}
 if(!all.length){shell('没有待核对的新材料','<p>原来人工确认过的条目已沿用，没有需要重复调用AI的材料。</p>','<button class="btn btn-p" id="aiFinish">进入导入预览</button>');el('aiFinish').onclick=preview;return;}
 index=Math.max(0,Math.min(index==null?(job.cursor||0):index,all.length-1));job.cursor=index;var current=all[index],s=current.source,p=current.part;
 var title=s.name+' · '+(s.source==='award'?'获奖材料':'活动经历');
 shell(title,'<div class="ai-review-progress">第 '+(index+1)+' / '+all.length+' 条 · 尚未确认 '+remaining+' 条 · 已沿用 '+job.sources.filter(function(s){return s.parts&&s.parts[0]&&s.parts[0].decision==='reuse';}).length+' 条原有确认记录</div><section class="ai-source"><h3>原始填写内容</h3><p>'+safe(p.raw)+'</p></section><section class="ai-reason"><strong>AI建议依据</strong><p>'+safe(p.reason||'需要人工判断。')+'</p>'+(p.missing&&p.missing.length?'<p class="ai-warning">缺少：'+safe(p.missing.join('；'))+'</p>':'')+'<small>AI只提供建议。没有原文或佐证依据的级别，请留待审核。</small></section><div class="ai-score-fields"><label>归类到<select id="aiTarget"></select></label><label>材料类型<select id="aiType"></select></label><label>级别／计分依据<select id="aiOption"></select></label><div class="ai-score-result">系统按规则计算：<strong id="aiPoints">待确认</strong></div></div><p id="aiReviewError" class="ai-warning"></p><p>当前状态：'+(p.decision==='approved'?'已人工确认':p.decision==='pending'?'已标记待人工审核':'尚未确认')+'</p>',
 '<div><button class="btn" id="aiPrev"'+(index?'':' disabled')+'>上一条</button><button class="btn" id="aiNext"'+(index<all.length-1?'':' disabled')+'>下一条</button></div><div><button class="btn" id="aiPending">留待人工审核</button><button class="btn btn-p" id="aiApprove">确认本条</button></div><div class="ai-finish-actions"><button class="btn" id="aiContinue">返回分析进度</button><button class="btn" id="aiRestPending">其余留待审核并预览</button><button class="btn btn-p" id="aiFinish">全部核对完成，预览导入</button></div>');
 var targets=Array.from(new Set(job.catalog.map(function(c){return c.target;})));el('aiTarget').innerHTML='<option value="">请选择类别</option>'+targets.map(function(t){var v=t.split('-');return'<option value="'+t+'">'+safe((v[0]==='ac'?AC:PS)[Number(v[1])])+'</option>';}).join('');el('aiTarget').value=p.target||'';
 function score(){try{var item=P.resolve(job.catalog,{raw:p.raw,target:el('aiTarget').value,type:el('aiType').value,option:el('aiOption').value});el('aiPoints').textContent=(item.score>0?'+':'')+item.score+'分';}catch(e){el('aiPoints').textContent='信息不足，暂不计分';}}
 function options(initial){var type=job.catalog.find(function(c){return c.target===el('aiTarget').value&&c.type===el('aiType').value;});el('aiOption').innerHTML='<option value="">请选择明确依据</option>'+(type?type.options.map(function(o){return'<option value="'+safe(o.key)+'">'+safe(o.label)+' · '+o.score+'分</option>';}).join(''):'');el('aiOption').value=initial&&p.option!=null?String(p.option):'';score();}
 function types(initial){var choices=job.catalog.filter(function(c){return c.target===el('aiTarget').value;});el('aiType').innerHTML='<option value="">请选择材料类型</option>'+choices.map(function(c){return'<option value="'+safe(c.type)+'">'+safe(c.name)+'</option>';}).join('');el('aiType').value=initial?p.type||'':'';options(initial);}
 el('aiTarget').onchange=function(){types(false);};el('aiType').onchange=function(){options(false);};el('aiOption').onchange=score;types(true);
 function advance(){review(Math.min(index+1,all.length-1));}
 el('aiApprove').onclick=function(){try{var changed=Object.assign({},p,{target:el('aiTarget').value,type:el('aiType').value,option:el('aiOption').value,decision:'approved',missing:[]});P.resolve(job.catalog,changed);s.parts[current.index]=changed;advance();}catch(e){el('aiReviewError').textContent=e.message;}};
 el('aiPending').onclick=function(){p.decision='pending';advance();};el('aiPrev').onclick=function(){review(index-1);};el('aiNext').onclick=function(){review(index+1);};el('aiContinue').onclick=function(){ready();};el('aiRestPending').onclick=remainPending;el('aiFinish').onclick=preview;
}
function ready(error){
 var job=J;if(!job)return;var todo=job.sources.filter(function(s){return !s.parts;}),reused=job.sources.filter(function(s){return s.parts&&s.parts[0]&&s.parts[0].decision==='reuse';}).length;
 shell('AI分析前核对','<p>本次有 '+todo.length+' 段待分析材料，'+reused+' 段原来人工确认过的材料将直接沿用。</p><p>只发送活动、获奖文字，不发送姓名、班级、学号等表格字段。调用DeepSeek会产生接口费用。</p><p>AI结果需要逐条确认；分数由系统按现有规则计算。关闭或停止分析不会保存资料。</p>'+(error?'<p class="ai-warning">'+safe(error)+'</p>':'')+'<p id="aiRunProgress"></p>',
 '<button class="btn" id="aiUseRules">改用规则识别</button><button class="btn" id="aiReviewReady">核对已分析材料</button><button class="btn btn-p" id="aiStart">'+(todo.length?'开始／继续AI分析':'查看核对结果')+'</button>');
 el('aiUseRules').onclick=fallback;el('aiReviewReady').onclick=function(){review();};el('aiStart').onclick=function(){if(todo.length)run();else review();};
}
async function run(){
 var job=J;if(!job||job.running)return;job.running=true;job.cancelled=false;
 shell('正在分析材料','<p id="aiRunProgress">正在检查后台连接…</p><p>按小批次依次分析。停止后不再发起后续请求；已经提交的请求可能计费。</p>','<button class="btn" id="aiStop">停止后核对已完成部分</button>');
 el('aiStop').onclick=function(){job.cancelled=true;el('aiRunProgress').textContent='正在停止，等待当前批次结束…';};
 try{
  var status=await call({action:'status'});if(!status.configured)throw Error('后台尚未配置DeepSeek密钥。请先在腾讯云云函数中配置，或改用规则识别。');
  while(J===job&&!job.cancelled){
   P.assertCurrent(job,APP);var todo=job.sources.filter(function(s){return !s.parts;});if(!todo.length)break;var batch=[],chars=0;for(var i=0;i<todo.length&&batch.length<K.MAX_ITEMS;i++){if(todo[i].text.length>K.MAX_TEXT)throw Error('有一段材料超过'+K.MAX_TEXT+'字，请拆分表格内容后重新上传。');if(chars+todo[i].text.length>K.MAX_TOTAL)break;batch.push(todo[i]);chars+=todo[i].text.length;}
   var request={version:1,action:'analyze',items:batch.map(function(s){return{id:s.id,text:s.text,source:s.source};}),catalog:job.publicCatalog};K.validateRequest(request.items,request.catalog);
   el('aiRunProgress').textContent='已分析 '+job.analyzed+' / '+job.sources.filter(function(s){return !s.parts||s.parts[0].decision!=='reuse';}).length+' 段，正在处理下一批…';
   var result=await call(request);if(J!==job)return;
   var data={results:(result.results||[]).map(function(r){return{id:r.id,parts:(r.parts||[]).map(function(p){return Object.assign({},p,{quote:p.raw});})};})};
   var validated=K.validateResponse(request,data);validated.forEach(function(r){var source=job.sources.find(function(s){return s.id===r.id;});source.parts=r.parts;});job.analyzed+=batch.length;
  }
  if(J===job){job.running=false;if(job.sources.some(function(s){return !s.parts;}))ready('分析已停止。可以继续分析，或先核对已完成部分。');else review();}
 }catch(e){if(J===job){job.running=false;ready(e.message||'AI分析未完成。');}}finally{job.running=false;}
}
function open(rows,source){
 if(!_cloudApp||!_cloudKey||!CLOUD_ENABLED){toast('请先登录管理员账号后使用AI分析。','err');return;}
 try{if(J&&J.running)throw Error('已有一份材料正在分析，请先完成或停止。');var job=P.create(APP,rows,{split:sp,profiles:scoringProfiles,issue:scoringIssue});job.source=source;job.cursor=0;J=job;ready();}catch(e){toast(e.message,'err');}
}
var toggle=el('useAiImport');if(toggle)toggle.onchange=function(){el('btnProcess').textContent=this.checked?'AI分析后核对':'开始处理';};
var check=el('checkAiImport');if(check)check.onclick=checkConnection;
window.AiImport={open:open,checkConnection:checkConnection,close:cancel};
})();
