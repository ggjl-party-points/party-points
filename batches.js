(function(){
  'use strict';
  var L=window.DevelopmentLists,listYear='',libraryOpen=false,C=window.BatchCore,visible=false,historyId=null,previewPlan=null,importSource='',searchTimer,importReceipt=null;
  var filters={q:'',batch:'',review:'',min:'',max:'',selectedOnly:false,className:'',listScope:''};
  function byId(id){return document.getElementById(id);}
  function safe(value){return esc(value==null?'':String(value));}
  function ensure(){L.ensure(APP);}
  function date(value){return value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'历史数据，时间未知';}
  function scores(){return C.scoreRows(APP,function(m){classifyMember(m);return calc(m,false);}).map(function(r){r.batches=APP.developmentLists.filter(function(l){return l.memberIds.indexOf(r.memberId)>=0;}).map(function(l){return l.name;}).join('、')||'尚未加入名单';return r;});}
  function persist(){var list=L.current(APP);if(list&&list.scoreMode!=='live'&&JSON.stringify(list.memberIds)!==JSON.stringify(APP.screeningDraft.selectedIds)){APP.screeningDraft.listId='';APP.screeningDraft.name='';toast('原名单已定稿，当前勾选作为新名单草稿；原名单和分数保留。');}L.sync(APP);sv();}
  function option(value,label,chosen){return '<option value="'+safe(value)+'"'+(value===chosen?' selected':'')+'>'+safe(label)+'</option>';}
  function options(chosen,all){return(all?option('','全部导入记录',chosen):'')+APP.batches.map(function(b){return option(b.id,b.name,chosen);}).join('');}
  function openDialog(title,body,actions){
    byId('workflowDialogTitle').textContent=title;byId('workflowDialogBody').innerHTML=body;byId('workflowDialogActions').innerHTML=actions||'';
    byId('workflowDialog').classList.remove('hide');byId('workflowDialogClose').focus();
  }
  function closeDialog(){byId('workflowDialog').classList.add('hide');previewPlan=null;}
  function open(){
    ensure();visible=true;historyId=null;filters={q:'',batch:'',review:'',min:'',max:'',selectedOnly:false,className:'',listScope:''};
    ['viewPersonal','viewSummary','emptyState'].forEach(function(id){byId(id).classList.add('hide');});
    byId('workflowView').classList.remove('hide');byId('btnExport').textContent='导出本次勾选名单';render();
  }
  function close(){visible=false;byId('workflowView').classList.add('hide');byId('btnExport').textContent='导出全部汇总';window.render();}
  function selectionSummary(rows){var chosen=C.selectedRows(APP,rows);return '已选 '+chosen.length+' 人 · 待审核 '+chosen.filter(function(r){return r.uncertain>0;}).length+' 人';}
  function passes(row){
    var q=filters.q.toLowerCase();return(!filters.listScope||APP.developmentLists.some(function(l){return l.id===filters.listScope&&l.memberIds.indexOf(row.memberId)>=0;}))&&(!filters.className||row.className===filters.className)&&(!q||(row.name+' '+row.className+' '+row.studentId).toLowerCase().indexOf(q)>=0)&&(!filters.batch||row.batchIds.indexOf(filters.batch)>=0)&&(!filters.review||(filters.review==='pending'?row.uncertain>0:row.uncertain===0))&&(!filters.selectedOnly||APP.screeningDraft.selectedIds.indexOf(row.memberId)>=0)&&(filters.min===''||row.total>=Number(filters.min))&&(filters.max===''||row.total<=Number(filters.max));
  }
  function table(rows,selection){
    if(selection)return memberTable(rows);
    var chosen=new Set(APP.screeningDraft.selectedIds);
    return '<div class="workflow-table-wrap"><table class="workflow-table"><thead><tr>'+(selection?'<th>参与</th>':'')+'<th>名次</th><th>姓名／学号</th><th>班级</th><th>所属发展名单</th><th>学业</th><th>党性</th><th>纪律</th><th>总分</th><th>审核</th><th>资料更新时间</th>'+(selection?'<th>操作</th>':'')+'</tr></thead><tbody>'+rows.map(function(r){
      return '<tr>'+(selection?'<td><input type="checkbox" aria-label="选择'+safe(r.name)+'" data-pick="'+safe(r.memberId)+'"'+(chosen.has(r.memberId)?' checked':'')+'></td>':'')+'<td>'+(r.rank==null?'—':r.rank)+'</td><td><strong>'+safe(r.name)+'</strong><small>'+safe(r.studentId||'未补学号')+'</small></td><td>'+safe(r.className)+'</td><td>'+safe(r.batches)+'</td><td>'+fmt(r.acT)+'</td><td>'+fmt(r.ptT)+'</td><td>'+fmt(r.dcT)+'</td><td class="workflow-total">'+fmt(r.total)+'</td><td>'+ (r.uncertain?'<span class="workflow-warning">待审核 '+r.uncertain+' 项</span>':'无待审核项')+'</td><td>'+safe(date(r.updatedAt))+'</td>'+(selection?'<td><button class="btn btn-s" data-identity="'+safe(r.memberId)+'">补学号</button><button class="btn btn-s" data-detail="'+safe(r.memberId)+'">明细</button></td>':'')+'</tr>';
    }).join('')+'</tbody></table>'+(rows.length?'':'<p class="workflow-empty">当前条件下没有人员。可清除筛选条件。</p>')+'</div>';
  }
  function memberTable(rows){
    var chosen=new Set(APP.screeningDraft.selectedIds);
    return '<div class="workflow-table-wrap"><table class="workflow-table roster-member-table"><thead><tr><th>加入当前名单</th><th>姓名与学号</th><th>班级</th><th>已加入的发展名单</th><th>总分</th><th>审核</th><th>操作</th></tr></thead><tbody>'+rows.map(function(r){return '<tr class="'+(chosen.has(r.memberId)?'roster-picked':'')+'"><td><input type="checkbox" aria-label="选择'+safe(r.name)+'" data-pick="'+safe(r.memberId)+'"'+(chosen.has(r.memberId)?' checked':'')+'></td><td><strong>'+safe(r.name)+'</strong><small>'+safe(r.studentId||'未填学号')+'</small></td><td>'+safe(r.className)+'</td><td class="roster-tags">'+safe(r.batches)+'</td><td class="workflow-total">'+fmt(r.total)+'</td><td>'+(r.uncertain?'<span class="workflow-warning">待审核 '+r.uncertain+' 项</span>':'无待审核项')+'</td><td><button class="btn btn-s" data-detail="'+safe(r.memberId)+'">查看积分</button><button class="btn btn-s" data-identity="'+safe(r.memberId)+'">补学号</button></td></tr>';}).join('')+'</tbody></table>'+(rows.length?'':'<p class="workflow-empty">当前条件下没有成员，可清空筛选条件。</p>')+'</div>';
  }
  function listLibrary(){
    var lists=L.ordered(APP),years=Array.from(new Set(lists.map(function(l){return l.year;}))).sort().reverse();
    return '<div id="rosterLibrary" class="roster-library"><p>共 '+lists.length+' 份名单，最近修改的排在前面。</p><label>年度 <select id="rosterYear">'+option('','全部年度',listYear)+years.map(function(y){return option(y,y+'年',listYear);}).join('')+'</select></label><div class="roster-library-items">'+lists.filter(function(l){return !listYear||l.year===listYear;}).map(function(l){return '<article><div><strong>'+safe(l.name)+'</strong><small>'+safe(l.year==='未标年份'?'年份待补':l.year+'年')+' · '+l.memberIds.length+' 人</small></div><div class="workflow-actions"><button class="btn btn-s" data-use-list="'+safe(l.id)+'">打开名单</button><button class="btn btn-s" data-copy-list="'+safe(l.id)+'">沿用新建</button><button class="btn btn-s" data-rename-list="'+safe(l.id)+'">改名</button><button class="btn btn-d btn-s" data-delete-list="'+safe(l.id)+'">删除名单</button></div></article>';}).join('')+(lists.length?'':'<p>还没有已命名的发展名单。勾选成员后点击“保存为发展名单”。</p>')+'</div></div>';
  }
  function importReceiptHtml(){
    if(!importReceipt)return '';
    var ids=new Set(importReceipt.memberIds),affected=scores().filter(function(r){return ids.has(r.memberId);});
    var items=affected.reduce(function(n,r){return n+r.uncertain;},0),people=affected.filter(function(r){return r.uncertain>0;}).length,c=importReceipt.counts;
    return '<section class="import-receipt" aria-label="最近一次导入结果"><h3>导入完成 · '+safe(importReceipt.batch.name)+'</h3><p>新增 <strong>'+c.new+'</strong> 人，更新 <strong>'+c.update+'</strong> 人，无变化 '+c.unchanged+' 人，跳过冲突 '+c.conflict+' 行。</p><p>本次导入人员当前有 <strong>'+items+'</strong> 项待审核，涉及 '+people+' 人。已自动勾选本次人员，可继续添加老同学。</p><p class="import-receipt-note">资料已处理；云端是否保存成功，请以顶部保存状态为准。点击“保存名单和分数”会同时留存名单与当时分数。</p><div class="workflow-actions"><button class="btn btn-p" data-import-next="review">核对本次待审核材料</button><button class="btn" data-import-next="members">查看导入人员</button><button class="btn" data-import-next="screening">继续选人筛选</button><button class="btn btn-g" data-import-next="dismiss">收起提示</button></div></section>';
  }
  function render(){
    if(!visible)return;ensure();
    var rows=scores(),chosen=C.selectedRows(APP,rows),chosenById=new Map(chosen.map(function(r){return[r.memberId,r];}));
    var body=byId('workflowView');
    var active=L.current(APP),lists=L.ordered(APP),classes=Array.from(new Set(rows.map(function(r){return r.className;}))).sort(function(a,b){return a.localeCompare(b,'zh-CN');});
    var visibleRows=rows.filter(passes).sort(function(a,b){return a.className.localeCompare(b.className,'zh-CN')||a.name.localeCompare(b.name,'zh-CN');});
    body.innerHTML=importReceiptHtml()+'<div class="workflow-heading"><div><h2>发展名单</h2><p>先从全部成员勾选，再保存为某年度的发展对象名单；下次可直接沿用。</p></div><button class="btn btn-g" data-workflow="back">返回人员与积分</button></div>'+
      '<section class="roster-current roster-compact"><div class="roster-title"><span>当前名单</span><h3>'+safe(active?active.name:'临时选择')+'</h3><p>'+selectionSummary(rows)+(active?' · 未定稿批次实时更新；历史批次保持冻结':' · 跨范围勾选会持续累加')+'</p></div><div class="roster-current-actions"><button class="btn btn-p" data-workflow="save-screening">保存名单和分数</button><button class="btn" data-workflow="create-batch">新建 / 另存名单</button><button class="btn" data-workflow="manage-lists">管理名单</button></div></section>'+
      '<div class="roster-view-tabs"><button class="btn '+(filters.selectedOnly?'btn-p':'')+'" data-workflow="show-selection">查看全部已选（'+chosen.length+'人）</button><button class="btn '+(!filters.selectedOnly?'btn-p':'')+'" data-workflow="reset-filters">全部成员 / 添加人员</button><span>显示 '+visibleRows.length+' 人</span></div>'+
      '<details class="roster-search-tools"><summary>查找 / 从已有名单选人</summary><div class="workflow-filters"><label>从哪里找人<select id="developmentListSelect">'+option('','全部成员',filters.listScope)+lists.map(function(l){return option(l.id,l.name,filters.listScope);}).join('')+'</select></label><label>姓名或学号<input id="workflowSearch" type="search" value="'+safe(filters.q)+'" placeholder="姓名、班级或学号"></label><label>班级<select id="workflowClass">'+option('','全部班级',filters.className)+classes.map(function(c){return option(c,c,filters.className);}).join('')+'</select></label><label>审核<select id="workflowReview">'+option('','全部',filters.review)+option('pending','仍有待审核',filters.review)+option('ready','无待审核项',filters.review)+'</select></label><input id="workflowSelectedOnly" type="checkbox" class="hide"'+(filters.selectedOnly?' checked':'')+'><input id="workflowMin" type="hidden" value=""><input id="workflowMax" type="hidden" value=""><select id="workflowBatch" class="hide">'+options('',true)+'</select></div><p>这里只改变显示范围，不会清除已勾选的人。用“查看全部已选”核对完整名单。</p></details>'+
      '<div class="workflow-actions roster-selection-actions"><button class="btn" data-workflow="select-visible">勾选当前显示的成员</button><button class="btn" data-workflow="unselect-visible">取消当前显示的勾选</button><button class="btn btn-g" data-workflow="clear-selection">清空当前勾选</button><span id="workflowSelectionSummary">'+selectionSummary(rows)+'</span></div>'+
      '<div id="workflowRoster">'+table(visibleRows,true)+'</div>'+
      '<div class="roster-save-note">'+(active&&active.savedAt?'上次保存名单分数：'+safe(date(active.savedAt)):'点击上方“保存名单和分数”即可留存本轮结果。')+' 未定稿名单实时更新，定稿后保存历史分数。</div>'+
      '<details class="workflow-history '+((window.AdminWorkspace&&AdminWorkspace.currentPage()==='history')?'':'hide')+'" open><summary>查看已保存的历史积分结果（'+APP.screeningHistory.length+'份）</summary>'+APP.screeningHistory.slice().reverse().map(function(s){return '<div class="workflow-history-row"><div><strong>'+safe(s.name)+'</strong><small>'+safe(date(s.createdAt))+' · '+s.rows.length+' 人 · '+safe(s.status)+' · '+safe(s.period)+'</small></div><button class="btn btn-s" data-history-view="'+safe(s.id)+'">查看</button><button class="btn btn-s" data-history-export="'+safe(s.id)+'">导出</button><button class="btn btn-s" data-history-select="'+safe(s.id)+'">沿用这份人员</button></div>';}).join('')+'</details>';
    byId('developmentListSelect').value=filters.listScope||'';byId('workflowClass').value=filters.className||'';
    byId('developmentListSelect').onchange=function(){filters.listScope=this.value;filters.selectedOnly=false;filters.className='';filters.q='';render();};
    byId('workflowClass').onchange=function(){filters.className=this.value;render();};
    body.querySelectorAll('[data-import-next]').forEach(function(btn){btn.onclick=function(){
      var page=btn.dataset.importNext;
      if(page==='dismiss'){importReceipt=null;render();return;}
      if(page==='screening'){filters.batch='';filters.q='';filters.review='';filters.min='';filters.max='';filters.selectedOnly=false;render();return;}
      var ids=new Set(importReceipt.memberIds),rows=scores().filter(function(r){return ids.has(r.memberId)&&(page!=='review'||r.uncertain>0);});
      if(!rows.length){toast('本次导入人员暂无待审核材料。');return;}
      if(window.RosterNavigation)RosterNavigation.openMember(rows[0].memberId,'screening');else{APP.curIdx=APP.members.findIndex(function(m){return m._memberId===rows[0].memberId;});if(window.AdminWorkspace)window.AdminWorkspace.navigate('members');else close();}
      if(page==='review')switchMainTab('uncertain');
    };});
    body.querySelectorAll('[data-workflow]').forEach(function(btn){btn.onclick=function(){action(btn.dataset.workflow);};});
    body.querySelectorAll('[data-batch-filter]').forEach(function(btn){btn.onclick=function(){filters.batch=btn.dataset.batchFilter;render();};});
    body.querySelectorAll('[data-pick]').forEach(function(cb){cb.onchange=function(){var set=new Set(APP.screeningDraft.selectedIds);if(cb.checked)set.add(cb.dataset.pick);else set.delete(cb.dataset.pick);APP.screeningDraft.selectedIds=Array.from(set);persist();render();};});
    body.querySelectorAll('[data-identity]').forEach(function(btn){btn.onclick=function(){identity(btn.dataset.identity);};});
    body.querySelectorAll('[data-detail]').forEach(function(btn){btn.onclick=function(){if(window.RosterNavigation)RosterNavigation.openMember(btn.dataset.detail,'screening');else{APP.curIdx=APP.members.findIndex(function(m){return m._memberId===btn.dataset.detail;});close();}};});
    body.querySelectorAll('[data-history-view]').forEach(function(btn){btn.onclick=function(){viewHistory(btn.dataset.historyView);};});
    body.querySelectorAll('[data-history-export]').forEach(function(btn){btn.onclick=function(){exportSnapshot(APP.screeningHistory.find(function(s){return s.id===btn.dataset.historyExport;}));};});
    body.querySelectorAll('[data-history-select]').forEach(function(btn){btn.onclick=function(){reuseHistory(btn.dataset.historySelect);};});
    byId('workflowSearch').oninput=function(){filters.q=this.value;clearTimeout(searchTimer);searchTimer=setTimeout(function(){var pos=byId('workflowSearch').selectionStart;render();byId('workflowSearch').focus();byId('workflowSearch').setSelectionRange(pos,pos);},220);};
    [['workflowBatch','batch'],['workflowReview','review'],['workflowMin','min'],['workflowMax','max']].forEach(function(pair){byId(pair[0]).onchange=function(){filters[pair[1]]=this.value;render();};});
    byId('workflowSelectedOnly').onchange=function(){filters.selectedOnly=this.checked;render();};

  }
  function action(name){
    if(name==='back'){if(window.AdminWorkspace)window.AdminWorkspace.navigate('members');else close();return;}
    if(name==='manage-lists'){manageLists();return;}
    if(name==='create-batch'){createBatch();return;}
    if(name==='copy-latest'){var recent=L.ordered(APP)[0];if(recent)createBatch(recent.id);return;}
    if(name==='show-selection'){filters={q:'',batch:'',review:'',min:'',max:'',selectedOnly:true};render();return;}
    if(name==='reset-filters'){filters={q:'',batch:'',review:'',min:'',max:'',selectedOnly:false};render();return;}
    if(name==='save-screening'){if(L.current(APP))saveScreening();else createBatch();return;}
    if(name==='export-current'){exportCurrent();return;}
    var set=new Set(APP.screeningDraft.selectedIds);
    if(name==='clear-selection'){if(!confirm('只清空本次勾选，不删除任何人员资料。继续？'))return;set.clear();}
    else scores().filter(passes).forEach(function(r){if(name==='select-visible')set.add(r.memberId);else set.delete(r.memberId);});
    APP.screeningDraft.selectedIds=Array.from(set);persist();render();
  }
  function manageLists(){
    openDialog('管理发展名单',listLibrary(),'<button class="btn" id="finishManageLists">完成</button>');
    var host=byId('workflowDialogBody');
    byId('finishManageLists').onclick=closeDialog;
    byId('rosterYear').onchange=function(){listYear=this.value;manageLists();};
    host.querySelectorAll('[data-use-list]').forEach(function(b){b.onclick=function(){if(_cloudConflict)return toast('请先处理保存冲突。','err');L.select(APP,b.dataset.useList);filters={q:'',batch:'',review:'',min:'',max:'',selectedOnly:true,className:'',listScope:''};sv();closeDialog();render();byId('workflowRoster').scrollIntoView({block:'nearest',behavior:'smooth'});};});
    host.querySelectorAll('[data-copy-list]').forEach(function(b){b.onclick=function(){createBatch(b.dataset.copyList);};});
    host.querySelectorAll('[data-rename-list]').forEach(function(b){b.onclick=function(){renameList(b.dataset.renameList);};});
    host.querySelectorAll('[data-delete-list]').forEach(function(b){b.onclick=function(){deleteList(b.dataset.deleteList,b);};});
  }
  function createBatch(copyId){
    var source=copyId?APP.developmentLists.find(function(l){return l.id===copyId;}):null,year=String(new Date().getFullYear());
    openDialog('保存发展名单','<label class="workflow-field">年度<input id="developmentYear" type="number" min="2000" max="2099" value="'+year+'"></label><label class="workflow-field">名单名称<input id="newBatchName" maxlength="80" placeholder="例如：'+year+'年第二批发展对象"></label><p>'+(source?'沿用“'+safe(source.name)+'”的 '+source.memberIds.length+' 位成员，原名单保持不变。':'将当前勾选的 '+APP.screeningDraft.selectedIds.length+' 位成员保存成名单。')+' 未定稿时可继续勾选；到汇总页定稿后固定本批结果。</p>','<button class="btn btn-p" id="confirmNewBatch">保存名单</button>');
    byId('confirmNewBatch').onclick=function(){try{if(_cloudConflict)throw Error('请先处理保存冲突。');if(!(source?source.memberIds:APP.screeningDraft.selectedIds).length)throw Error('请先勾选至少一位同学，再保存名单和分数。');L.create(APP,{name:byId('newBatchName').value,year:byId('developmentYear').value,memberIds:source?source.memberIds.slice():APP.screeningDraft.selectedIds.slice(),period:source?source.period:APP.screeningDraft.period});SavedScores.saveActive();svNow();closeDialog();render();toast('名单已保存，积分汇总将实时更新；到汇总页定稿后冻结。');}catch(e){alert(e.message);}};
  }
  function renameList(id){
    var list=APP.developmentLists.find(function(l){return l.id===id;});if(!list)return;
    openDialog('修改名单名称','<label class="workflow-field">年度<input id="renameListYear" value="'+safe(list.year)+'"></label><label class="workflow-field">名称<input id="renameListName" maxlength="80" value="'+safe(list.name)+'"></label>','<button class="btn btn-p" id="confirmRenameList">保存名称</button>');
    byId('confirmRenameList').onclick=function(){try{if(_cloudConflict)throw Error('请先处理保存冲突。');var name=C.text(byId('renameListName').value),year=C.text(byId('renameListYear').value);if(!name||!/^20\d{2}$/.test(year))throw Error('请填写名单名称和四位年度。');if(APP.developmentLists.some(function(l){return l.id!==id&&l.name===name&&l.year===year;}))throw Error('该年度已有同名名单。');var old=list.name;list.name=name;list.year=year;list.updatedAt=new Date().toISOString();if(APP.screeningDraft.listId===id&&APP.screeningDraft.name===old)APP.screeningDraft.name=name;svNow();closeDialog();render();}catch(e){alert(e.message);}};
  }
  function deleteList(id,anchor){
    if(_cloudConflict)return toast('请先处理保存冲突。','err');var list=APP.developmentLists.find(function(l){return l.id===id;});if(!list)return;
    var bubble=byId('listDeleteConfirm');bubble.innerHTML='<strong>删除这份名单？</strong><p>'+safe(list.name)+'</p><small>只删除名单分组，学生资料、积分和历史结果都会保留。</small><div class="workflow-actions"><button class="btn btn-g" id="cancelDeleteList">取消</button><button class="btn btn-d" id="confirmDeleteList">确认删除</button></div>';
    if(bubble.matches&&bubble.matches(':popover-open'))bubble.hidePopover();
    bubble.showPopover();
    var rect=anchor.getBoundingClientRect(),width=Math.min(310,window.innerWidth-24),height=bubble.getBoundingClientRect().height||190;
    bubble.style.width=width+'px';bubble.style.left=Math.max(12,Math.min((rect.right||width)-width,window.innerWidth-width-12))+'px';bubble.style.top=Math.max(12,Math.min((rect.bottom||rect.top||0)+8,(window.innerHeight||668)-height-12))+'px';
    byId('cancelDeleteList').onclick=function(){bubble.hidePopover();anchor.focus();};byId('cancelDeleteList').focus();
    byId('confirmDeleteList').onclick=function(){if(_cloudConflict)return toast('请先处理保存冲突。','err');var active=APP.screeningDraft.listId===id;L.remove(APP,id);if(active)filters={q:'',batch:'',review:'',min:'',max:'',selectedOnly:false,className:'',listScope:''};svNow();bubble.hidePopover();render();manageLists();toast('已删除名单，学生资料和历史结果仍保留。');};
  }
  function identity(mid){
    var m=APP.members.find(function(x){return x._memberId===mid;});if(!m)return;
    openDialog('补充学号','<p>'+safe(m['姓名'])+' · '+safe(m['班级'])+'</p><label class="workflow-field">学号（按证件核对，可保留前导0）<input id="identityStudentId" type="text" value="'+safe(m['学号']||'')+'"></label><p>补学号不修改积分。若学号已被其他人员使用，将停止保存。</p>','<button class="btn btn-p" id="saveIdentity">保存学号</button>');
    byId('saveIdentity').onclick=function(){var sid=C.text(byId('identityStudentId').value);if(sid&&APP.members.some(function(x){return x._memberId!==mid&&C.studentId(x)===sid;}))return alert('该学号已存在，不能重复。');m['学号']=sid;m._updatedAt=new Date().toISOString();persist();closeDialog();render();};
  }
  function materialReviewHtml(e){var done=(e.materialReview||[]).filter(function(r){return !!r.decision;}).length;return (e.materialDuplicates?'<p class="material-duplicate-note">已识别 '+e.materialDuplicates+' 项重复材料，只保留一次。</p>':'')+((e.materialReview||[]).length?'<button class="btn btn-s" data-material-open="'+e.row+'" id="materialStatusRow'+e.row+'">核对相似材料（'+done+'/'+e.materialReview.length+'）</button>':'');}
  function reviewMaterials(row){
    var pairs=[];previewPlan.entries.forEach(function(e){(e.materialReview||[]).forEach(function(r){pairs.push({entry:e,review:r});});});var index=pairs.findIndex(function(p){return p.entry.row===row;});if(index<0)return;
    var dialog=byId('materialReviewDialog');
    function show(){if(index>=pairs.length){dialog.close();return;}var p=pairs[index],r=p.review;byId('materialReviewBody').innerHTML='<p class="material-review-progress">第 '+(index+1)+' / '+pairs.length+' 项 · '+safe(p.entry.data['姓名'])+' · '+pairs.filter(function(x){return !!x.review.decision;}).length+' 项已确认</p><div class="material-compare"><section><h3>原有材料</h3><p>'+safe(r.existing)+'</p></section><section><h3>本次填写</h3><p>'+safe(r.incoming)+'</p></section></div><p>请核对是否同一项活动或奖项。日期不同的同名活动应分别保留。</p><div class="workflow-actions"><button class="btn btn-p" id="materialSame">同一项，不重复添加</button><button class="btn" id="materialDifferent">不同项，两项都保留</button></div><div class="workflow-actions"><button class="btn btn-g" id="materialPrev"'+(index?'':' disabled')+'>上一项</button><button class="btn btn-g" id="materialSkip">暂不确定，下一项</button></div>';
      function decide(v){r.decision=v;var status=byId('materialStatusRow'+p.entry.row);if(status)status.textContent='核对相似材料（'+p.entry.materialReview.filter(function(x){return !!x.decision;}).length+'/'+p.entry.materialReview.length+'）';index++;show();}
      byId('materialSame').onclick=function(){decide('same');};byId('materialDifferent').onclick=function(){decide('different');};byId('materialPrev').onclick=function(){if(index){index--;show();}};byId('materialSkip').onclick=function(){index++;show();};
    }
    show();if(!dialog.open)dialog.showModal();byId('materialReviewClose').onclick=function(){dialog.close();};
  }
  function previewImport(rows,source,aiReview){
    if(aiReview&&window.AiImportPlan){try{AiImportPlan.assertCurrent(aiReview,APP);}catch(e){toast(e.message,'err');return false;}}
    if(CLOUD_ENABLED&&!_cloudKey){toast('请先登录管理员账号。','err');return false;}
    ensure();APP.members.forEach(_captureManualItems);previewPlan=C.planImport(APP,rows);importSource=source||'手动录入';
    var p=previewPlan,c=p.counts;
    if(!p.entries.length){toast('没有可导入的学生数据；已跳过空行和模板示例。','err');return false;}
    openDialog('导入前核对','<p class="workflow-note">'+safe(importSource)+'：新增 '+c.new+' 人，更新 '+c.update+' 人，无变化 '+c.unchanged+' 人，身份冲突 '+c.conflict+' 行。只追加或更新，不清空历史人员。</p>'+
      (aiReview&&aiReview.materialPartitions&&aiReview.materialPartitions.length?'<p class="workflow-note">已拆分 '+aiReview.materialPartitions.length+' 段原文。导入时用拆分条目替换完全相同的旧整段，原文另行留存，不将整段与子项重复计分。</p>':'')+'<div class="workflow-import-settings"><label>导入记录<select id="importBatch">'+option('','＋新建导入记录','')+options('',false)+'</select></label><label id="importBatchNameWrap">导入记录名称<input id="importBatchName" maxlength="60" placeholder="例如：2026年第二批"></label></div>'+
      '<div class="workflow-table-wrap"><table class="workflow-table"><thead><tr><th>原表行</th><th>姓名／学号</th><th>班级</th><th>处理</th><th>核对事项／变化</th></tr></thead><tbody>'+p.entries.map(function(e){return '<tr><td>'+e.row+'</td><td>'+safe(e.data['姓名'])+'<small>'+safe(e.data['学号']||'未填学号')+'</small></td><td>'+safe(e.data['班级'])+'</td><td>'+({new:'新增',update:'更新',unchanged:'材料无变化',conflict:'暂不导入'})[e.status]+'</td><td>'+safe(e.reason)+materialReviewHtml(e)+(e.changes.length?'<details><summary>查看 '+e.changes.length+' 处变化</summary>'+e.changes.map(function(d){return '<p><b>'+safe(d.field)+'</b><br>原：'+safe(d.before)+'<br>新：'+safe(d.after)+'</p>';}).join('')+'</details>':'')+'</td></tr>';}).join('')+'</tbody></table></div>'+
      (c.conflict?'<label class="workflow-check"><input id="skipImportConflicts" type="checkbox">我确认跳过 '+c.conflict+' 行身份冲突，只导入已核对的人员；冲突行需要修改原表后重新导入。</label>':'')+
      '<p>奖项与活动按完整条目追加去重；其他非空资料按预览更新。请特别核对排名、时长、是否挂科等变化。</p>',
      '<button class="btn btn-g" id="cancelWorkflowImport">取消</button><button class="btn btn-p" id="commitWorkflowImport"'+(c.new+c.update+c.unchanged?'':' disabled')+'>确认导入并选中本批人员</button>');
    byId('workflowDialogBody').querySelectorAll('[data-material-open]').forEach(function(b){b.onclick=function(){reviewMaterials(Number(b.dataset.materialOpen));};});
    // openDialog does not mutate the import plan; cancellation never writes data.
    byId('importBatch').onchange=function(){byId('importBatchNameWrap').classList.toggle('hide',!!this.value);};
    byId('cancelWorkflowImport').onclick=closeDialog;
    byId('commitWorkflowImport').onclick=function(){
      try{if(_cloudConflict)throw new Error('云端存在新版本，请先处理保存冲突。');if(aiReview)AiImportPlan.assertCurrent(aiReview,APP);var destination=aiReview?C.clone(APP):APP;var result=C.applyImport(destination,previewPlan,{batchId:byId('importBatch').value,batchName:byId('importBatchName').value,skipConflicts:!!(byId('skipImportConflicts')&&byId('skipImportConflicts').checked)});
        if(aiReview){AiImportPlan.apply(destination,aiReview,result);if(CLOUD_ENABLED&&new TextEncoder().encode(JSON.stringify(destination)).length>700000)throw Error('AI确认记录使数据接近云端容量上限，已停止导入且未修改现有人员；请先联系维护人员处理存储容量。');APP=destination;R=APP.rules;}
        importReceipt=result;APP.screeningDraft.listId='';closeDialog();filters={q:'',batch:'',review:'',min:'',max:'',selectedOnly:false,className:'',listScope:''};_writeLocal();svNow();if(aiReview&&window.AiImport)AiImport.importCommitted(aiReview.draftId);open();if(window.AdminWorkspace)window.AdminWorkspace.navigate('screening');toast('导入完成。本次导入人员已勾选，可切到全部成员中继续勾选老同学。');
      }catch(e){alert(e.message);}
    };
    return true;
  }
  async function readImportFile(file){
    setProcessLoading(true);
    try{var bytes=await file.arrayBuffer(),wb=XLSX.read(new Uint8Array(bytes),{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]];
      // Read identifiers as displayed text, preserving explicit text/zero-padding.
      var rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});if(byId('useAiImport')&&byId('useAiImport').checked&&window.AiImport){AiImport.open(rows,file.name);return;}previewImport(rows,file.name);
    }catch(e){toast('读取失败：'+e.message,'err');}finally{setProcessLoading(false);}
  }
  function addMember(){
    var fields=['姓名','班级','学号','职位（班级/部门）','学习成绩排名','综测排名','志愿总时长','是否旷课','是否违纪','是否挂科','参与学校、学院的活动（请罗列）','获奖情况'];
    openDialog('手动录入人员（下一步核对导入记录）','<div class="workflow-save-fields">'+fields.map(function(f,i){return '<label>'+safe(f)+(i<2?' *':'')+(i>=10?'<textarea id="manualField'+i+'" rows="3"></textarea>':'<input id="manualField'+i+'" type="text">')+'</label>';}).join('')+'</div>','<button class="btn btn-p" id="previewManualMember">下一步：预览导入</button>');
    byId('previewManualMember').onclick=function(){var row={};fields.forEach(function(f,i){row[f]=byId('manualField'+i).value;});previewImport([row],'手动录入');};
  }
  function saveScreening(){try{if(_cloudConflict)throw Error('请先处理保存冲突。');var rows=scores(),pending=C.selectedRows(APP,rows).some(function(r){return r.uncertain>0;});if(pending&&!confirm('名单中仍有待审核材料，保存的分数将标为待审核。继续？'))return;var snap=SavedScores.saveActive();svNow();render();toast('已保存 '+snap.rows.length+' 人；未定稿汇总会继续实时更新。');}catch(e){alert(e.message);}}
  function viewHistory(id){
    var s=APP.screeningHistory.find(function(x){return x.id===id;});if(!s)return;historyId=id;
    openDialog(s.name,'<p>'+safe(date(s.createdAt))+' · '+safe(s.period)+' · '+safe(s.status)+'</p><p class="workflow-note">这是当时留存的结果，不会随现有人员资料或规则改变。系数：'+s.coefficient+'；评分版本：'+safe(s.criteriaVersion)+'</p>'+table(s.rows,false),'<button class="btn btn-p" id="exportOpenHistory">导出这次结果</button>');
    byId('exportOpenHistory').onclick=function(){exportSnapshot(s);};
  }
  function reuseHistory(id){
    var s=APP.screeningHistory.find(function(x){return x.id===id;});if(!s||!confirm('沿用当时选人名单，覆盖当前勾选。当前分数将按最新资料重算，原历史结果不变。继续？'))return;
    var ids=new Set(APP.members.map(function(m){return m._memberId;}));APP.screeningDraft.listId='';APP.screeningDraft.selectedIds=s.rows.map(function(r){return r.memberId;}).filter(function(mid){return ids.has(mid);});APP.screeningDraft.name=s.name+'（重新核对）';APP.screeningDraft.period=s.period;persist();render();if(window.AdminWorkspace)window.AdminWorkspace.navigate('screening');
  }
  function exportCurrent(){
    ensure();var rows=C.selectedRows(APP,scores());if(!rows.length){toast('请先勾选参加本次筛选的同学。','err');return;}
    exportSnapshot({name:APP.screeningDraft.name||'当前勾选名单',period:C.MATERIAL_SCOPE,createdAt:new Date().toISOString(),rows:rows,rules:APP.rules,criteriaVersion:APP.criteriaVersion,coefficient:1,status:'当前暂计结果'});
  }
  function exportSnapshot(s){
    if(!s)return;var rows=[['名次','姓名','班级','所属发展名单','学业能力','党性成长','纪律约束','总分','待审核项数','审核状态','资料更新时间','筛选名称','材料累计范围','结果留存时间']];
    s.rows.forEach(function(r){rows.push([r.rank==null?'不参与排名':r.rank,r.name,r.className,r.batches,r.acT,r.ptT,r.dcT,r.total,r.uncertain,r.uncertain?'待审核':'无待审核项',date(r.updatedAt),s.name,s.period,date(s.createdAt)]);});
    var ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[8,14,24,30,12,12,12,12,14,16,24,28,40,24].map(function(n){return{wch:n};});
    var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'本次筛选结果');
    var rules=[['规则路径','留存值'],['评分版本',s.criteriaVersion],['本次计分系数',s.coefficient],['结果状态',s.status]];
    function flatten(v,path){if(v&&typeof v==='object')Object.keys(v).forEach(function(k){flatten(v[k],path?path+'.'+k:k);});else rules.push([path,v]);}flatten(s.rules,'评分标准');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rules),'评分依据');XLSX.writeFile(wb,(s.name||'筛选结果').replace(/[\\/:*?"<>|]/g,'_')+'.xlsx');
  }
  byId('btnWorkflow').onclick=open;byId('workflowDialogClose').onclick=closeDialog;
  byId('workflowDialog').addEventListener('click',function(e){if(e.target===this)closeDialog();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!byId('workflowDialog').classList.contains('hide'))closeDialog();});
  byId('btnExport').addEventListener('click',function(e){if(visible){e.stopImmediatePropagation();exportCurrent();}},true);
  var originalRender=window.render;window.render=function(){originalRender();ensure();if(visible){['viewPersonal','viewSummary','emptyState'].forEach(function(id){byId(id).classList.add('hide');});render();}};
  // Preserve access to the original personal renderer: this module's render is scoped.
  var originalApply=window._applyData;window._applyData=function(data){C.ensure(data);originalApply(data);};
  window.AppWorkflow={exportSnapshot:exportSnapshot,capture:function(){return C.clone(filters);},restore:function(saved){filters=Object.assign({q:'',batch:'',review:'',min:'',max:'',selectedOnly:false,className:'',listScope:''},saved||{});render();},open:open,close:close,render:render,previewImport:previewImport,readImportFile:readImportFile,addMember:addMember,isOpen:function(){return visible;},closeDialog:closeDialog};
  ensure();
})();
