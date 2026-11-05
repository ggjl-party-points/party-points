(function(){
  'use strict';
  var selectedList='',selectedSnapshot='',mode='simple',keepNextView=false;
  function el(id){return document.getElementById(id);}
  function safe(v){return esc(v==null?'':String(v));}
  function when(v){return v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'未记录时间';}
  function snapshotFor(list){return APP.screeningHistory.find(function(s){return s.id===list.savedResultId;})||APP.screeningHistory.slice().reverse().find(function(s){return s.listId===list.id;})||null;}
  function saveActive(){
    DevelopmentLists.ensure(APP);var list=DevelopmentLists.current(APP);if(!list)throw Error('请先保存名单名称。');
    DevelopmentLists.sync(APP);
    var rows=BatchCore.scoreRows(APP,function(m){classifyMember(m);return calc(m,false);});
    var snap=BatchCore.saveScreening(APP,rows,{name:list.name,period:BatchCore.MATERIAL_SCOPE,allowPending:true});
    snap.listId=list.id;list.savedResultId=snap.id;list.savedAt=snap.createdAt;return snap;
  }
  function currentSnapshot(){if(selectedSnapshot)return APP.screeningHistory.find(function(s){return s.id===selectedSnapshot;})||null;var list=APP.developmentLists.find(function(l){return l.id===selectedList;});return list?snapshotFor(list):null;}
  function render(){
    DevelopmentLists.ensure(APP);var host=el('viewSummary'),list=APP.developmentLists.find(function(l){return l.id===selectedList;}),snap=currentSnapshot();
    if(!selectedList&&!selectedSnapshot){
      var lists=DevelopmentLists.ordered(APP),orphans=APP.screeningHistory.filter(function(s){return !lists.some(function(l){return l.id===s.listId||l.savedResultId===s.id;});}).slice().reverse();
      host.innerHTML='<div class="workspace-page-title"><h2>名单积分汇总</h2><p>点击名单，查看保存名单那一刻的积分。后续补材料不会改变已保存的分数。</p></div><div class="saved-score-cards">'+lists.map(function(l){var s=snapshotFor(l);return '<button type="button" class="saved-score-card" data-score-list="'+safe(l.id)+'"><small>'+safe(l.year)+'年</small><h3>'+safe(l.name)+'</h3><strong>'+(s?s.rows.length:l.memberIds.length)+' 人</strong><p>'+(s?'待审核 '+s.rows.filter(function(r){return r.uncertain>0;}).length+' 人 · 保存于 '+safe(when(s.createdAt)):'尚未留存分数，请编辑名单后点击保存')+'</p></button>';}).join('')+'</div>'+(lists.length?'':'<p class="workflow-empty">还没有发展名单，请先在“发展名单”选人并保存。</p>')+(orphans.length?'<h3 class="saved-legacy-title">以前保存的积分结果</h3><div class="saved-score-cards">'+orphans.map(function(s){return '<button class="saved-score-card" data-score-snapshot="'+safe(s.id)+'"><h3>'+safe(s.name)+'</h3><p>'+s.rows.length+' 人 · '+safe(when(s.createdAt))+'</p></button>';}).join('')+'</div>':'');
      host.querySelectorAll('[data-score-list]').forEach(function(b){b.onclick=function(){selectedList=b.dataset.scoreList;selectedSnapshot='';render();};});
      host.querySelectorAll('[data-score-snapshot]').forEach(function(b){b.onclick=function(){selectedSnapshot=b.dataset.scoreSnapshot;selectedList='';render();};});return;
    }
    if(!snap){host.innerHTML='<button class="btn" id="btnBackSummary">返回名单卡片</button><div class="workspace-help"><h3>'+safe(list?list.name:'名单不存在')+'</h3><p>这份名单尚未保存当时的积分，不会用最新分数冒充历史结果。</p><button class="btn btn-p" id="editUnsavedRoster">编辑并保存名单</button></div>';el('btnBackSummary').onclick=back;el('editUnsavedRoster').onclick=function(){if(list){DevelopmentLists.select(APP,list.id);AdminWorkspace.navigate('screening');}};return;}
    var labels=mode==='simple'?['排名','姓名','学号','班级','学业','党性','纪律','总分']:['排名','姓名','学号','班级'].concat(AC,PS,DS,['学业小计','党性小计','纪律小计','总分']);
    function details(r,k,n){return Array.from({length:n},function(_,i){return r[k]&&r[k][i]!=null?fmt(r[k][i]):'未留存';});}
    host.innerHTML='<div class="saved-score-toolbar"><button class="btn" id="btnBackSummary">← 返回名单卡片</button><button class="btn btn-p" id="exportSavedScores">导出这份保存结果</button></div><div class="workspace-page-title"><h2>'+safe(snap.name)+'</h2><p>保存于 '+safe(when(snap.createdAt))+' · '+snap.rows.length+' 人 · 以下为当时保存的分数</p></div><div class="saved-mode-tabs"><button class="btn '+(mode==='simple'?'btn-p':'')+'" id="btnModeSimple">简洁模式</button><button class="btn '+(mode==='detail'?'btn-p':'')+'" id="btnModeDetail">明细模式</button></div><div class="tbl-wrap"><table class="tbl" id="summaryTable"><thead><tr>'+labels.map(function(x){return '<th>'+safe(x)+'</th>';}).join('')+'</tr></thead><tbody>'+snap.rows.map(function(r){var values=mode==='simple'?[fmt(r.acT),fmt(r.ptT),fmt(r.dcT),fmt(r.total)]:details(r,'ac',AC.length).concat(details(r,'pt',PS.length),details(r,'dc',DS.length),[fmt(r.acT),fmt(r.ptT),fmt(r.dcT),fmt(r.total)]);return '<tr><td>'+safe(r.rank)+'</td><td><button type="button" class="btn btn-s saved-member-link" data-saved-person="'+safe(r.memberId)+'">'+safe(r.name)+'</button></td><td>'+safe(r.studentId)+'</td><td>'+safe(r.className)+'</td>'+values.map(function(v){return '<td>'+safe(v)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><p class="workflow-note">旧版本未保存分项的单元格显示“未留存”，不会使用后来补录的分数回填。点击学生姓名可查看其当前个人资料。</p>';
    el('btnBackSummary').onclick=back;el('btnModeSimple').onclick=function(){mode='simple';render();};el('btnModeDetail').onclick=function(){mode='detail';render();};el('exportSavedScores').onclick=function(){AppWorkflow.exportSnapshot(snap);};
    host.querySelectorAll('[data-saved-person]').forEach(function(b){b.onclick=function(){RosterNavigation.openMember(b.dataset.savedPerson,'summary');};});
  }
  function back(){selectedList='';selectedSnapshot='';render();}
  el('btnExport').addEventListener('click',function(e){if(window.AdminWorkspace&&AdminWorkspace.currentPage()==='summary'){e.stopImmediatePropagation();var s=currentSnapshot();if(s)AppWorkflow.exportSnapshot(s);else toast('请先打开一张名单卡片。','err');}},true);
  window.SavedScores={enter:function(){if(keepNextView){keepNextView=false;render();}else back();},preserveNextView:function(){keepNextView=true;},saveActive:saveActive,render:render,currentSnapshot:currentSnapshot,back:back};
  window.renderSummaryTable=render;
})();
