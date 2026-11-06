(function(){
 'use strict';
 var selectedList='',selectedSnapshot='',mode='simple',keepNextView=false,trash=false,sortKey='rank',sortDirection='asc',Core=window.SavedScoresCore;
 function el(id){return document.getElementById(id);}
 function safe(v){return esc(v==null?'':String(v));}
 function when(v){return v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'未记录时间';}
 function snapshotFor(list){return APP.screeningHistory.find(function(s){return s.id===list.savedResultId;})||APP.screeningHistory.slice().reverse().find(function(s){return s.listId===list.id;})||null;}
 function activeList(){return APP.developmentLists.find(function(l){return l.id===selectedList;})||null;}
 function liveSnapshot(list){
  var ids=new Set(list.memberIds),rows=BatchCore.scoreRows(APP,function(m){classifyMember(m);return calc(m,false);});
  rows=BatchCore.rankRows(rows.filter(function(r){return ids.has(r.memberId);}));
  return {id:'live-'+list.id,listId:list.id,name:list.name,period:BatchCore.MATERIAL_SCOPE,createdAt:new Date().toISOString(),rows:rows,rules:BatchCore.clone(APP.rules),criteriaVersion:APP.criteriaVersion,coefficient:1,status:'当前实时结果',live:true};
 }
 function saveActive(){
  DevelopmentLists.ensure(APP);var list=DevelopmentLists.current(APP);if(!list)throw Error('请先保存名单名称。');
  if(!Core.isLive(list))throw Error('这份名单已定稿，请在名单积分汇总中点击“重新打开编辑”，或另存为新名单。');
  DevelopmentLists.sync(APP);
  var rows=BatchCore.scoreRows(APP,function(m){classifyMember(m);return calc(m,false);});
  var snap=BatchCore.saveScreening(APP,rows,{name:list.name,period:BatchCore.MATERIAL_SCOPE,allowPending:true});
  snap.listId=list.id;snap.summaryKind='checkpoint';list.savedResultId=snap.id;list.savedAt=snap.createdAt;return snap;
 }
 function currentSnapshot(){if(selectedSnapshot)return APP.screeningHistory.find(function(s){return s.id===selectedSnapshot;})||null;var list=activeList();return list?(Core.isLive(list)?liveSnapshot(list):snapshotFor(list)):null;}
 function mutate(fn){try{if(typeof _cloudConflict!=='undefined'&&_cloudConflict)throw Error('请先处理云端保存冲突。');fn();svNow();render();}catch(e){toast(e.message,'err');}}
 function finish(list){
  if(!confirm('定稿后固定当前名单与分数，之后补材料不会改变此结果。确认定稿？'))return;
  mutate(function(){
   var snap=liveSnapshot(list);if(!snap.rows.length)throw Error('空名单不能定稿。');
   snap.id=BatchCore.id('screening');delete snap.live;snap.summaryKind='final';snap.status=snap.rows.some(function(r){return r.uncertain>0;})?'已定稿（含待审核项）':'已定稿';
   APP.screeningHistory.push(snap);list.savedResultId=snap.id;list.savedAt=snap.createdAt;list.scoreMode='frozen';list.finalizedAt=snap.createdAt;
  });
 }
 function cards(){
  var host=el('viewSummary'),all=DevelopmentLists.ordered(APP),lists=all.filter(function(l){return !!l.summaryDeletedAt===trash;});
  var results=APP.screeningHistory.filter(function(s){var owner=all.find(function(l){return l.id===s.listId||l.savedResultId===s.id;});if(owner&&owner.summaryDeletedAt)return false;if(owner&&owner.savedResultId===s.id&&!Core.isLive(owner))return false;if(s.summaryKind==='checkpoint')return false;return !!s.summaryDeletedAt===trash;}).slice().reverse();
  host.innerHTML='<div class="saved-score-toolbar"><h2>'+(trash?'汇总回收站':'名单积分汇总')+'</h2><button class="btn" id="summaryTrashToggle">'+(trash?'返回汇总':'回收站')+'</button></div><p>'+(trash?'移入回收站只隐藏汇总，不删除成员、材料或积分。可随时恢复。':'当前批次实时更新；定稿后冻结分数。旧版已保存结果默认保持冻结。')+'</p><div class="saved-score-cards">'+lists.map(function(l){var s=snapshotFor(l);return '<article class="saved-score-card"><button type="button" class="btn" data-score-list="'+safe(l.id)+'"><small>'+safe(l.year)+'年 · '+(Core.isLive(l)?'实时更新':'已定稿／历史冻结')+'</small><h3>'+safe(l.name)+'</h3><strong>'+(Core.isLive(l)?l.memberIds.length:s?s.rows.length:l.memberIds.length)+' 人</strong></button><p>'+(Core.isLive(l)?'成员分数变化后，重新打开汇总即可看到最新结果。':s?'保存于 '+safe(when(s.createdAt)):'尚未留存分数')+'</p><button class="btn btn-s" data-summary-list="'+safe(l.id)+'">'+(trash?'恢复汇总':'移入回收站')+'</button></article>';}).join('')+'</div>'+(results.length?'<h3>历史留存结果</h3><div class="saved-score-cards">'+results.map(function(s){return '<article class="saved-score-card"><button class="btn" data-score-snapshot="'+safe(s.id)+'"><h3>'+safe(s.name)+'</h3><p>'+s.rows.length+' 人 · '+safe(when(s.createdAt))+'</p></button><button class="btn btn-s" data-summary-snapshot="'+safe(s.id)+'">'+(trash?'恢复汇总':'移入回收站')+'</button></article>';}).join('')+'</div>':'')+(!lists.length&&!results.length?'<p class="workflow-empty">'+(trash?'回收站为空。':'还没有名单，请先在“发展名单”勾选成员并保存。')+'</p>':'');
  el('summaryTrashToggle').onclick=function(){trash=!trash;render();};
  host.querySelectorAll('[data-score-list]').forEach(function(b){b.onclick=function(){selectedList=b.dataset.scoreList;selectedSnapshot='';sortKey='rank';sortDirection='asc';render();};});
  host.querySelectorAll('[data-score-snapshot]').forEach(function(b){b.onclick=function(){selectedSnapshot=b.dataset.scoreSnapshot;selectedList='';sortKey='rank';sortDirection='asc';render();};});
  host.querySelectorAll('[data-summary-list]').forEach(function(b){b.onclick=function(){var l=all.find(function(x){return x.id===b.dataset.summaryList;});if(!trash&&!confirm('将“'+l.name+'”的汇总移入回收站？成员和积分保留。'))return;mutate(function(){if(trash)Core.restore(l);else Core.recycle(APP,l,null);});};});
  host.querySelectorAll('[data-summary-snapshot]').forEach(function(b){b.onclick=function(){var s=APP.screeningHistory.find(function(x){return x.id===b.dataset.summarySnapshot;});if(!trash&&!confirm('将这份历史汇总移入回收站？'))return;mutate(function(){if(trash)Core.restore(s);else Core.recycle(APP,null,s);});};});
 }
 function render(){
  DevelopmentLists.ensure(APP);var host=el('viewSummary'),list=activeList(),snap=currentSnapshot();
  if(!selectedList&&!selectedSnapshot){cards();return;}
  if(!snap){host.innerHTML='<button class="btn" id="btnBackSummary">返回名单卡片</button><div class="workspace-help"><h3>'+safe(list?list.name:'名单不存在')+'</h3><p>这份名单尚未保存当时的积分，不会用最新分数冒充历史结果。</p><button class="btn btn-p" id="editUnsavedRoster">编辑并保存名单</button></div>';el('btnBackSummary').onclick=back;el('editUnsavedRoster').onclick=function(){if(list){mutate(function(){list.scoreMode='live';});DevelopmentLists.select(APP,list.id);AdminWorkspace.navigate('screening');}};return;}
  var columns=[{label:'排名',key:'rank'},{label:'姓名',key:'name'},{label:'班级',key:'className'}];
  if(mode==='simple')columns=columns.concat([{label:'学业',key:'acT'},{label:'党性',key:'ptT'},{label:'纪律',key:'dcT'},{label:'总分',key:'total'}]);
  else {[[AC,'ac'],[PS,'pt'],[DS,'dc']].forEach(function(g){g[0].forEach(function(n,i){columns.push({label:n,key:g[1]+'.'+i});});});columns=columns.concat([{label:'学业小计',key:'acT'},{label:'党性小计',key:'ptT'},{label:'纪律小计',key:'dcT'},{label:'总分',key:'total'}]);}
  if(!columns.some(function(c){return c.key===sortKey;})){sortKey='rank';sortDirection='asc';}
  var rows=Core.ordered(snap.rows,sortKey,sortDirection);
  host.innerHTML='<div class="saved-score-toolbar"><button class="btn" id="btnBackSummary">← 返回名单卡片</button><button class="btn btn-p" id="exportSavedScores">导出当前表格</button>'+(list?(Core.isLive(list)?'<button class="btn btn-p" id="finalizeSummary">定稿，冻结本批分数</button>':'<button class="btn" id="reopenSummary">重新打开编辑</button>'):'')+'<button class="btn" id="recycleSummary">移入回收站</button></div><div class="workspace-page-title"><h2>'+safe(snap.name)+'</h2><p>'+(snap.live?'实时汇总 · 成员分数修改后同步更新':'保存于 '+safe(when(snap.createdAt))+' · 以下为当时保存的分数')+' · '+snap.rows.length+' 人</p></div><div class="saved-mode-tabs"><button class="btn '+(mode==='simple'?'btn-p':'')+'" id="btnModeSimple">简洁模式</button><button class="btn '+(mode==='detail'?'btn-p':'')+'" id="btnModeDetail">明细模式</button></div><div class="tbl-wrap"><table class="tbl" id="summaryTable"><thead><tr>'+columns.map(function(c){return '<th aria-sort="'+(c.key===sortKey?(sortDirection==='asc'?'ascending':'descending'):'none')+'"><button class="summary-sort" data-summary-sort="'+safe(c.key)+'">'+safe(c.label)+(c.key===sortKey?(sortDirection==='asc'?' ↑':' ↓'):' ↕')+'</button></th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+columns.map(function(c){var p=c.key.split('.'),v=p.length>1?r[p[0]]&&r[p[0]][Number(p[1])]:r[c.key];if(c.key==='name')return '<td><button type="button" class="btn btn-s saved-member-link" data-saved-person="'+safe(r.memberId)+'">'+safe(v)+'</button></td>';return '<td>'+safe(v==null?'未留存':typeof v==='number'?fmt(v):v)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><p class="workflow-note">点击表头切换升序、降序。排名保留按总分计算的名次。历史分项未留存时显示“未留存”；点击姓名查看当前个人资料。</p>';
  el('btnBackSummary').onclick=back;el('btnModeSimple').onclick=function(){mode='simple';render();};el('btnModeDetail').onclick=function(){mode='detail';render();};
  el('exportSavedScores').onclick=function(){AppWorkflow.exportSnapshot(Object.assign({},snap,{rows:rows}));};
  if(el('finalizeSummary'))el('finalizeSummary').onclick=function(){finish(list);};
  if(el('reopenSummary'))el('reopenSummary').onclick=function(){if(confirm('重新打开后，本批汇总将使用成员最新分数；原定稿结果仍保留在历史结果中。继续？'))mutate(function(){if(APP.screeningDraft.listId===list.id)APP.screeningDraft.selectedIds=list.memberIds.slice();list.scoreMode='live';});};
  el('recycleSummary').onclick=function(){if(confirm('将这份汇总移入回收站？成员、材料与积分保留。'))mutate(function(){Core.recycle(APP,list,list?null:snap);selectedList='';selectedSnapshot='';});};
  host.querySelectorAll('[data-summary-sort]').forEach(function(b){b.onclick=function(){var key=b.dataset.summarySort;sortDirection=key===sortKey&&sortDirection==='asc'?'desc':'asc';sortKey=key;render();};});
  host.querySelectorAll('[data-saved-person]').forEach(function(b){b.onclick=function(){RosterNavigation.openMember(b.dataset.savedPerson,'summary');};});
 }
 function back(){selectedList='';selectedSnapshot='';render();}
 el('btnExport').addEventListener('click',function(e){if(window.AdminWorkspace&&AdminWorkspace.currentPage()==='summary'){e.stopImmediatePropagation();var s=currentSnapshot();if(s)AppWorkflow.exportSnapshot(Object.assign({},s,{rows:Core.ordered(s.rows,sortKey,sortDirection)}));else toast('请先打开一张名单卡片。','err');}},true);
 window.SavedScores={enter:function(){if(keepNextView){keepNextView=false;render();}else {trash=false;back();}},preserveNextView:function(){keepNextView=true;},saveActive:saveActive,render:render,currentSnapshot:currentSnapshot,back:back};
 window.renderSummaryTable=render;
})();
