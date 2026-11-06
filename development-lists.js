(function(root){
  'use strict';
  function ensure(s){
    BatchCore.ensure(s);
    if(!Array.isArray(s.developmentLists))s.developmentLists=[];
    if(!s.developmentListsMigrated){
      s.batches.filter(function(b){return b.id!=='legacy';}).forEach(function(b){
        if(s.developmentLists.some(function(l){return l.sourceBatchId===b.id;}))return;
        var year=String(b.name||'').match(/20\d{2}/);
        s.developmentLists.push({id:BatchCore.id('list'),name:b.name,year:year?year[0]:'未标年份',sourceBatchId:b.id,memberIds:s.members.filter(function(m){return m._batchIds.indexOf(b.id)>=0;}).map(function(m){return m._memberId;}),createdAt:b.createdAt||null,updatedAt:b.createdAt||null,period:''});
      });
      s.developmentListsMigrated=true;
    }
    var activeIds=new Set(s.members.map(function(m){return m._memberId;}));
    s.developmentLists.forEach(function(l){l.memberIds=Array.from(new Set((l.memberIds||[]).filter(function(id){return activeIds.has(id);})));});
    if(s.screeningDraft.listId&&!s.developmentLists.some(function(l){return l.id===s.screeningDraft.listId&&!l.summaryDeletedAt;}))s.screeningDraft.listId='';
    return s;
  }
  function ordered(s,includeDeleted){ensure(s);return s.developmentLists.filter(function(l){return includeDeleted||!l.summaryDeletedAt;}).sort(function(a,b){return String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))||String(b.year).localeCompare(String(a.year));});}
  function current(s){return s.developmentLists.find(function(l){return l.id===s.screeningDraft.listId;})||null;}
  function create(s,opt){
    ensure(s);var name=BatchCore.text(opt.name),year=BatchCore.text(opt.year);
    if(!name)throw Error('请填写名单名称。');if(!/^20\d{2}$/.test(year))throw Error('请填写四位年度，例如2026。');
    if(s.developmentLists.some(function(l){return l.name===name&&l.year===year;}))throw Error('该年度已有同名发展名单，请换一个名称。');
    var ids=opt.memberIds||s.screeningDraft.selectedIds,active=new Set(s.members.map(function(m){return m._memberId;})),now=new Date().toISOString();
    var list={id:BatchCore.id('list'),name:name,year:year,memberIds:Array.from(new Set(ids.filter(function(id){return active.has(id);}))),scoreMode:'live',period:opt.period||'',createdAt:now,updatedAt:now};s.developmentLists.push(list);select(s,list.id);return list;
  }
  function select(s,id){ensure(s);var list=s.developmentLists.find(function(l){return l.id===id;});if(!list||list.summaryDeletedAt)throw Error('发展名单不存在或已移入回收站。');s.screeningDraft.listId=id;s.screeningDraft.selectedIds=list.memberIds.slice();s.screeningDraft.name=list.name;s.screeningDraft.period=list.period||'';return list;}
  function sync(s){ensure(s);var list=current(s);if(!list||list.summaryDeletedAt||list.scoreMode!=='live')return;var ids=s.screeningDraft.selectedIds.slice(),period=s.screeningDraft.period||'';if(JSON.stringify(ids)!==JSON.stringify(list.memberIds)||period!==list.period){list.memberIds=ids;list.period=period;list.updatedAt=new Date().toISOString();}}
  function remove(s,id){ensure(s);var i=s.developmentLists.findIndex(function(l){return l.id===id;});if(i<0)throw Error('发展名单不存在。');s.developmentLists.splice(i,1);if(s.screeningDraft.listId===id){s.screeningDraft={selectedIds:[],name:'',period:'',listId:''};}}
  root.DevelopmentLists={ensure:ensure,ordered:ordered,current:current,create:create,select:select,sync:sync,remove:remove};
})(typeof window!=='undefined'?window:globalThis);
