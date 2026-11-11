// Isolated DOM harness: exercises real page handlers without a user's browser or cloud credentials.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(options={}){
 const ids=new Map(),all=[];
 function matches(el,selector){
  selector=selector.trim().split(/\s+/).pop();const attr=selector.match(/\[([^\]=]+)(?:=["']?([^\]"']+)["']?)?\]/);
  if(attr&&(!(attr[1] in el.attrs)||(attr[2]!=null&&el.attrs[attr[1]]!==attr[2])))return false;
  const cls=selector.match(/\.([\w-]+)/);if(cls&&!el.classList.contains(cls[1]))return false;
  const tag=selector.match(/^[a-z]+/i);if(tag&&el.tagName!==tag[0].toUpperCase())return false;
  return !selector.includes(':checked')||el.checked;
 }
 function element(tag,attrs={}){
  const e={tagName:tag.toUpperCase(),attrs,style:{},dataset:{},value:attrs.value||((attrs.id==='fCat'||attrs.id==='fLv')?'0':''),textContent:'',checked:'checked'in attrs,disabled:'disabled'in attrs,children:[],handlers:{},captureHandlers:{},showModal(){this.open=true;},close(){this.open=false;},showPopover(){this.popoverOpen=true;},hidePopover(){this.popoverOpen=false;},focus(){},scrollIntoView(){},setSelectionRange(){},appendChild(n){this.children.push(n);},insertBefore(n,ref){const i=this.children.indexOf(ref);this.children.splice(i<0?0:i,0,n);},remove(){},closest(){return null;},getBoundingClientRect(){return{top:0,right:0};},getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(type,fn,capture){var list=capture===true?this.captureHandlers:this.handlers;(list[type]||(list[type]=[])).push(fn);},querySelectorAll(s){return this.children.filter(c=>matches(c,s));},querySelector(s){return this.querySelectorAll(s)[0]||null;},click(){let stopped=false;const event={target:this,stopImmediatePropagation(){stopped=true;},stopPropagation(){}};for(const fn of this.captureHandlers.click||[]){if(!stopped)fn(event);}if(!stopped&&this.onclick)this.onclick(event);for(const fn of this.handlers.click||[]){if(!stopped)fn(event);}}};
  e.classList={contains(c){return(attrs.class||'').split(/\s+/).includes(c);},add(c){attrs.class=Array.from(new Set((attrs.class||'').split(/\s+/).concat(c))).join(' ');},remove(c){attrs.class=(attrs.class||'').split(/\s+/).filter(x=>x!==c).join(' ');},toggle(c,on){if(on==null)on=!this.contains(c);on?this.add(c):this.remove(c);}};
  Object.keys(attrs).filter(k=>k.startsWith('data-')).forEach(k=>e.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attrs[k]);
  Object.defineProperty(e,'innerHTML',{get(){return this.html||'';},set(html){this.html=html;this.children=parse(html);}});
  Object.defineProperty(e,"id",{get(){return attrs.id;},set(v){attrs.id=v;ids.set(v,e);}});if(attrs.id)ids.set(attrs.id,e);all.push(e);return e;
 }
 function parse(html){return Array.from(html.matchAll(/<([a-z][\w-]*)\b([^<>]*)>/gi),m=>{
   const attrs={};for(const a of m[2].matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g))attrs[a[1]]=a[2]??a[3]??'';return element(m[1],attrs);
 });}
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');parse(html);
 const document={getElementById(id){return ids.get(id)||null;},querySelectorAll(s){return all.filter(e=>matches(e,s));},querySelector(s){return this.querySelectorAll(s)[0]||null;},addEventListener(){},createElement:tag=>element(tag),body:element('body')};
 const storage=new Map(),session=options.session||new Map(),alerts=[],windowEvents={};let download;
 const ctx={document,console,TextEncoder,TextDecoder,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),sessionStorage:{getItem(k){return session.get(k)||null;},setItem(k,v){session.set(k,v);},removeItem(k){session.delete(k);}},crypto:require('node:crypto').webcrypto,Blob,URL:{createObjectURL(blob){download=blob;return'blob:test';},revokeObjectURL(){}},localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);},removeItem(k){storage.delete(k);}},setTimeout(){return 1;},clearTimeout(){},addEventListener(name,fn){(windowEvents[name]||(windowEvents[name]=[])).push(fn);},confirm(){return true;},alert(m){alerts.push(m);},cloudbase:{init(){return{};}},XLSX:{},innerWidth:1440};ctx.window=ctx;ctx.location={reload(){}};
 vm.createContext(ctx);['batch-core.js','ai-import-core.js','ai-import-plan.js','development-lists.js','admin-core.js','cloud-sync.js','app.js','ai-import-classification.js','batches.js','manual-dialog.js','scoring-rules-dialog.js','saved-scores-core.js','saved-scores.js'].concat(options.workspace?['workspace.js','roster-navigation.js','admin-tools.js']:[]).concat(['ai-import.js','manual-score.js']).concat(options.workspace?['responsive-ui.js']:[]).forEach(f=>vm.runInContext(f==='app.js'?fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace('enabled:true','enabled:false'):fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx,{filename:f}));
 // The fixture contains no private data; disable cloud writes in this isolated context.
 ctx.CLOUD_ENABLED=false;
 ctx.APP={rules:JSON.parse(JSON.stringify(ctx.DEF)),members:[{'姓名':'虚构老同学','班级':'A班','学号':'001'}],learnedMap:{},criteriaVersion:10,curIdx:0};ctx.R=ctx.APP.rules;ctx.BatchCore.ensure(ctx.APP);ctx.DevelopmentLists.ensure(ctx.APP);ctx.AdminCore.ensure(ctx.APP);ctx._auditSnapshot=ctx.AdminCore.snapshot(ctx.APP);ctx._resetMemberChangeSignatures();
 if(options.workspace)ctx.AdminWorkspace.navigate('dashboard');
 return{ctx,document,ids,alerts,storage,session,windowEvents,getDownload:()=>download};
}
function saveRoster(h){var c=h.ctx,active=c.DevelopmentLists.current(c.APP),name=c.APP.screeningDraft.name||'测试名单';h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='save-screening').click();if(!active){h.ids.get('newBatchName').value=name;h.ids.get('developmentYear').value='2026';h.ids.get('confirmNewBatch').click();}}

test('navigation and student list fold independently and retain an accessible restore button',()=>{
 const h=harness({workspace:true});
 const nav=h.ids.get('workspaceSidebar').children.find(e=>e.className==='btn workspace-collapse-nav');
 const people=h.ids.get('workspacePersonHost').children.find(e=>e.className==='btn workspace-collapse-people');
 nav.click();assert(h.document.body.classList.contains('workspace-nav-collapsed'));assert.equal(nav.getAttribute('aria-expanded'),'false');
 people.click();assert(h.ids.get('workspaceMembers').classList.contains('people-list-collapsed'));
 nav.click();assert(!h.document.body.classList.contains('workspace-nav-collapsed'));assert(h.ids.get('workspaceMembers').classList.contains('people-list-collapsed'));
 people.click();assert.equal(people.getAttribute('aria-expanded'),'true');
 assert.deepEqual(JSON.parse(h.storage.get('pps_layout_preferences')),{navCollapsed:false,peopleCollapsed:false});
});

test('current batch refreshes live scores while explicit finalization freezes both people and totals',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];m['学习成绩排名']='1/40';m._ok=null;c.APP.screeningDraft.selectedIds=[m._memberId];const list=c.DevelopmentLists.create(c.APP,{year:'2026',name:'实时批次'});c.SavedScores.saveActive();c.AdminWorkspace.navigate('summary');h.ids.get('viewSummary').children.find(e=>e.dataset.scoreList===list.id).click();const before=c.SavedScores.currentSnapshot().rows[0].total;
 m['学习成绩排名']='30/40';m._ok=null;c.SavedScores.render();assert.notEqual(c.SavedScores.currentSnapshot().rows[0].total,before);
 h.ids.get('finalizeSummary').click();assert.equal(list.scoreMode,'frozen');const frozen=JSON.stringify(c.SavedScores.currentSnapshot());m['学习成绩排名']='1/40';m._ok=null;c.SavedScores.render();assert.equal(JSON.stringify(c.SavedScores.currentSnapshot()),frozen);const ids=list.memberIds.slice();c.APP.screeningDraft.selectedIds=[];c.DevelopmentLists.sync(c.APP);assert.equal(JSON.stringify(list.memberIds),JSON.stringify(ids));assert.throws(()=>c.SavedScores.saveActive(),/已定稿/);
 h.ids.get('reopenSummary').click();assert.equal(list.scoreMode,'live');assert.notEqual(c.SavedScores.currentSnapshot().rows[0].total,JSON.parse(frozen).rows[0].total);assert(c.APP.screeningHistory.some(s=>s.summaryKind==='final'));
});
test('old saved lists remain frozen until explicitly reopened',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];c.APP.screeningDraft.selectedIds=[m._memberId];const l=c.DevelopmentLists.create(c.APP,{year:'2026',name:'旧名单'});const snap=c.SavedScores.saveActive();delete l.scoreMode;m['学习成绩排名']='1/40';m._ok=null;c.AdminWorkspace.navigate('summary');h.ids.get('viewSummary').children.find(e=>e.dataset.scoreList===l.id).click();assert.equal(c.SavedScores.currentSnapshot().id,snap.id);assert(!h.ids.has('finalizeSummary')||!h.ids.get('viewSummary').innerHTML.includes('id="finalizeSummary"'));
});
test('summary recycling and restoration never remove members, material, scores or saved results',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];c.APP.screeningDraft.selectedIds=[m._memberId];const l=c.DevelopmentLists.create(c.APP,{year:'2026',name:'可恢复汇总'});c.SavedScores.saveActive();const members=JSON.stringify(c.APP.members),history=JSON.stringify(c.APP.screeningHistory);c.AdminWorkspace.navigate('summary');h.ids.get('viewSummary').children.find(e=>e.dataset.summaryList===l.id).click();assert(l.summaryDeletedAt);assert(!h.ids.get('viewSummary').children.some(e=>e.dataset.scoreList===l.id));h.ids.get('summaryTrashToggle').click();assert.equal(c.AdminWorkspace.currentPage(),'recycle');assert(h.ids.get('workspaceRecycle').children.some(e=>e.dataset.restoreSummary===l.id));h.ids.get('workspaceRecycle').children.find(e=>e.dataset.restoreSummary===l.id).click();assert(!l.summaryDeletedAt);assert.equal(JSON.stringify(c.APP.members),members);assert.equal(JSON.stringify(c.APP.screeningHistory),history);c.AdminWorkspace.navigate('summary');assert(h.ids.get('viewSummary').children.some(e=>e.dataset.scoreList===l.id));
});
test('summary sorting is numeric, reversible, stable and never mutates historical rows',()=>{
 const h=harness(),core=h.ctx.SavedScoresCore,rows=[{memberId:'a',name:'张同学',total:9,ac:[3]},{memberId:'b',name:'李同学',total:100,ac:[8]},{memberId:'c',name:'王同学',total:20,ac:[]}],original=JSON.stringify(rows);
 assert.equal(core.ordered(rows,'total','asc').map(r=>r.total).join(','),'9,20,100');assert.equal(core.ordered(rows,'total','desc').map(r=>r.total).join(','),'100,20,9');assert.equal(core.ordered(rows,'ac.0','desc').map(r=>r.memberId).join(','),'b,a,c');assert.equal(JSON.stringify(rows),original);
});
test('summary table hides student id and every displayed heading toggles its own sort direction',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.screeningDraft.selectedIds=[c.APP.members[0]._memberId];const l=c.DevelopmentLists.create(c.APP,{year:'2026',name:'排序名单'});c.AdminWorkspace.navigate('summary');h.ids.get('viewSummary').children.find(e=>e.dataset.scoreList===l.id).click();assert(!h.ids.get('viewSummary').innerHTML.includes('>学号<'));let b=h.ids.get('viewSummary').children.find(e=>e.dataset.summarySort==='total');assert(b);b.click();assert(h.ids.get('viewSummary').innerHTML.includes('aria-sort="ascending"><button class="summary-sort" data-summary-sort="total"'));h.ids.get('viewSummary').children.find(e=>e.dataset.summarySort==='total').click();assert(h.ids.get('viewSummary').innerHTML.includes('aria-sort="descending"><button class="summary-sort" data-summary-sort="total"'));
});

test('full page scripts load and workflow renders using all referenced DOM ids',()=>{
 const h=harness();h.ctx.AppWorkflow.open();assert.match(h.ids.get('workflowView').innerHTML,/历史已录入人员/);assert.match(h.ids.get('workflowView').innerHTML,/虚构老同学/);assert(h.ids.has('developmentListSelect'));
});
test('preview, batch commit and selection execute the real click handlers',()=>{
 const h=harness();h.ctx.AppWorkflow.previewImport([{'姓名':'虚构新同学','班级':'B班','学号':'002'}],'测试表');h.ids.get('importBatchName').value='第二批';h.ids.get('commitWorkflowImport').click();
 assert.deepEqual(h.alerts,[]);assert.equal(h.ctx.APP.members.length,2);assert.equal(h.ctx.APP.screeningDraft.selectedIds.length,1);assert(h.ctx.AppWorkflow.isOpen());assert.equal(h.ctx.APP.batches.length,2);
 const old=h.ctx.APP.members[0]._memberId,cb=h.ids.get('workflowView').children.find(e=>e.dataset.pick===old);
 // Switch the batch filter, then select an old student without dropping the new selection.
 h.ids.get('workflowBatch').value='legacy';h.ids.get('workflowBatch').onchange();
 const oldBox=h.ids.get('workflowView').children.find(e=>e.dataset.pick===old);oldBox.checked=true;oldBox.onchange();
 assert.equal(h.ctx.APP.screeningDraft.selectedIds.length,2);
});
test('snapshot click retains mixed-cohort result and backup includes workflow data',()=>{
 const h=harness();h.ctx.AppWorkflow.open();h.ctx.APP.screeningDraft.selectedIds=[h.ctx.APP.members[0]._memberId];h.ctx.APP.screeningDraft.name='联合筛选';h.ctx.APP.screeningDraft.period='统一统计学年';
 saveRoster(h);assert.equal(h.ctx.APP.screeningHistory.length,1);h.ctx._downloadFullBackup();
 return h.getDownload().text().then(text=>{const backup=JSON.parse(text);assert.equal(backup.screeningHistory.length,1);assert.equal(backup.batches.length,1);assert.equal(backup.screeningDraft.selectedIds.length,1);});
});
test('cancelling an import preview does not add people or create a batch',()=>{
 const h=harness(),before=JSON.stringify(h.ctx.APP);h.ctx.AppWorkflow.previewImport([{'姓名':'虚构新同学','班级':'B班'}],'测试表');h.ids.get('cancelWorkflowImport').click();assert.equal(JSON.stringify(h.ctx.APP),before);
});
test('conflict consent is enforced through the real preview handler',()=>{
 const h=harness();h.ctx.AppWorkflow.previewImport([{'姓名':'错误姓名','班级':'A班','学号':'001'},{'姓名':'虚构新同学','班级':'B班','学号':'002'}],'测试表');h.ids.get('importBatchName').value='第二批';h.ids.get('commitWorkflowImport').click();assert.equal(h.ctx.APP.members.length,1);assert.match(h.alerts[0],/冲突/);
 h.ids.get('skipImportConflicts').checked=true;h.ids.get('commitWorkflowImport').click();assert.equal(h.ctx.APP.members.length,2);
});
test('complete selection shortcut removes hidden batch and score filters',()=>{
 const h=harness();h.ctx.AppWorkflow.open();h.ctx.APP.screeningDraft.selectedIds=[h.ctx.APP.members[0]._memberId];h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='show-selection').click();assert.equal(h.ids.get('workflowBatch').value,'');assert.match(h.ids.get('workflowView').innerHTML,/查看全部已选/);
});
test('returning from the workflow invokes the personal renderer without recursion',()=>{
 const h=harness();h.ctx.AppWorkflow.open();h.ctx.AppWorkflow.close();assert.equal(h.ctx.AppWorkflow.isOpen(),false);assert(h.ids.get('workflowView').classList.contains('hide'));assert.equal(h.ids.get('mhName').textContent,'虚构老同学');
});

test('administrator starts on a clear dashboard with navigation to every board',()=>{
 const h=harness({workspace:true});assert.equal(h.ctx.AdminWorkspace.currentPage(),'dashboard');
 assert.match(h.ids.get('workspaceDashboard').innerHTML,/今天要处理哪项工作/);
 for(const label of ['资料导入','人员与积分','发展名单','待审核材料','名单积分汇总','历史筛选结果','评分标准','备份与恢复'])assert(h.ids.get('workspaceSidebar').innerHTML.includes(label));
});
test('workspace navigation separates import, people, criteria, screening and history',()=>{
 const h=harness({workspace:true});
 for(const [page,panel] of [['import','workspaceImport'],['members','workspaceMembers'],['criteria','workspaceCriteria'],['screening','workflowView'],['history','workflowView'],['backup','workspaceBackup']]){
  h.ctx.AdminWorkspace.navigate(page);assert.equal(h.ctx.AdminWorkspace.currentPage(),page);assert(!h.ids.get(panel).classList.contains('hide'));
 }
});
test('workspace retains member details and can return to the dashboard',()=>{
 const h=harness({workspace:true});h.ctx.AdminWorkspace.navigate('members');assert.equal(h.ids.get('mhName').textContent,'虚构老同学');h.ctx.AdminWorkspace.navigate('dashboard');assert(!h.ids.get('workspaceDashboard').classList.contains('hide'));
});
test('workflow back and student-detail buttons return to the people board',()=>{
 const h=harness({workspace:true});h.ctx.AdminWorkspace.navigate('screening');
 h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='back').click();assert.equal(h.ctx.AdminWorkspace.currentPage(),'members');
 h.ctx.AdminWorkspace.navigate('screening');h.ids.get('workflowView').children.find(e=>e.dataset.detail).click();assert.equal(h.ctx.AdminWorkspace.currentPage(),'members');
});
test('saved roster export keeps aligned headers and exports only the stored snapshot',()=>{
 const h=harness({workspace:true}),c=h.ctx;let output;c.APP.screeningDraft.selectedIds=[c.APP.members[0]._memberId];c.DevelopmentLists.create(c.APP,{year:'2026',name:'导出保存的名单'});const snap=c.SavedScores.saveActive();
 c.XLSX={utils:{aoa_to_sheet(rows){return{rows};},book_new(){return{sheets:[]};},book_append_sheet(wb,sheet,name){wb.sheets.push({sheet,name});}},writeFile(wb){output=wb;}};
 c.AdminWorkspace.navigate('summary');h.ids.get('viewSummary').children.find(e=>e.dataset.scoreList).click();h.ids.get('btnExport').click();assert(output);const rows=output.sheets[0].sheet.rows;assert.equal(rows[0].length,14);assert.equal(rows[1].length,14);assert.equal(rows[1][7],snap.rows[0].total);assert(!JSON.stringify(output).includes('一票否决'));
});

test('ordinary discipline deductions still count without an automatic veto',()=>{
 const h=harness();const m=h.ctx.APP.members[0];h.ctx.classifyMember(m);m._cl.ac[0]=[{raw:'测试',score:20,auto:false}];m._cl.dc[0]=[{raw:'普通纪律扣分',score:-2,auto:false}];m._cl.dc[5]=[{raw:'历史兼容记录',score:-1,auto:false}];const fin=h.ctx.calc(m,false);
 assert.equal(fin.t,18);assert.equal(fin.dc.length,5);assert(!fin.veto);assert.equal(h.ctx.DS.length,5);
});
test('removing a person retains frozen history and removes draft membership',async()=>{
 const h=harness({workspace:true}),m=h.ctx.APP.members[0];h.ctx.APP.screeningDraft.selectedIds=[m._memberId];h.ctx.APP.screeningHistory=[{id:'saved',rows:[{memberId:m._memberId,name:m['姓名']}]}];h.ctx.AdminWorkspace.navigate('members');h.ids.get('workspaceRemoveMember').click();assert.equal(h.ctx.APP.members.length,0);assert.equal(h.ctx.APP.screeningDraft.selectedIds.length,0);assert.equal(h.ctx.APP.screeningHistory[0].rows.length,1);
 assert.equal(h.ctx.APP.recycleBin.length,1);assert.equal(h.ctx.APP.recycleBin[0].member._memberId,m._memberId);assert.equal(h.getDownload(),undefined);
});
test('people overview exposes seventeen compact scoring rows without altering scoring rules',()=>{
 const h=harness({workspace:true}),rules=JSON.stringify(h.ctx.APP.rules);h.ctx.AdminWorkspace.navigate('members');
 const rows=h.ids.get('personOverviewGroups').children.filter(e=>'personSub' in e.dataset);assert.equal(rows.length,17);assert.match(h.ids.get('personProfileMeta').textContent,/001/);assert.equal(JSON.stringify(h.ctx.APP.rules),rules);
 let edited;h.ctx.editSub=index=>{edited=index;};rows.at(-1).click();assert.equal(edited,16);
});
test('criteria version remains hidden after the criteria view is rendered',()=>{
 const h=harness({workspace:true});h.ctx.AdminWorkspace.navigate('criteria');assert('hidden' in h.ids.get('critVersionLabel').attrs);assert(h.ids.get('critVersionLabel').classList.contains('hide'));
});
test('student-id search and class filtering survive a person-list rerender',()=>{
 const h=harness({workspace:true});h.ctx.APP.members.push({'姓名':'另一位虚构同学','班级':'B班','学号':'002'});h.ctx.BatchCore.ensure(h.ctx.APP);h.ctx.AdminWorkspace.navigate('members');
 const search=h.ids.get('searchMember');search.value='002';for(const cb of search.handlers.input||[])cb.call(search,{});assert.match(h.ids.get('memberListMeta').textContent,/显示 1 人/);
 h.ctx.render();assert.match(h.ids.get('memberListMeta').textContent,/显示 1 人/);
 const select=h.ids.get('memberClassFilter');select.value='A班';select.onchange();assert.match(h.ids.get('memberListMeta').textContent,/显示 0 人/);assert(!h.ids.get('memberSearchEmpty').classList.contains('hide'));
});
test('compact overview reflects the existing scoring calculation after a manual edit',()=>{
 const h=harness({workspace:true});h.ctx.AdminWorkspace.navigate('members');const m=h.ctx.APP.members[0];m._cl.ac[0]=[{raw:'测试人工分项',score:12.5,auto:false}];h.ctx.render();
 assert.match(h.ids.get('personOverviewGroups').innerHTML,/12\.5/);assert.equal(h.ctx.calc(m,false).acT,12.5);assert.equal(h.ids.get('cAc').innerHTML||h.ids.get('cAc').textContent,'12.5');
});


test('exit guard prompts for pending, failed, busy and conflicting cloud changes but not saved data',()=>{
 const h=harness();h.ctx.CLOUD_ENABLED=true;h.ctx._cloudKey={};let pushes=0;h.ctx.pushCloud=()=>{pushes++;};
 h.ctx._writeLocal();h.ctx._lastSavedPayload=JSON.stringify(h.ctx.APP);
 function leave(){let prevented=false;const e={preventDefault(){prevented=true;}};h.windowEvents.beforeunload.forEach(fn=>fn(e));return prevented;}
 assert.equal(leave(),false);assert.equal(pushes,0);
 h.ctx.APP.screeningDraft.name='changed';h.ctx.sv();assert.match(h.ids.get('cloudSaveState').textContent,/等待保存/);assert.equal(leave(),true);assert.equal(pushes,1);
 h.ctx._lastSavedPayload=JSON.stringify(h.ctx.APP);assert.equal(leave(),false);
 h.ctx._cloudBusy=true;assert.equal(leave(),true);assert.equal(pushes,1);h.ctx._cloudBusy=false;
 h.ctx._cloudConflict=true;assert.equal(leave(),true);assert.equal(pushes,1);h.ctx._cloudConflict=false;
 h.ctx._cloudDirty=true;assert.equal(leave(),true);h.ctx._cloudDirty=false;
 h.ctx._cloudKey=null;assert.equal(leave(),false);
});

test('import completion reports counts and its next-step controls open personnel and reset screening filters',()=>{
 const h=harness({workspace:true});h.ctx.AppWorkflow.previewImport([{'姓名':'新增虚构学生','班级':'B班','学号':'002','获奖情况':'2026年未知比赛获奖'}],'test');h.ids.get('importBatchName').value='测试批次';h.ids.get('commitWorkflowImport').click();
 const html=h.ids.get('workflowView').innerHTML;assert.match(html,/新增 <strong>1<\/strong> 人/);assert.match(html,/待审核/);assert.match(html,/以顶部保存状态为准/);
 const controls=()=>h.ids.get('workflowView').children.filter(e=>e.dataset.importNext);
 controls().find(e=>e.dataset.importNext==='members').click();assert.equal(h.ctx.AdminWorkspace.currentPage(),'members');assert.equal(h.ctx.APP.members[h.ctx.APP.curIdx]['学号'],'002');
 h.ctx.AdminWorkspace.navigate('screening');controls().find(e=>e.dataset.importNext==='screening').click();assert.equal(h.ids.get('workflowBatch').value,'');
 controls().find(e=>e.dataset.importNext==='dismiss').click();assert(!h.ids.get('workflowView').innerHTML.includes('最近一次导入结果'));
});


test('unchanged queued save returns to saved status without a cloud write',()=>{
 const h=harness();h.ctx.CLOUD_ENABLED=true;h.ctx._cloudKey={};h.ctx._writeLocal();h.ctx._lastSavedPayload=JSON.stringify(h.ctx.APP);
 h.ctx._setCloudSaveState('saving','pending');h.ctx.pushCloud();assert.equal(h.ids.get('cloudSaveState').dataset.state,'saved');assert.equal(h.ctx._cloudBusy,false);
});


test('fictional end-to-end: old-person supplement, new import, manual review, mixed selection and real XLSX roundtrip',()=>{
 const h=harness({workspace:true}),c=h.ctx;
 const old=c.APP.members[0],oldId=old._memberId,rules=JSON.stringify(c.APP.rules);
 old['获奖情况']='2025年｜虚构程序设计竞赛｜校赛｜二等奖';old['志愿总时长']='10';
 c.classifyMember(old);c._resetMemberChangeSignatures();
 const uncertain='2026年｜虚构程序设计竞赛｜阶段不清楚｜二等奖';
 c.AppWorkflow.previewImport([
   {'姓名':old['姓名'],'班级':old['班级'],'学号':'001','获奖情况':uncertain,'志愿总时长':'15'},
   {'姓名':'虚构新同学乙','班级':'B班','学号':'002','学习成绩排名':'1/40'},
   {'姓名':'虚构冲突行','班级':'C班','学号':'002'}
 ],'虚构综合验收');
 h.ids.get('importBatchName').value='虚构验收第一批';h.ids.get('skipImportConflicts').checked=true;h.ids.get('commitWorkflowImport').click();
 assert.equal(c.APP.members.length,1);assert.equal(old._memberId,oldId);assert.equal(c.APP.members[0]['志愿总时长'],'15');assert.match(c.APP.members[0]['获奖情况'],/2025年/);assert.match(c.APP.members[0]['获奖情况'],/2026年/);
 c.AppWorkflow.previewImport([{'姓名':'虚构新同学乙','班级':'B班','学号':'002','学习成绩排名':'1/40'}],'虚构新生');h.ids.get('importBatchName').value='虚构验收第二批';h.ids.get('commitWorkflowImport').click();assert.equal(c.APP.members.length,2);
 c.APP.curIdx=c.APP.members.findIndex(m=>m._memberId===oldId);c.AdminWorkspace.navigate('members');
 const m=c.APP.members[c.APP.curIdx],uncIndex=m._unc.findIndex(u=>u.raw.includes('阶段不清楚'));assert(uncIndex>=0,'unclear stage must remain pending');
 c.quickFix(uncIndex);const si=Array.from(c.AC).indexOf('学科竞赛');assert(si>=0);h.ids.get('fCat').value=String(si);h.ids.get('fCat').onchange();h.ids.get('fLv').value='1';h.ids.get('btnFix').click();
 const manual=m._cl.ac[si].find(x=>x.raw.includes('阶段不清楚'));assert.equal(manual.auto,false);assert.equal(manual.score,6);c.svNow();
 c.AppWorkflow.previewImport([{'姓名':m['姓名'],'班级':m['班级'],'学号':'001','参与活动':'2026年｜虚构理论学习活动｜参与'}],'再次补充');h.ids.get('importBatchName').value='虚构验收补充';h.ids.get('commitWorkflowImport').click();
 c.classifyMember(c.APP.members.find(x=>x._memberId===oldId));assert.equal(c.APP.members.find(x=>x._memberId===oldId)._cl.ac[si].find(x=>x.raw.includes('阶段不清楚')).score,6);
 c.AdminWorkspace.navigate('screening');h.ids.get('workflowBatch').value='';h.ids.get('workflowBatch').onchange();
 const fresh=c.APP.members.find(x=>x['学号']==='002');const checkbox=h.ids.get('workflowView').children.find(e=>e.dataset.pick===fresh._memberId);checkbox.checked=true;checkbox.onchange();assert.equal(c.APP.screeningDraft.selectedIds.length,2);
 c.APP.screeningDraft.name='虚构跨批次验收';
 saveRoster(h);assert.equal(c.APP.screeningHistory.length,1);const snap=JSON.stringify(c.APP.screeningHistory[0]);assert.equal(c.APP.screeningHistory[0].rows.length,2);
 const XLSX=require('../xlsx.full.min.js');let exported;c.XLSX={utils:XLSX.utils,writeFile(wb,name){exported={wb,name};}};
 h.ctx.AppWorkflow.exportSnapshot(h.ctx.APP.screeningHistory[0]);assert(exported);const bytes=XLSX.write(exported.wb,{type:'buffer',bookType:'xlsx'}),roundtrip=XLSX.read(bytes,{type:'buffer'});
 assert.equal(roundtrip.SheetNames.length,2);const rows=XLSX.utils.sheet_to_json(roundtrip.Sheets[roundtrip.SheetNames[0]],{header:1});assert.equal(rows.length,3);assert.equal(rows[0].length,14);assert(!rows[0].includes('学号'));assert(rows.slice(1).some(r=>r[1]===m['姓名']));
 c.APP.members[0]['志愿总时长']='20';c.render();assert.equal(JSON.stringify(c.APP.screeningHistory[0]),snap);assert.equal(JSON.stringify(c.APP.rules),rules);assert.deepEqual(h.alerts,[]);
});


async function loginFixture(){
 const h=harness(),c=h.ctx,password='fictional-login-password',salt=c._genSalt();
 const key=await c._deriveKey(password,salt,true),enc=await c._encrypt(key,JSON.stringify(c.APP));
 const rec={_id:'fictional-record',key:'main_admin_account_v2',salt,iv:enc.iv,data:enc.data,revision:9};
 c.CLOUD_ENABLED=true;c._cloudApp={auth(){return{async getUserInfo(){return{uid:c.CLOUD.adminUid};},async signInWithPassword(){return{};},async signOut(){}};}};
 c._cloudGet=async()=>rec;h.ids.get('loginUsername').value='administrator';h.ids.get('loginAccountPwd').value=password;
 await c.tryLogin();assert(c._cloudKey);assert(h.session.has(c.ADMIN_SESSION_STORE));return{h,rec,password};
}

test('password login retains only a tab session and refresh decrypts latest cloud data with an adopted revision',async()=>{
 const {h,rec,password}=await loginFixture();assert(!JSON.stringify([...h.session]).includes(password));assert(!h.storage.has('pps_ck'));assert.equal(h.ids.get('loginAccountPwd').value,'');
 const latest=JSON.parse(JSON.stringify(h.ctx.APP));latest.members[0]['班级']='云端最新虚构班';const enc=await h.ctx._encrypt(h.ctx._cloudKey,JSON.stringify(latest));Object.assign(rec,enc,{revision:10});
 const fresh=harness({session:h.session}),c=fresh.ctx;c.CLOUD_ENABLED=true;c._cloudApp=h.ctx._cloudApp;c._cloudGet=async()=>rec;
 assert.equal(await c._tryAutoLogin(),true);assert.equal(c.APP.members[0]['班级'],'云端最新虚构班');assert.equal(c._cloudGuard.getBase().revision,10);assert.equal(c._cloudKey.extractable,false);assert(!fresh.ids.get('loginBg').classList.contains('on'));assert.equal(c._hasPendingCloudChanges(),false);
});

test('expired tab sessions require login without fetching cloud data',async()=>{
 const {h}=await loginFixture(),c=h.ctx;const session=JSON.parse(h.session.get(c.ADMIN_SESSION_STORE));session.expiresAt=Date.now()-1;h.session.set(c.ADMIN_SESSION_STORE,JSON.stringify(session));c._cloudKey=null;c._cloudGet=()=>{throw Error('must not fetch');};
 assert.equal(await c._tryAutoLogin(),false);assert.equal(c._cloudKey,null);assert(!h.session.has(c.ADMIN_SESSION_STORE));assert.match(h.ids.get('loginErr').textContent,/过期/);
});

test('refresh verifies administrator identity and never accepts a cached key from another identity',async()=>{
 const {h}=await loginFixture(),c=h.ctx;c._cloudKey=null;c._cloudApp={auth(){return{async getUserInfo(){return{uid:'wrong-user'};}};}};c._cloudGet=()=>{throw Error('must not fetch');};
 assert.equal(await c._tryAutoLogin(),false);assert.equal(c._cloudKey,null);assert(!h.session.has(c.ADMIN_SESSION_STORE));assert(h.ids.get('loginBg').classList.contains('on'));assert.equal(h.ids.get('btnLogin').disabled,false);
});

test('changed encryption or unavailable cloud data falls back to login without overwriting local personnel',async()=>{
 const {h,rec}=await loginFixture(),c=h.ctx,before=JSON.stringify(c.APP);c._cloudKey=null;rec.salt='changed-salt';
 assert.equal(await c._tryAutoLogin(),false);assert.equal(JSON.stringify(c.APP),before);assert.equal(c._cloudKey,null);assert(!h.session.has(c.ADMIN_SESSION_STORE));
});

test('explicit logout clears tab credentials and refresh cannot restore the session',async()=>{
 const {h}=await loginFixture(),c=h.ctx;let reloaded=false;c.location.reload=()=>{reloaded=true;};c.doLogout();await Promise.resolve();
 assert(!h.session.has(c.ADMIN_SESSION_STORE));assert.equal(c._cloudKey,null);assert(reloaded);assert.equal(await c._tryAutoLogin(),false);
});


test('recycle restores only one archive, preserves manual score and current data, and leaves historical selection frozen',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._cl.ac[0]=[{raw:'人工确认项目',score:7,auto:false}];c.svNow();c.APP.screeningDraft.selectedIds=[m._memberId];c.APP.screeningHistory=[{id:'frozen',rows:[{memberId:m._memberId,total:7}]}];const history=JSON.stringify(c.APP.screeningHistory);
 h.ids.get('workspaceRemoveMember').click();assert.equal(c.APP.members.length,0);assert.equal(c.APP.auditLog.at(-1).action,'移入回收站');
 c.APP.members.push({'姓名':'另外的虚构同学','班级':'最新班','学号':'002'});c.BatchCore.ensure(c.APP);c.svNow();c.AdminWorkspace.navigate('recycle');assert(!h.ids.get('workspaceRecycle').classList.contains('hide'));
 h.ids.get('workspaceRecycle').children.find(e=>e.dataset.restorePerson).click();assert.equal(c.APP.members.length,2);assert.equal(c.APP.recycleBin.length,0);assert.equal(c.APP.members.find(x=>x['学号']==='002')['班级'],'最新班');assert.equal(JSON.stringify(c.APP.screeningHistory),history);assert.equal(c.APP.screeningDraft.selectedIds.length,0);
 const restored=c.APP.members.find(x=>x._memberId===m._memberId);c.classifyMember(restored);assert.equal(c.calc(restored,false).acT,7);assert.equal(c.APP.auditLog.at(-1).action,'恢复人员');
});

test('restore rejects duplicate student IDs and ambiguous legacy identity without changing the recycle archive',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.AdminCore.archive(c.APP,m._memberId);const id=c.APP.recycleBin[0].id;c.APP.members.push({'姓名':'其他姓名','班级':'B班','学号':'001'});c.BatchCore.ensure(c.APP);
 assert.throws(()=>c.AdminCore.restore(c.APP,id),/核对/);assert.equal(c.APP.recycleBin.length,1);
 c.APP.members=[{'姓名':m['姓名'],'班级':m['班级']}];c.BatchCore.ensure(c.APP);assert.throws(()=>c.AdminCore.restore(c.APP,id),/核对/);assert.equal(c.APP.members.length,1);
});

test('permanent deletion downloads a recoverable backup and records the action without deleting saved results',async()=>{
 const h=harness({workspace:true}),c=h.ctx;c.AdminCore.archive(c.APP,c.APP.members[0]._memberId);c.svNow();c.APP.screeningHistory=[{id:'keep',rows:[]}];c.AdminWorkspace.navigate('recycle');h.ids.get('workspaceRecycle').children.find(e=>e.dataset.purgePerson).click();
 const backup=JSON.parse(await h.getDownload().text());assert.equal(backup.recycleBin.length,1);assert.equal(c.APP.recycleBin.length,0);assert.equal(c.APP.screeningHistory.length,1);assert.equal(c.APP.auditLog.at(-1).action,'永久删除人员');
});

test('audit records before/after materials and manual scores once, ignores rendering, and logs rule edits',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];c.render();c.svNow();assert.equal(c.APP.auditLog.length,0);
 m['志愿总时长']='15';c.svNow();assert.equal(c.APP.auditLog.length,1);assert(c.APP.auditLog[0].changes.some(d=>d.field==='志愿总时长'&&d.after==='15'));
 c.render();c.svNow();assert.equal(c.APP.auditLog.length,1);m._cl.ac[0]=[{raw:'测试人工计分',score:6,auto:false}];c.svNow();assert(c.APP.auditLog.at(-1).changes.some(d=>d.field==='人工计分'));
 c.APP.rules.volunteer.cap=9;c.svNow();assert.equal(c.APP.auditLog.at(-1).action,'修改评分规则');c.AdminWorkspace.navigate('audit');assert.match(h.ids.get('workspaceAudit').innerHTML,/修改前/);assert.match(h.ids.get('workspaceAudit').innerHTML,/修改后/);
});

test('audit keeps at most 500 entries and existing data loads without retroactively fabricating edit records',()=>{
 const h=harness(),c=h.ctx;for(let i=0;i<505;i++){c.APP.members[0]['班级']='班'+i;c.svNow();}assert.equal(c.APP.auditLog.length,500);
 const imported=JSON.parse(JSON.stringify(c.APP));imported.members[0]['班级']='云端已有资料';c._applyData(imported);assert.equal(c.APP.auditLog.length,500);c.svNow();assert.equal(c.APP.auditLog.length,500);
});

function reviewFixture(){const h=harness({workspace:true}),c=h.ctx;c.APP.members[0]['获奖情况']='2026年｜虚构程序设计竞赛甲｜阶段不清楚｜二等奖';c.APP.members[0]._ok=null;c.APP.members.push({'姓名':'虚构待审核乙','班级':'B班','学号':'002','获奖情况':'2026年｜虚构程序设计竞赛乙｜阶段不清楚｜二等奖'});c.BatchCore.ensure(c.APP);c.svNow();return h;}

test('continuous review confirms one real item, advances to the next student, and leaves skipped material pending',()=>{
 const h=reviewFixture(),c=h.ctx;c.AdminWorkspace.navigate('review');h.ids.get('workspaceReview').children.find(e=>e.id==='startContinuousReview').click();assert.equal(c.APP.curIdx,0);assert.match(h.ids.get('modalBox').children[0].innerHTML,/第 1/);
 const si=Array.from(c.AC).indexOf('学科竞赛');h.ids.get('fCat').value=String(si);h.ids.get('fCat').onchange();h.ids.get('fLv').value='1';h.ids.get('btnFix').click();assert.equal(c.APP.curIdx,1);assert.match(h.ids.get('modalBox').children[0].innerHTML,/已确认 1/);
 h.ids.get('reviewSkip').click();assert.equal(c.AdminWorkspace.currentPage(),'review');assert.equal(c.APP.members[0]._unc.length,0);assert.equal(c.APP.members[1]._unc.length,1);assert(c.APP.auditLog.some(r=>r.changes.some(d=>d.field==='人工计分')));
 c.classifyMember(c.APP.members[0]);assert.equal(c.APP.members[0]._cl.ac[si].find(x=>x.auto===false).score,6);
});

test('stopping continuous review or encountering a save conflict does not confirm the pending item',()=>{
 const h=reviewFixture(),c=h.ctx;c.AdminTools.startReview();h.ids.get('reviewStop').click();assert.equal(c.APP.members[0]._unc.length,1);assert.equal(c.AdminWorkspace.currentPage(),'review');
 c.AdminTools.startReview();c._cloudConflict=true;h.ids.get('btnFix').click();assert.equal(c.APP.members[0]._unc.length,1);assert.equal(c.APP.curIdx,0);assert.match(h.ids.get('toast').textContent,/冲突/);
});


test('manual opens inside the app, closes back to its trigger, and its chapter controls scroll the article',()=>{
 const h=harness(),dialog=h.ids.get('adminManualDialog'),trigger=h.ids.get('adminManualLink'),article=h.ids.get('manualDialogArticle');let focused=false,scrolled=false;
 trigger.focus=()=>{focused=true;};dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;(dialog.handlers.close||[]).forEach(fn=>fn());};article.scrollTop=0;article.scrollTo=()=>{scrolled=true;};
 trigger.click();assert.equal(dialog.open,true);assert.equal(article.scrollTop,0);
 h.document.querySelectorAll('[data-manual-target]')[0].click();assert(scrolled);
 h.ids.get('manualDialogClose').click();assert.equal(dialog.open,false);assert(focused);
 assert.match(h.ids.get('adminManualDialog').attrs['aria-labelledby'],/manualDialogTitle/);
});


test('scoring reference opens and navigates without modifying rules, members or the manual dialog',()=>{
 const h=harness(),d=h.ids.get('scoringRulesDialog'),a=h.ids.get('rulesDialogArticle'),before=JSON.stringify(h.ctx.APP);let scrolled=false,focused=false;
 d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;(d.handlers.close||[]).forEach(f=>f());};a.scrollTo=()=>{scrolled=true;};a.scrollTop=0;h.ids.get('scoringRulesLink').focus=()=>{focused=true;};
 h.ids.get('scoringRulesLink').click();assert(d.open);h.document.querySelectorAll('[data-rules-target]')[0].click();assert(scrolled);h.ids.get('scoringRulesClose').click();assert.equal(d.open,false);assert(focused);assert.equal(JSON.stringify(h.ctx.APP),before);assert(!h.ids.get('adminManualDialog').open);
});


test('development lists migrate old user batches once, and a deleted migrated list never reappears',()=>{
 const h=harness(),c=h.ctx,s=c.APP,m=s.members[0];s.batches.push({id:'old-source',name:'2025年第二批',createdAt:'2025-10-01T00:00:00Z'});m._batchIds.push('old-source');delete s.developmentLists;delete s.developmentListsMigrated;
 c.DevelopmentLists.ensure(s);assert.equal(s.developmentLists.length,1);const id=s.developmentLists[0].id;assert.equal(s.developmentLists[0].year,'2025');assert.equal(s.developmentLists[0].memberIds[0],m._memberId);
 c.DevelopmentLists.remove(s,id);c.DevelopmentLists.ensure(s);assert.equal(s.developmentLists.length,0);assert.equal(s.members.length,1);assert(s.batches.some(b=>b.id==='old-source'));
});

test('list create, edit, copy and delete retain personnel, scoring and frozen results',()=>{
 const h=harness(),c=h.ctx,s=c.APP,m=s.members[0],before=JSON.stringify(s.members),rules=JSON.stringify(s.rules);s.screeningHistory=[{id:'frozen',rows:[{memberId:m._memberId,total:3}]}];const history=JSON.stringify(s.screeningHistory);
 const a=c.DevelopmentLists.create(s,{year:'2026',name:'2026年第一批发展对象',memberIds:[m._memberId,m._memberId]});assert.equal(a.memberIds.length,1);
 const b=c.DevelopmentLists.create(s,{year:'2027',name:'2027年第一批发展对象',memberIds:a.memberIds.slice()});s.screeningDraft.selectedIds=[];c.DevelopmentLists.sync(s);assert.equal(b.memberIds.length,0);assert.equal(a.memberIds.length,1);
 c.DevelopmentLists.remove(s,b.id);assert.equal(s.screeningDraft.selectedIds.length,0);assert.equal(s.screeningDraft.listId,'');assert.equal(JSON.stringify(s.members),before);assert.equal(JSON.stringify(s.rules),rules);assert.equal(JSON.stringify(s.screeningHistory),history);
 c.DevelopmentLists.select(s,a.id);assert.equal(s.screeningDraft.selectedIds[0],m._memberId);
});

test('development list validates year and duplicate names without losing the active selection',()=>{
 const h=harness(),c=h.ctx,s=c.APP;c.DevelopmentLists.create(s,{year:'2026',name:'第二批',memberIds:[s.members[0]._memberId]});const before=JSON.stringify(s);
 assert.throws(()=>c.DevelopmentLists.create(s,{year:'2026',name:'第二批'}),/同名/);assert.throws(()=>c.DevelopmentLists.create(s,{year:'26',name:'第三批'}),/四位/);assert.equal(JSON.stringify(s),before);
});

test('roster opens with all members, supports class filtering, and saves checked people as a named annual list',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.members.push({'姓名':'虚构新增同学','班级':'B班','学号':'002'});c.BatchCore.ensure(c.APP);c.AdminWorkspace.navigate('screening');
 const picks=()=>h.ids.get('workflowView').children.filter(e=>e.dataset.pick);assert.equal(picks().length,2);
 h.ids.get('workflowClass').value='B班';h.ids.get('workflowClass').onchange();assert.equal(picks().length,1);picks()[0].checked=true;picks()[0].onchange();
 h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='create-batch').click();h.ids.get('newBatchName').value='2026年第二批发展对象';h.ids.get('developmentYear').value='2026';h.ids.get('confirmNewBatch').click();assert.equal(c.APP.developmentLists.length,1);assert.equal(c.APP.developmentLists[0].memberIds.length,1);
 c.AdminWorkspace.navigate('members');c.AdminWorkspace.navigate('screening');assert.equal(picks().length,2);assert.equal(h.ids.get('workflowClass').value,'');assert.match(h.ids.get('workflowView').innerHTML,/2026年第二批发展对象/);
});

test('roster membership autosaves and reused recent lists are independent copies',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.members.push({'姓名':'虚构乙','班级':'B班','学号':'002'});c.BatchCore.ensure(c.APP);c.APP.screeningDraft.selectedIds=[c.APP.members[0]._memberId];const original=c.DevelopmentLists.create(c.APP,{year:'2026',name:'原名单'});c.AdminWorkspace.navigate('screening');
 h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='manage-lists').click();h.ids.get('workflowDialogBody').children.find(e=>e.dataset.copyList===original.id).click();h.ids.get('newBatchName').value='新名单';h.ids.get('developmentYear').value='2027';h.ids.get('confirmNewBatch').click();const copy=c.DevelopmentLists.current(c.APP);assert.notEqual(copy.id,original.id);const cb=h.ids.get('workflowView').children.find(e=>e.dataset.pick===c.APP.members[1]._memberId);cb.checked=true;cb.onchange();assert.equal(copy.memberIds.length,2);assert.equal(original.memberIds.length,1);
});

test('delete and rename list UI do not delete people or saved scoring results and changes are audited',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.screeningDraft.selectedIds=[c.APP.members[0]._memberId];const list=c.DevelopmentLists.create(c.APP,{year:'2026',name:'需要修改的名单'});c.svNow();c.APP.screeningHistory=[{id:'frozen',rows:[]}];c.AdminWorkspace.navigate('screening');
 h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='manage-lists').click();h.ids.get('workflowDialogBody').children.find(e=>e.dataset.renameList===list.id).click();h.ids.get('renameListName').value='2026年第三批发展对象';h.ids.get('renameListYear').value='2026';h.ids.get('confirmRenameList').click();assert.equal(list.name,'2026年第三批发展对象');
 h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='manage-lists').click();h.ids.get('workflowDialogBody').children.find(e=>e.dataset.deleteList===list.id).click();h.ids.get('confirmDeleteList').click();assert.equal(c.APP.members.length,1);assert.equal(c.APP.screeningHistory.length,1);assert.equal(c.APP.developmentLists.length,0);assert.equal(c.APP.screeningDraft.selectedIds.length,0);assert(c.APP.auditLog.some(r=>r.action==='删除发展名单'));c.DevelopmentLists.ensure(c.APP);assert.equal(c.APP.developmentLists.length,0);
});

test('new imports show every member and never overwrite an existing named roster',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];const list=c.DevelopmentLists.create(c.APP,{year:'2026',name:'保留的名单',memberIds:[m._memberId]});c.AppWorkflow.previewImport([{'姓名':'新同学丙','班级':'C班','学号':'003'}],'新资料');h.ids.get('importBatchName').value='新资料导入记录';h.ids.get('commitWorkflowImport').click();
 assert.equal(list.memberIds.length,1);assert.equal(list.memberIds[0],m._memberId);assert.equal(c.APP.screeningDraft.listId,'');assert.equal(h.ids.get('workflowView').children.filter(e=>e.dataset.pick).length,2);assert.equal(h.ids.get('workflowBatch').value,'');
});


test('selecting a saved roster immediately shows its members and resets unrelated filters',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.members.push({'姓名':'不在名单的虚构乙','班级':'B班','学号':'002'});c.BatchCore.ensure(c.APP);const list=c.DevelopmentLists.create(c.APP,{year:'2026',name:'当前核对名单',memberIds:[c.APP.members[0]._memberId]});c.AdminWorkspace.navigate('screening');h.ids.get('workflowClass').value='B班';h.ids.get('workflowClass').onchange();
 h.ids.get('developmentListSelect').value=list.id;h.ids.get('developmentListSelect').onchange();assert.equal(h.ids.get('workflowClass').value,'');const picks=h.ids.get('workflowView').children.filter(e=>e.dataset.pick);assert.equal(picks.length,1);assert.equal(picks[0].dataset.pick,c.APP.members[0]._memberId);assert(!h.ids.get('workflowView').innerHTML.includes('rosterLibrary'));
 h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='reset-filters').click();assert.equal(h.ids.get('workflowView').children.filter(e=>e.dataset.pick).length,2);
});

test('deleting a list requires the popover confirmation and cancelling leaves all data intact',()=>{
 const h=harness({workspace:true}),c=h.ctx;const list=c.DevelopmentLists.create(c.APP,{year:'2026',name:'测试删除气泡',memberIds:[c.APP.members[0]._memberId]});c.AdminWorkspace.navigate('screening');h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='manage-lists').click();
 const button=h.ids.get('workflowDialogBody').children.find(e=>e.dataset.deleteList===list.id);button.click();assert.equal(c.APP.developmentLists.length,1);assert(h.ids.get('listDeleteConfirm').popoverOpen);h.ids.get('cancelDeleteList').click();assert.equal(c.APP.developmentLists.length,1);assert(!h.ids.get('listDeleteConfirm').popoverOpen);
 button.click();h.ids.get('confirmDeleteList').click();assert.equal(c.APP.developmentLists.length,0);assert.equal(c.APP.members.length,1);
});

test('score snapshots use the confirmed continuous activist scope without requiring a cutoff date',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.screeningDraft.selectedIds=[c.APP.members[0]._memberId];c.AdminWorkspace.navigate('screening');
 saveRoster(h);assert.equal(c.APP.screeningHistory.length,1);assert.equal(c.APP.screeningHistory[0].period,c.BatchCore.MATERIAL_SCOPE);assert.deepEqual(h.alerts,[]);assert.match(h.ids.get('workflowView').innerHTML,/持续累计/);assert.equal(c.APP.screeningHistory[0].period,c.BatchCore.MATERIAL_SCOPE);
});


test('import preview shows similar old and new materials and blocks scoring until the administrator resolves the pair',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0],field='参与学校、学院的活动（请罗列）';m[field]='2025年10月1日｜学院迎新活动';m._ok=null;c.svNow();
 c.AppWorkflow.previewImport([{'姓名':m['姓名'],'班级':m['班级'],'学号':'001',[field]:'参加学院迎新活动'}],'完整重填');h.ids.get('importBatchName').value='第二批补充';h.ids.get('workflowDialogBody').children.find(e=>e.dataset.materialOpen).click();assert.match(h.ids.get('materialReviewBody').innerHTML,/原有材料/);assert.match(h.ids.get('materialReviewBody').innerHTML,/本次填写/);h.ids.get('commitWorkflowImport').click();assert.equal(c.APP.members.length,1);assert.match(h.alerts[0],/疑似重复/);
 h.ids.get('materialSame').click();h.ids.get('commitWorkflowImport').click();assert.equal(c.APP.members[0][field],'2025年10月1日｜学院迎新活动');
});

test('repeated full-history upload does not inflate real scores and preserves previously confirmed manual scoring',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0],field='参与学校、学院的活动（请罗列）';m[field]='2025年10月1日｜党课学习';m._ok=null;c.classifyMember(m);m._cl.pt[0][0].score=7;m._cl.pt[0][0].auto=false;c.svNow();
 c.AppWorkflow.previewImport([{'姓名':m['姓名'],'班级':m['班级'],'学号':'001',[field]:'1. 2025/10/01 党课学习；2026年3月1日｜党课学习'}],'完整材料');h.ids.get('importBatchName').value='第二轮';h.ids.get('commitWorkflowImport').click();const updated=c.APP.members[0];c.classifyMember(updated);assert.equal(updated._cl.pt[0].length,2);assert.equal(c.calc(updated,false).ptT,12);
});


test('saved summary cards keep first-list scores frozen after second-list data changes and expose both view modes',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];m['学习成绩排名']='1/40';m._ok=null;c.APP.screeningDraft.selectedIds=[m._memberId];saveRoster((c.AdminWorkspace.navigate('screening'),h));const first=c.APP.developmentLists[0],old=c.APP.screeningHistory[0],oldRows=JSON.stringify(old.rows);first.scoreMode='frozen';
 m['学习成绩排名']='30/40';m._ok=null;c.classifyMember(m);const second=c.DevelopmentLists.create(c.APP,{year:'2026',name:'第二批保存名单',memberIds:[m._memberId]});c.SavedScores.saveActive();assert.notEqual(c.APP.screeningHistory.at(-1).rows[0].total,old.rows[0].total);
 c.AdminWorkspace.navigate('summary');assert.equal(h.ids.get('viewSummary').children.filter(e=>e.dataset.scoreList).length,2);h.ids.get('viewSummary').children.find(e=>e.dataset.scoreList===first.id).click();assert.equal(c.SavedScores.currentSnapshot().id,old.id);assert.equal(JSON.stringify(old.rows),oldRows);assert.match(h.ids.get('viewSummary').innerHTML,/当时保存的分数/);
 h.ids.get('btnModeDetail').click();assert.match(h.ids.get('viewSummary').innerHTML,/学业成绩/);h.ids.get('btnModeSimple').click();h.ids.get('btnBackSummary').click();assert.equal(h.ids.get('viewSummary').children.filter(e=>e.dataset.scoreList).length,2);
});

test('choosing source list A then B accumulates people into the same new target and complete selection ignores all filters',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.members.push({'姓名':'虚构乙','班级':'B班','学号':'002'});c.BatchCore.ensure(c.APP);const a=c.DevelopmentLists.create(c.APP,{year:'2026',name:'人员来源甲',memberIds:[c.APP.members[0]._memberId]}),b=c.DevelopmentLists.create(c.APP,{year:'2026',name:'人员来源乙',memberIds:[c.APP.members[1]._memberId]});
 c.APP.screeningDraft={listId:'',selectedIds:[],name:'',period:''};c.AdminWorkspace.navigate('screening');
 function choose(id){h.ids.get('developmentListSelect').value=id;h.ids.get('developmentListSelect').onchange();const box=h.ids.get('workflowView').children.find(e=>e.dataset.pick);box.checked=true;box.onchange();}
 choose(a.id);choose(b.id);assert.equal(c.APP.screeningDraft.selectedIds.length,2);assert.equal(c.APP.screeningDraft.listId,'');assert.equal(a.memberIds.length,1);assert.equal(b.memberIds.length,1);
 h.ids.get('workflowView').children.find(e=>e.dataset.workflow==='show-selection').click();assert.equal(h.ids.get('workflowView').children.filter(e=>e.dataset.pick).length,2);assert.equal(h.ids.get('developmentListSelect').value,'');
 saveRoster(h);assert.equal(c.APP.developmentLists.length,3);assert.equal(c.APP.screeningHistory.at(-1).rows.length,2);assert.equal(c.APP.screeningHistory.at(-1).listId,c.APP.screeningDraft.listId);
});

test('personal view returns to the exact roster filter and scroll position',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.AdminWorkspace.navigate('screening');h.ids.get('workflowClass').value='A班';h.ids.get('workflowClass').onchange();h.ids.get('mainContent').scrollTop=180;assert.equal(c.AppWorkflow.capture().className,'A班');let restoredArg;const restore=c.AppWorkflow.restore;c.AppWorkflow.restore=function(x){restoredArg=x;restore(x);};
 h.ids.get('workflowView').children.find(e=>e.dataset.detail).click();assert.equal(c.AdminWorkspace.currentPage(),'members');assert(!h.ids.get('returnToRoster').classList.contains('hide'));h.ids.get('returnToRoster').click();assert.equal(c.AdminWorkspace.currentPage(),'screening');assert.equal(h.ids.get('workflowClass').value,'A班',JSON.stringify({restoredArg,current:c.AppWorkflow.capture()}));assert.equal(h.ids.get('mainContent').scrollTop,180);
});

test('personal member picker supports all people and a development-list scope without changing membership',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.members.push({'姓名':'虚构乙','班级':'B班','学号':'002'});c.BatchCore.ensure(c.APP);const list=c.DevelopmentLists.create(c.APP,{year:'2026',name:'只含乙的名单',memberIds:[c.APP.members[1]._memberId]});c.AdminWorkspace.navigate('members');h.ids.get('memberListScope').value=list.id;h.ids.get('memberListScope').onchange();assert.match(h.ids.get('memberListMeta').textContent,/显示 1 人/);assert.equal(list.memberIds.length,1);h.ids.get('memberListScope').value='';h.ids.get('memberListScope').onchange();assert.match(h.ids.get('memberListMeta').textContent,/显示 2 人/);
});

test('detail export does not download until its popover is confirmed and cancel leaves it untouched',()=>{
 const h=harness({workspace:true}),c=h.ctx;let downloads=0;c.XLSX={utils:{aoa_to_sheet(){return{};},book_new(){return{};},book_append_sheet(){}},writeFile(){downloads++;}};c.AdminWorkspace.navigate('members');h.ids.get('btnExportDetail').click();assert.equal(downloads,0);assert(h.ids.get('exportDetailConfirm').popoverOpen);h.ids.get('cancelDetailExport').click();assert.equal(downloads,0);h.ids.get('btnExportDetail').click();h.ids.get('confirmDetailExport').click();assert.equal(downloads,1);
});

test('many duplicate reviews are paged one at a time, with progress and unresolved items still blocking import',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0],field='参与学校、学院的活动（请罗列）';m[field]=Array.from({length:12},(_,i)=>'2025年10月'+(i+1)+'日｜学院实践交流活动第'+(i+1)+'场').join('\n');m._ok=null;c.svNow();
 c.AppWorkflow.previewImport([{'姓名':m['姓名'],'班级':m['班级'],'学号':'001',[field]:Array.from({length:12},(_,i)=>'参加学院实践交流活动第'+(i+1)+'场').join('；')}],'多项相似材料');h.ids.get('importBatchName').value='逐项核对';assert.equal(h.ids.get('workflowDialogBody').children.filter(e=>e.dataset.materialOpen).length,1);assert(!h.ids.get('workflowDialogBody').innerHTML.includes('material-review-panel'));h.ids.get('workflowDialogBody').children.find(e=>e.dataset.materialOpen).click();assert.match(h.ids.get('materialReviewBody').innerHTML,/第 1 [/] 12/);assert.equal(h.ids.get('materialReviewBody').children.filter(e=>e.attrs.id==='materialSame').length,1);h.ids.get('materialSame').click();assert.match(h.ids.get('materialReviewBody').innerHTML,/第 2 [/] 12/);h.ids.get('materialReviewClose').click();h.ids.get('commitWorkflowImport').click();assert.match(h.alerts.at(-1),/疑似重复/);h.ids.get('workflowDialogBody').children.find(e=>e.dataset.materialOpen).click();for(let i=0;i<12;i++)h.ids.get('materialSame').click();h.ids.get('commitWorkflowImport').click();assert.equal(c.APP.members[0][field].split('\n').length,12);
});


test('saved summary personal drilldown returns to the same frozen result while sidebar entry starts from cards',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.screeningDraft.selectedIds=[c.APP.members[0]._memberId];c.AdminWorkspace.navigate('screening');saveRoster(h);const snap=c.APP.screeningHistory[0];c.APP.developmentLists[0].scoreMode='frozen';c.AdminWorkspace.navigate('summary');h.ids.get('viewSummary').children.find(e=>e.dataset.scoreList).click();h.ids.get('viewSummary').children.find(e=>e.dataset.savedPerson).click();assert.equal(c.AdminWorkspace.currentPage(),'members');assert.match(h.ids.get('returnToRoster').textContent,/名单积分汇总/);h.ids.get('returnToRoster').click();assert.equal(c.SavedScores.currentSnapshot().id,snap.id);assert(h.ids.has('summaryTable'));
 c.AdminWorkspace.navigate('dashboard');c.AdminWorkspace.navigate('summary');assert(h.ids.get('viewSummary').children.some(e=>e.dataset.scoreList));
});

test('competition province stays six points after opening a scholarship editor; stale modal state cannot leak',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._cl.ac[5].push({raw:'国家奖学金',score:8,level:'国家奖学金',auto:false});m._cl.ac[3].push({raw:'2026年省级数学竞赛',score:6,level:'省级',auto:false});
 c.editItem('ac',5,0);c.closeModal();c._mergeOpts=[{}, {label:'国家奖学金',score:8}];c.editItem('ac',3,0);h.ids.get('eLv').value='1';h.ids.get('eLv').onchange();assert.equal(Number(h.ids.get('eScore').value),6);h.ids.get('eScore').value='8';h.ids.get('btnSaveItem').click();assert.equal(m._cl.ac[3][0].score,6);assert.equal(m._cl.ac[3][0].level,'省级');assert.equal(m._cl.ac[3][0].scoringType,'competition');
});
test('paper can be selected on add and edit and uses the same scoring as material review',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);c.openAddModal('ac',3);h.ids.get('eRaw').value='2026年普通期刊论文';h.ids.get('eType').value='paper';h.ids.get('eType').onchange();h.ids.get('eLv').value='1';h.ids.get('eLv').onchange();h.ids.get('btnSaveItem').click();var added=m._cl.ac[3][0];assert.equal(added.score,6);assert.equal(added.level,'省级');assert.equal(added.scoringType,'paper');
 m._unc.push({type:'award',raw:'2026年另一篇普通期刊论文',cl:{c:'ac',i:3,n:'学科竞赛',cf:.4}});c.quickFix(0);h.ids.get('fType').value='paper';h.ids.get('fType').onchange();h.ids.get('fLv').value='1';h.ids.get('btnFix').click();var reviewed=m._cl.ac[3][1];assert.equal(reviewed.score,added.score);assert.equal(reviewed.level,added.level);assert.equal(reviewed.scoringType,added.scoringType);
 c.editItem('ac',3,0);assert.equal(h.ids.get('eType').value,'paper');assert.equal(h.ids.get('eLv').value,'1');h.ids.get('btnSaveItem').click();c.reclassAll();c.classifyMember(m);assert.equal(m._cl.ac[3].filter(x=>x.scoringType==='paper').length,2);
});
test('every fixed option in every category saves exactly its declared score and label',()=>{
 const h=harness(),c=h.ctx;for(const cat of ['ac','pt','dc'])for(let si=0;si<(cat==='dc'?5:6);si++)for(const p of c.scoringProfiles(cat,si))for(const o of p.options){if(p.hours||o.max!=null)continue;let saved;c.openItemModal('测试',null,(raw,score,level,lk,f)=>{saved=f;},cat,si);h.ids.get('eRaw').value='虚构条目';h.ids.get('eType').value=p.id;h.ids.get('eType').onchange();h.ids.get('eLv').value=o.key;h.ids.get('eLv').onchange();h.ids.get('eScore').value='999';h.ids.get('btnSaveItem').click();assert(saved,cat+si+p.id+o.key);assert.equal(saved.score,o.score);assert.equal(saved.level,o.level);assert.equal(saved.scoringType,p.id);}
});
test('patent mappings follow the supplied plan: invention 8, utility 6, design and copyright 3',()=>{
 const h=harness(),c=h.ctx;for(const [raw,score,level]of [['2026年发明专利',8,'国家级'],['2026年实用新型专利',6,'省级'],['2026年外观设计专利',3,'校级/协会级'],['2026年软件著作权',3,'校级/协会级'],['2026年SCI论文',8,'国家级'],['2026年普通期刊论文',6,'省级']]){const result=c.caw(raw);assert.equal(result.pts,score,raw);assert.equal(result.l.n,level,raw);assert(result.scoringType==='paper'||result.scoringType==='patent');}
 const unknown=c.caw('2026年发表论文');assert(unknown.cf<.55);assert.equal(unknown.pts,0);assert.match(unknown.reviewReason,/确认/);
});
test('invalid legacy labels block save and are visibly flagged without changing old scores or snapshots',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);const item={raw:'2026年省级数学竞赛',score:8,level:'国家奖学金',auto:false};m._cl.ac[3].push(item);c.APP.screeningHistory=[{id:'historic',rows:[{total:8}]}];c.editItem('ac',3,0);assert.equal(h.ids.get('eLv').value,'');h.ids.get('btnSaveItem').click();assert.equal(item.score,8);assert.match(h.alerts[0],/请选择/);assert.match(c.buildCard('ac',3,'学科竞赛',[item],8),/需复核/);h.ids.get('eLv').value='1';h.ids.get('btnSaveItem').click();assert.equal(item.score,6);assert.equal(c.APP.screeningHistory[0].rows[0].total,8);
});
test('fixed score editor has one authority and ignores any forged numeric value or old optional label',()=>{
 const h=harness(),c=h.ctx;let saved;c.openItemModal('测试',null,(raw,score,level)=>saved={score,level},'ac',3);h.ids.get('eRaw').value='虚构竞赛';assert(!h.ids.get('modalBox').innerHTML.includes('eLvLabel'));h.ids.get('eLv').value='1';h.ids.get('eScore').value='100';h.ids.get('btnSaveItem').click();assert.equal(saved.score,6);assert.equal(saved.level,'省级');
});
test('position assessment enforces school, college and class bounds and multiple jobs count the maximum',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);c.openAddModal('ac',2);h.ids.get('eRaw').value='班长';h.ids.get('eLv').value='2';h.ids.get('eLv').onchange();h.ids.get('eScore').value='5';h.ids.get('btnSaveItem').click();assert.match(h.alerts[0],/0 至 3/);assert.equal(m._cl.ac[2].length,0);h.ids.get('eScore').value='3';h.ids.get('btnSaveItem').click();m._cl.ac[2].push({raw:'校级学生干部',score:5,auto:false});assert.equal(c.calc(m,false).ac[2],5);
});
test('volunteer decimal hours and all manual activity caps are enforced in the actual total',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);assert.equal(c.parseVolHours('12.5小时'),12.5);assert.equal(c.parseVolHours('2小时30分钟'),2.5);c.openAddModal('pt',1);h.ids.get('eRaw').value='累计志愿服务';h.ids.get('eScore').value='100';h.ids.get('btnSaveItem').click();assert.equal(m._cl.pt[1][0].score,8);assert.equal(m._cl.pt[1][0].hours,100);m._cl.pt[1].push({raw:'另加志愿条目',score:5});m._cl.pt[4]=Array.from({length:6},(_,i)=>({raw:'国际交流'+i,score:2}));m._cl.pt[2]=Array.from({length:8},(_,i)=>({raw:'线上党史学习'+i,score:1,scoringType:'red-online'})).concat([{raw:'线下参观纪念馆',score:3,scoringType:'red-offline'}]);const fin=c.calc(m,false);assert.equal(fin.pt[1],8);assert.equal(fin.pt[4],8);assert.equal(fin.pt[2],8);
});
test('batch custom scores survive reclassification without teaching the score to other records', () => {
 const h=harness(), c=h.ctx, m=c.APP.members[0];
 c.classifyMember(m);
 m._unc=['虚构活动甲','虚构活动乙'].map(raw=>({raw,cl:{c:'party',i:5,n:'同辈互助',cf:.4}}));
 c.render();
 h.ids.get('batchCat').value='pt-5';
 c.onBatchCatChange();
 h.ids.get('batchLevel').manualScore={points:'0.5',reason:'按本批活动核定'};
 for (const i of [0,1]) {
  const box=h.document.createElement('input');
  box.attrs.class='unc-cb';
  box.attrs['data-uidx']=String(i);
  box.checked=true;
 }
 c.batchFixHandler();
 assert.equal(m._unc.length,0);
 assert.equal(m._cl.pt[5].length,2);
 assert.equal(c.calc(m,false).pt[5],1);
 assert.equal(m._cl.pt[5][0].manualScore.ruleScore,2);
 assert.equal(m._cl.pt[5][0].manualScore.reason,'按本批活动核定');
 assert.equal(c.APP.learnedMap['虚构活动甲'],undefined);
 c.reclassAll();
 c.classifyMember(m);
 assert.equal(c.calc(m,false).pt[5],1);
 c.editItem('pt',5,0);
 assert.equal(h.ids.get('eManualPoints').value,'0.5');
 h.ids.get('eManualPoints').value='';
 h.ids.get('btnSaveItem').click();
 assert.equal(m._cl.pt[5][0].score,2);
 assert.equal(m._cl.pt[5][0].manualScore,undefined);
});
test('batch review uses the same paper mapping and retains type, level and score',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._unc=[{raw:'虚构普通期刊论文',cl:{c:'ac',i:3,n:'学科竞赛',cf:.4}}];c.render();h.ids.get('batchCat').value='ac-3';c.onBatchCatChange();const lv=h.ids.get('batchLevel'),at=lv._scoringChoices.findIndex(x=>x.profile.id==='paper'&&x.option.key==='1');lv.value=String(at);h.ids.get('ulUncertain');const box=h.document.createElement('input');box.attrs.class='unc-cb';box.attrs['data-uidx']='0';box.checked=true;c.batchFixHandler();assert.equal(m._cl.ac[3][0].score,6);assert.equal(m._cl.ac[3][0].scoringType,'paper');assert.equal(m._cl.ac[3][0].level,'省级');
});
test('moving competition to scholarship asks for new category scoring rather than carrying the old six points',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._cl.ac[3].push({raw:'误归类的奖学金',score:6,level:'省级',auto:false});c.moveItem('ac',3,0);h.ids.get('mvCat').value='ac-5';h.ids.get('btnMoveConfirm').click();h.ids.get('eType').value='scholarship';h.ids.get('eType').onchange();h.ids.get('eLv').value='0';h.ids.get('btnSaveItem').click();assert.equal(m._cl.ac[3].length,0);assert.equal(m._cl.ac[5][0].score,8);assert.equal(m._cl.ac[5][0].level,'国家奖学金');
});
test('known shipped defaults migrate once while custom values and historical rule snapshots are preserved',()=>{
 const h=harness(),c=h.ctx,state={rules:JSON.parse(JSON.stringify(c.DEF)),screeningHistory:[{rules:{socialWork:{'班长/团支书':5}},rows:[{total:99}]}]};Object.assign(state.rules.socialWork,{'校级主席/部长':8,'校级副主席/副部长':4,'院级主席/部长':6,'班长/团支书':5,'副班长':4});state.rules.volunteer={rate:.5,cap:10};state.rules.discipline={fail:-3,warning:-5,severeWarning:-10,demerit:-20};c.normalizeScoringRules(state);assert.equal(state.rules.socialWork['班长/团支书'],3);assert.equal(state.rules.socialWork['校级副主席/副部长'],4);assert.equal(state.rules.discipline.warning,-10);assert.equal(state.rules.volunteer.rate,.25);assert.equal(state.screeningHistory[0].rules.socialWork['班长/团支书'],5);assert.equal(state.screeningHistory[0].rows[0].total,99);state.rules.socialWork['班长/团支书']=2;c.normalizeScoringRules(state);assert.equal(state.rules.socialWork['班长/团支书'],2);
});
test('discipline deductions use minus five, ten and twenty; bare yes/no requires review',()=>{
 const h=harness(),c=h.ctx;assert.deepEqual(Array.from(c.scoringProfiles('dc',4)[0].options,o=>o.score),[-5,-10,-20]);const m={'姓名':'虚构违纪同学','是否违纪':'是'};c.classifyMember(m);assert.equal(m._cl.dc.flat().length,0);assert(m._unc.some(u=>u.type==='discipline'));
});
test('a renamed manual material survives reclassification without resurrecting its old source',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];m['获奖情况']='2026年省级数学竞赛';c.classifyMember(m);c.editItem('ac',3,0);h.ids.get('eRaw').value='2026年省级数学竞赛（已核实）';h.ids.get('btnSaveItem').click();c.reclassAll();c.classifyMember(m);assert.equal(m._cl.ac[3].length,1);assert.match(m._cl.ac[3][0].raw,/已核实/);assert.equal(m._cl.ac[3][0].score,6);
});
test('same event takes the highest award while different years, dates and editions keep independent scores',()=>{
 const h=harness(),c=h.ctx;const entries=[{raw:'2026年数学竞赛省级二等奖',score:6},{raw:'2026年数学竞赛国家级一等奖',score:8},{raw:'2025年数学竞赛省级二等奖',score:6},{raw:'2026年第二届数学竞赛省级二等奖',score:6}];assert.equal(c.highestAwardTotal(entries),20);assert.equal(c.highestAwardTotal([{raw:'2026年5月1日竞赛省级一等奖',score:6},{raw:'2026年6月1日竞赛省级一等奖',score:6}]),12);
});
test('online red study is identified separately from in-person events at import',()=>{
 const h=harness(),c=h.ctx;const online=c.ca('2026年线上党史读物学习');assert.equal(online.p,1);assert.equal(online.scoringType,'red-online');assert.equal(c.ca('2026年参观红色纪念馆').p,3);
});

test('date-pipe records separated by spaces or tabs become separate awards with independent classes and scores',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];m['获奖情况']='2025年|虚构计算机竞赛|省级|三等奖                     2025年|虚构竞赛|国赛|三等奖\t\t2024-2025学年|学校奖学金|一等奖学金';c.classifyMember(m);assert.equal(c.sp(m['获奖情况']).length,3);assert.deepEqual(Array.from(m._cl.ac[3],d=>d.score),[6,8]);assert.equal(m._cl.ac[5].length,1);assert.equal(m._cl.ac[5][0].score,4);
});
test('one volunteer entry cannot swallow other activities on the same physical line',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];m['志愿总时长']='100小时';m['参与学校、学院的活动（请罗列）']='2025年5月|虚构歌唱汇演|参与                     2025年6月|虚构志愿服务|参与                         2026年10月|社团嘉年华|参与';c.classifyMember(m);assert.equal(m._cl.pt[5].length,2);assert.equal(m._cl.pt[1].filter(d=>d.scoringType==='volunteer-record').length,1);assert.equal(c.calc(m,false).pt[1],8);assert.equal(c.calc(m,false).pt[5],4);assert.match(c.buildCard('pt',1,'志愿服务',m._cl.pt[1],8),/不重复计分/);
});
test('reclassification recovers a cached joined manual entry without double counting or changing the frozen result',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];const raw='2025年|虚构省级竞赛|省级|三等奖                 2024-2025学年|学校奖学金|一等奖学金';m['获奖情况']=raw;c.classifyMember(m);m._cl.ac[3]=[];m._cl.ac[5]=[{raw,score:4,level:'校一等奖学金',auto:false}];m._recognitionVersion=14;m._ok=true;c.APP.screeningHistory=[{rows:[{total:4}]}];c.classifyMember(m);assert.equal(m._cl.ac[3].length,1);assert.equal(m._cl.ac[3][0].score,6);assert.equal(m._cl.ac[5].length,1);assert.equal(m._cl.ac[5][0].score,4);assert.equal(m._legacyJoinedItems.length,1);assert.equal(m._legacyJoinedItems[0].item.raw,raw);assert.equal(c.APP.screeningHistory[0].rows[0].total,4);c.reclassAll();c.classifyMember(m);assert.equal(m._legacyJoinedItems.length,1);assert.equal(m._cl.ac[3].length,1);assert.equal(m._cl.ac[5].length,1);
});
test('single manually corrected entries survive the joined-entry recovery unchanged',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];m['获奖情况']='2025年|虚构竞赛|省级|三等奖                    2024-2025学年|学校奖学金|一等奖学金';c.classifyMember(m);m._cl.ac[3][0].score=8;m._cl.ac[3][0].level='国家级';m._cl.ac[3][0].auto=false;m._recognitionVersion=14;c.classifyMember(m);assert.equal(m._cl.ac[3][0].score,8);assert(!m._legacyJoinedItems);assert.equal(m._cl.ac[5].length,1);
});
test('plain ranks are sent to review rather than vanishing, while rank fractions score normally',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];m['学习成绩排名']='10';m['综测排名']='1';c.classifyMember(m);assert.equal(m._unc.filter(u=>u.type==='rank').length,2);assert(m._unc.filter(u=>u.type==='rank').every(u=>/总人数/.test(u.cl.reviewReason)));m['学习成绩排名']='10/100';m['综测排名']='1/100';m._ok=false;c.classifyMember(m);assert.equal(m._unc.filter(u=>u.type==='rank').length,0);assert.equal(c.calc(m,false).ac[0],3);assert.equal(c.calc(m,false).ac[1],6);
});
test('long whitespace inside citations or descriptions does not invent records',()=>{
 const h=harness(),c=h.ctx;assert.equal(c.sp('2026年|普通期刊论文《虚构研究》  2025 年参考成果').length,1);assert.equal(c.sp('2025年5月|虚构活动|参与  工作人员协调现场').length,1);assert.equal(c.sp('2025年|虚构竞赛|省级|一等奖   2026年|虚构竞赛|省级|一等奖').length,2);
});
test('space-separated material and newline resubmission deduplicate identically before import',()=>{
 const h=harness(),c=h.ctx;const a='2025年|虚构竞赛|省级|三等奖                    2026年|虚构竞赛|省级|三等奖';const b='2025年|虚构竞赛|省级|三等奖\n2026年|虚构竞赛|省级|三等奖';const result=c.BatchCore.analyzeMaterialMerge(a,b);assert.equal(result.duplicates.length,2);assert.equal(result.possible.length,0);assert.equal(c.BatchCore.materialLines(result.text).length,2);
});
test('performances and departure ceremonies under practice project titles do not receive practice participation points',()=>{
 const h=harness(),c=h.ctx;assert.equal(c.ca('2025年6月|百千万出征仪式|参与').i,5);assert.equal(c.ca('2026年4月|双百行动五四汇演|参与').p,2);assert.equal(c.ca('2026年5月|双百行动支教实践|参与').i,3);assert.equal(c.ca('2026年5月|双百行动支教实践|参与').p,5);
});

test('every category card exposes full-material viewing, including an empty category',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._cl.ac[3].push({raw:'2026年省级虚构竞赛',score:6,level:'省级',auto:false});c.render();const buttons=h.ids.get('detailGrid').children.filter(e=>e.dataset.act==='view');assert(buttons.some(b=>b.dataset.cat==='ac'&&b.dataset.si==='3'));assert(buttons.some(b=>b.dataset.cat==='pt'&&b.dataset.si==='0'));buttons.find(b=>b.dataset.cat==='ac'&&b.dataset.si==='3').click();assert(h.ids.get('categoryDetailDrawer').open);assert.match(h.ids.get('categoryDetailDrawer').innerHTML,/2026年省级虚构竞赛/);h.ids.get('closeCategoryDetail').click();assert.equal(h.ids.get('categoryDetailDrawer').open,false);
});
test('drawer contains every complete record with line breaks and escaped source text, without a 100-character cutoff',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);const raw='2026年省级虚构竞赛：'+ '完整活动说明'.repeat(80)+'\n第二行原始内容<script>bad()</script>';m._cl.ac[3]=[{raw,score:6,level:'省级',auto:false},{raw:'第二项完整材料',score:8,level:'国家级',auto:false}];const before=JSON.stringify(m);c.openCategoryDrawer('ac',3,0);const drawer=h.ids.get('categoryDetailDrawer');assert.match(drawer.innerHTML,/第二项完整材料/);assert(drawer.innerHTML.includes(c.esc(raw)));assert(!drawer.innerHTML.includes('<script>bad()'));assert.match(drawer.innerHTML,/2 条记录/);assert.equal(JSON.stringify(m),before);h.ids.get('closeCategoryDetail').click();
});
test('editing from the drawer returns to that category with the newly saved full text and score',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._cl.ac[3]=[{raw:'2026年省级虚构竞赛',score:6,level:'省级',auto:false}];c.openCategoryDrawer('ac',3,0);h.ids.get('categoryDetailDrawer').children.find(b=>b.dataset.categoryEdit==='0').click();assert.equal(h.ids.get('categoryDetailDrawer').open,false);assert.equal(h.ids.get('modalBg').style.display,'flex');h.ids.get('eRaw').value='2026年核实后的虚构竞赛完整名称';h.ids.get('eLv').value='0';h.ids.get('btnSaveItem').click();assert.equal(h.ids.get('modalBg').style.display,'none');assert(h.ids.get('categoryDetailDrawer').open);assert.match(h.ids.get('categoryDetailDrawer').innerHTML,/核实后的虚构竞赛完整名称/);assert.match(h.ids.get('categoryDetailDrawer').innerHTML,/国家级/);assert.equal(m._cl.ac[3][0].score,8);
});
test('outside taps keep an edited form open; the visible cross respects keep-editing or discard choices',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._cl.ac[3]=[{raw:'原始虚构竞赛',score:6,level:'省级',auto:false}];c.editItem('ac',3,0);h.ids.get('eRaw').value='尚未保存的新描述';h.ids.get('modalBg').click();assert.equal(h.ids.get('modalBg').style.display,'flex');assert.equal(h.ids.get('eRaw').value,'尚未保存的新描述');const cross=h.ids.get('modalBox').querySelector('.modal-close');assert(cross);assert.equal(cross.getAttribute('aria-label'),'关闭弹窗');c.confirm=()=>false;cross.click();assert.equal(h.ids.get('modalBg').style.display,'flex');assert.equal(h.ids.get('eRaw').value,'尚未保存的新描述');c.confirm=()=>true;cross.click();assert.equal(h.ids.get('modalBg').style.display,'none');assert.equal(m._cl.ac[3][0].raw,'原始虚构竞赛');
});
test('unchanged forms close directly and successful saves do not display a discard prompt',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);m._cl.ac[3]=[{raw:'虚构竞赛',score:6,level:'省级',auto:false}];let prompts=0;c.confirm=()=>{prompts++;return false;};c.editItem('ac',3,0);assert.equal(c.closeModal(),true);assert.equal(prompts,0);c.editItem('ac',3,0);h.ids.get('eRaw').value='已核实虚构竞赛';h.ids.get('btnSaveItem').click();assert.equal(prompts,0);assert.equal(m._cl.ac[3][0].raw,'已核实虚构竞赛');assert.equal(h.ids.get('modalBg').style.display,'none');
});
test('empty categories can add from the drawer and return with the new material',()=>{
 const h=harness(),c=h.ctx,m=c.APP.members[0];c.classifyMember(m);c.openCategoryDrawer('pt',5);assert.match(h.ids.get('categoryDetailDrawer').innerHTML,/暂无材料/);h.ids.get('addCategoryDetail').click();h.ids.get('eRaw').value='2026年虚构迎新活动的完整名称';h.ids.get('btnSaveItem').click();assert(h.ids.get('categoryDetailDrawer').open);assert.match(h.ids.get('categoryDetailDrawer').innerHTML,/虚构迎新活动的完整名称/);assert.equal(m._cl.pt[5].length,1);
});
test('continuous review retains an unsaved draft when stop or skip is declined and does not advance an invalid submission',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];m['获奖情况']='虚构竞赛获奖';m._ok=false;c.classifyMember(m);c.AdminTools.startReview();assert.equal(m._unc.length,1);h.ids.get('btnFix').click();assert.equal(m._unc.length,1);assert.equal(h.ids.get('modalBg').style.display,'flex');h.ids.get('fLv').value='1';c.confirm=()=>false;h.ids.get('reviewStop').click();assert.equal(h.ids.get('modalBg').style.display,'flex');h.ids.get('reviewSkip').click();assert.equal(m._unc.length,1);h.ids.get('btnFix').click();assert.equal(m._unc.length,0);assert.equal(m._cl.ac[3][0].score,6);
});

test('AI reviewed materials pass through the real import preview and save only after its final confirm',()=>{
 const h=harness(),c=h.ctx;c.render();const before=JSON.stringify(c.APP),rows=[{'姓名':'AI虚构同学','班级':'AI虚构班','获奖情况':'2026年省级虚构竞赛'}];const job=c.AiImportPlan.create(c.APP,rows,{split:c.sp,profiles:c.scoringProfiles,issue:c.scoringIssue});job.sources[0].parts=[{raw:job.sources[0].text,target:'ac-3',type:'competition',option:'1',decision:'approved',score:999,reason:'管理员已核对省级'}];const review=c.AiImportPlan.finalize(job,c.APP);c.AppWorkflow.previewImport(review.rows,'虚构AI表',review);assert.equal(JSON.stringify(c.APP),before);h.ids.get('importBatchName').value='AI虚构导入';h.ids.get('commitWorkflowImport').click();assert.deepEqual(h.alerts,[]);const added=c.APP.members.find(m=>m['姓名']==='AI虚构同学');assert(added);c.classifyMember(added);assert.equal(added._cl.ac[3][0].score,6);assert.equal(added._cl.ac[3][0].auto,false);assert.equal(added._cl.ac[3][0].analysisSource,'deepseek');
});
test('pending AI material overrides an automatic guess and stays unscored in the real renderer',()=>{
 const h=harness(),c=h.ctx;c.render();const rows=[{'姓名':'AI待审同学','班级':'AI虚构班','获奖情况':'2026年省级虚构竞赛'}],job=c.AiImportPlan.create(c.APP,rows,{split:c.sp,profiles:c.scoringProfiles,issue:c.scoringIssue});job.sources[0].parts=[{raw:job.sources[0].text,target:'ac-3',type:'competition',option:'1',decision:'pending',reason:'尚未核对佐证'}];const review=c.AiImportPlan.finalize(job,c.APP);c.AppWorkflow.previewImport(review.rows,'虚构待审表',review);h.ids.get('importBatchName').value='AI待审导入';h.ids.get('commitWorkflowImport').click();const m=c.APP.members.find(m=>m['姓名']==='AI待审同学');c.classifyMember(m);assert.equal(m._cl.ac[3].length,0);assert(m._unc.some(u=>u.type==='ai-review'));assert.equal(c.calc(m,false).ac[3],0);
});
test('cancelling the AI import preview or rejecting inconsistent choices never replaces the live APP',()=>{
 const h=harness(),c=h.ctx;c.render();const before=JSON.stringify(c.APP),rows=[{'姓名':'AI虚构同学','班级':'AI虚构班','获奖情况':'2026年省级虚构竞赛'}],job=c.AiImportPlan.create(c.APP,rows,{split:c.sp,profiles:c.scoringProfiles,issue:c.scoringIssue});job.sources[0].parts=[{raw:job.sources[0].text,target:'ac-3',type:'competition',option:'1',decision:'approved'}];const review=c.AiImportPlan.finalize(job,c.APP);c.AppWorkflow.previewImport(review.rows,'虚构AI表',review);h.ids.get('cancelWorkflowImport').click();assert.equal(JSON.stringify(c.APP),before);review.decisions[0].option='999';c.AppWorkflow.previewImport(review.rows,'虚构AI表',review);h.ids.get('importBatchName').value='不可保存';h.ids.get('commitWorkflowImport').click();assert.match(h.alerts[0],/请选择/);assert.equal(JSON.stringify(c.APP),before);
});
test('changing rules after AI preview blocks final commit without adding anyone',()=>{
 const h=harness(),c=h.ctx;c.render();const rows=[{'姓名':'AI虚构同学','班级':'AI虚构班','获奖情况':'2026年省级虚构竞赛'}],job=c.AiImportPlan.create(c.APP,rows,{split:c.sp,profiles:c.scoringProfiles,issue:c.scoringIssue});job.sources[0].parts=[{raw:job.sources[0].text,target:'ac-3',type:'competition',option:'1',decision:'approved'}];const review=c.AiImportPlan.finalize(job,c.APP);c.AppWorkflow.previewImport(review.rows,'虚构AI表',review);c.APP.rules.levelAward['学科竞赛'].sc[1]=5;h.ids.get('importBatchName').value='过期规则';h.ids.get('commitWorkflowImport').click();assert.equal(c.APP.members.length,1);assert.match(h.alerts[0],/变化/);
});
test('responsive phone menu and member back navigation preserve personnel and scoring state',()=>{
 const h=harness({workspace:true}),c=h.ctx,before=JSON.stringify(c.APP);c.innerWidth=390;c.ResponsiveLayout.apply();const nav=h.ids.get('workspaceNavToggle');assert.equal(nav.textContent,'☰');nav.click();assert(c.document.body.classList.contains('mobile-menu-open'));nav.click();assert(!c.document.body.classList.contains('mobile-menu-open'));c.ResponsiveLayout.showPerson(true);assert(c.document.body.classList.contains('mobile-person-open'));h.ids.get('mobileBackPeople').click();assert(!c.document.body.classList.contains('mobile-person-open'));h.ids.get('mobileCurrentPerson').click();assert(c.document.body.classList.contains('mobile-person-open'));assert.equal(JSON.stringify(c.APP),before);c.innerWidth=1440;c.ResponsiveLayout.apply();assert.notEqual(nav.textContent,'☰');
});
test('responsive breakpoints keep phone navigation, tablet icons and desktop workspace separate',()=>{
 const p=harness({workspace:true}).ctx.ResponsiveLayout.policy;assert(p(390).phone&&p(390).menu&&p(390).compact);assert(!p(768).phone&&p(768).menu);assert(!p(1024).menu&&p(1024).compact);assert(!p(1440).compact);
});
test('recycled roster disappears from person filters and stale scope returns to all members',()=>{
 const h=harness({workspace:true}),c=h.ctx;c.APP.members.push({'姓名':'虚构新增乙','班级':'B班','学号':'002'});c.BatchCore.ensure(c.APP);const l=c.DevelopmentLists.create(c.APP,{year:'2026',name:'待隐藏名单',memberIds:[c.APP.members[0]._memberId]});c.AdminWorkspace.navigate('members');h.ids.get('memberListScope').value=l.id;h.ids.get('memberListScope').onchange();assert.match(h.ids.get('memberListMeta').textContent,/显示 1 人/);const before=c.APP.members.length;c.SavedScoresCore.recycle(c.APP,l,null);c.AdminWorkspace.navigate('members');assert.equal(h.ids.get('memberListScope').value,'');assert(!h.ids.get('memberListScope').innerHTML.includes(l.id));assert.match(h.ids.get('memberListMeta').textContent,/显示 2 人/);assert.equal(c.DevelopmentLists.ordered(c.APP).length,0);assert.equal(c.DevelopmentLists.ordered(c.APP,true).length,1);assert.equal(c.APP.members.length,before);c.AdminTools.openRecycle('summaries');h.ids.get('workspaceRecycle').children.find(b=>b.dataset.restoreSummary===l.id).click();c.AdminWorkspace.navigate('members');assert(h.ids.get('memberListScope').innerHTML.includes(l.id));assert.equal(c.APP.members.length,before);
});
test('unified recycle tabs restore summaries and people independently without thawing frozen results',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];c.APP.screeningDraft.selectedIds=[m._memberId];const l=c.DevelopmentLists.create(c.APP,{year:'2026',name:'冻结回收名单'});const s=c.SavedScores.saveActive();l.scoreMode='frozen';const frozen=JSON.stringify(s);c.SavedScoresCore.recycle(c.APP,l,null);c.AdminCore.archive(c.APP,m._memberId);c.AdminTools.openRecycle('summaries');assert(h.ids.get('recyclePeopleTab'));assert(h.ids.get('recycleSummariesTab'));h.ids.get('workspaceRecycle').children.find(b=>b.dataset.restoreSummary===l.id).click();assert.equal(c.APP.members.length,0);assert.equal(c.APP.recycleBin.length,1);assert.equal(l.scoreMode,'frozen');assert.equal(JSON.stringify(s),frozen);h.ids.get('recyclePeopleTab').click();h.ids.get('workspaceRecycle').children.find(b=>b.dataset.restorePerson).click();assert.equal(c.APP.members.length,1);assert.equal(c.APP.screeningDraft.selectedIds.length,0);assert.equal(l.memberIds.length,0);assert.equal(JSON.stringify(s),frozen);
});
test('unified recycle restores an archived historical summary without changing the associated live roster',()=>{
 const h=harness({workspace:true}),c=h.ctx,m=c.APP.members[0];c.APP.screeningDraft.selectedIds=[m._memberId];const l=c.DevelopmentLists.create(c.APP,{year:'2026',name:'保留当前名单'}),s=c.SavedScores.saveActive();s.id='older-snapshot';s.summaryKind='final';l.savedResultId='newer-id';c.SavedScoresCore.recycle(c.APP,null,s);c.svNow();const listBefore=JSON.stringify(l),rowsBefore=JSON.stringify(s.rows);c.AdminTools.openRecycle('summaries');const b=h.ids.get('workspaceRecycle').children.find(b=>b.dataset.restoreSummary===s.id);assert(b);assert.equal(b.dataset.summaryKind,'snapshot');b.click();assert(!s.summaryDeletedAt);assert.equal(JSON.stringify(l),listBefore);assert.equal(JSON.stringify(s.rows),rowsBefore);
});
