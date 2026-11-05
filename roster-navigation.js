(function(){
  'use strict';
  var context=null;
  function openMember(mid,from){
    var i=APP.members.findIndex(function(m){return m._memberId===mid;});if(i<0){toast('该同学已不在当前人员库，保存的积分结果仍保留。','err');return;}
    context={page:from||'screening',scroll:document.getElementById('mainContent').scrollTop,roster:AppWorkflow.capture()};APP.curIdx=i;AdminWorkspace.navigate('members');
    var b=document.getElementById('returnToRoster');b.textContent=context.page==='summary'?'← 返回名单积分汇总':'← 返回发展名单';b.classList.remove('hide');var note=document.getElementById('personalSavedContext');note.textContent='此处查看当前资料；返回名单汇总可查看保存时的分数。';note.classList.toggle('hide',context.page!=='summary');
  }
  document.getElementById('returnToRoster').onclick=function(){if(!context)return;var old=context;if(old.page==='summary')SavedScores.preserveNextView();AdminWorkspace.navigate(old.page);if(old.page==='screening')AppWorkflow.restore(old.roster);document.getElementById('mainContent').scrollTop=old.scroll;this.classList.add('hide');};
  var btn=document.getElementById('btnExportDetail'),pass=false,pop=document.getElementById('exportDetailConfirm');
  btn.addEventListener('click',function(e){if(pass)return;if(!APP.members.length)return;e.stopImmediatePropagation();var m=APP.members[APP.curIdx],mid=m._memberId;
    pop.innerHTML='<strong>导出该同学的积分明细？</strong><p>'+esc(m['姓名'])+' · '+esc(m['班级'])+'</p><div class="workflow-actions"><button class="btn" id="cancelDetailExport">取消</button><button class="btn btn-p" id="confirmDetailExport">确认导出</button></div>';
    pop.showPopover();pop.style.width='310px';var r=btn.getBoundingClientRect();pop.style.left=Math.max(12,Math.min((r.right||310)-310,window.innerWidth-322))+'px';pop.style.top=Math.max(12,Math.min((r.bottom||r.top||0)+8,(window.innerHeight||668)-190))+'px';
    document.getElementById('cancelDetailExport').onclick=function(){pop.hidePopover();btn.focus();};document.getElementById('confirmDetailExport').onclick=function(){if(!APP.members[APP.curIdx]||APP.members[APP.curIdx]._memberId!==mid){pop.hidePopover();return;}pop.hidePopover();pass=true;try{btn.click();}finally{pass=false;}};document.getElementById('cancelDetailExport').focus();
  },true);
  window.RosterNavigation={openMember:openMember};
})();
