const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../batch-core.js');
const Sync=require('../cloud-sync.js');
function state(members=[]){return Core.ensure({members,rules:{rank:{top5:6},acCap:40,ptCap:60},criteriaVersion:10});}
const person=(name='甲',sid='001',extra={})=>Object.assign({'姓名':name,'班级':'A班','学号':sid},extra);
const score=m=>({acT:10,ptT:20,dcT:0,t:30,veto:false});
test('legacy migration preserves existing scores and rules and provides stable ids',()=>{
 const s=state([person('甲','',{_cl:{ac:[[1]],pt:[],dc:[]}})]),rules=JSON.stringify(s.rules),before=s.members[0]._memberId;
 Core.ensure(s);assert.equal(s.members[0]._memberId,before);assert.deepEqual(s.members[0]._cl.ac,[[1]]);assert.equal(s.batches[0].id,'legacy');assert.equal(JSON.stringify(s.rules),rules);
});
test('preview does not change material, membership or selection',()=>{
 const s=state([person()]),before=JSON.stringify(s);Core.planImport(s,[person('乙','002')]);assert.equal(JSON.stringify(s),before);
});
test('same student id updates class and preserves one personnel archive',()=>{
 const s=state([person()]),p=Core.planImport(s,[person('甲','001',{'班级':'B班'})]);assert.equal(p.counts.update,1);
 const r=Core.applyImport(s,p,{batchName:'第二批'});assert.equal(s.members.length,1);assert.equal(s.members[0]['班级'],'B班');assert.equal(s.members[0]._batchIds.length,2);assert.equal(s.screeningDraft.selectedIds[0],r.memberIds[0]);
});
test('legacy exact name/class fallback supports filling a previously absent student id',()=>{
 const s=state([person('甲','')]),p=Core.planImport(s,[person()]);assert.match(p.entries[0].reason,/姓名/);Core.applyImport(s,p,{batchName:'第二批'});assert.equal(s.members.length,1);assert.equal(s.members[0]['学号'],'001');
});
test('same student id with different name is a conflict',()=>assert.equal(Core.planImport(state([person()]),[person('乙','001')]).counts.conflict,1));
test('same name/class with two different known ids is a conflict',()=>assert.equal(Core.planImport(state([person()]),[person('甲','002')]).counts.conflict,1));
test('a changed class without a verifiable student id is sent to identity review',()=>assert.equal(Core.planImport(state([person('甲','')]),[person('甲','',{'班级':'B班'})]).counts.conflict,1));
test('same-name students with distinct known ids and classes can coexist',()=>assert.equal(Core.planImport(state([person('甲','001')]),[person('甲','002',{'班级':'B班'})]).counts.new,1));
test('duplicate incoming student ids are both blocked',()=>assert.equal(Core.planImport(state(),[person('甲','001'),person('乙','001')]).counts.conflict,2));
test('duplicate incoming names/classes are blocked even without ids',()=>assert.equal(Core.planImport(state(),[person('甲',''),person('甲','')]).counts.conflict,2));
test('ambiguous existing name/class is not silently merged',()=>assert.equal(Core.planImport(state([person('甲',''),person('甲','')]),[person('甲','')]).counts.conflict,1));
test('missing required fields is a conflict and blank rows are skipped',()=>assert.equal(Core.planImport(state(),[{'姓名':'甲'},{},person('张三（填写示例，请删除或替换）','')]).entries.length,1));
test('scientific notation or unsafe numeric student ids are blocked',()=>{
 assert.equal(Core.planImport(state(),[person('甲','1.23E+17')]).counts.conflict,1);
 assert.equal(Core.planImport(state(),[person('甲',Number.MAX_SAFE_INTEGER+1)]).counts.conflict,1);
});
test('empty incoming values do not erase material and zero is retained',()=>{
 const s=state([person('甲','001',{'志愿总时长':8,'职位（班级/部门）':'班长'})]);
 Core.applyImport(s,Core.planImport(s,[person('甲','001',{'志愿总时长':0,'职位（班级/部门）':''})]),{batchName:'第二批'});
 assert.equal(s.members[0]['志愿总时长'],0);assert.equal(s.members[0]['职位（班级/部门）'],'班长');
});
test('award merge uses complete lines and retains different years and stages',()=>{
 const s=state([person('甲','001',{'获奖情况':'2024年大赛省赛一等奖\n2025年大赛校赛一等奖'})]);
 Core.applyImport(s,Core.planImport(s,[person('甲','001',{'获奖情况':'2024年大赛省赛一等奖；2025年大赛省赛一等奖'})]),{batchName:'第二批'});
 assert.equal(s.members[0]['获奖情况'].split('\n').length,3);
});
test('manual scores survive material import and derived caches are invalidated',()=>{
 const m=person('甲','001',{_cl:{ac:[[{raw:'人工确认',score:9,auto:false}]],pt:[],dc:[]}}),s=state([m]);
 Core.applyImport(s,Core.planImport(s,[person('甲','001',{'志愿总时长':9})]),{batchName:'第二批'});
 assert.equal(s.members[0]._manualItems[0].item.score,9);assert.equal(s.members[0]._cl,null);
});
test('stale import preview cannot be committed after a person changes',()=>{
 const s=state([person()]),p=Core.planImport(s,[person('乙','002')]);s.members[0]['班级']='已修改';assert.throws(()=>Core.applyImport(s,p,{batchName:'第二批'}),/预览/);
});
test('conflict skipping requires explicit consent and imports only valid records',()=>{
 const s=state([person()]),p=Core.planImport(s,[person('乙','001'),person('丙','003')]);
 assert.throws(()=>Core.applyImport(s,p,{batchName:'第二批'}),/冲突/);assert.equal(s.members.length,1);
 Core.applyImport(s,p,{batchName:'第二批',skipConflicts:true});assert.equal(s.members.length,2);assert.equal(s.members[0]['姓名'],'甲');
});
test('existing batch can be reused and rerunning an import does not duplicate a student',()=>{
 const s=state();const r=Core.applyImport(s,Core.planImport(s,[person()]),{batchName:'第二批'});
 Core.applyImport(s,Core.planImport(s,[person()]),{batchId:r.batch.id});assert.equal(s.members.length,1);assert.equal(s.members[0]._batchIds.length,1);
});
test('duplicate batch names are rejected before people are changed',()=>{
 const s=state([person()]),p=Core.planImport(s,[person('乙','002')]);assert.throws(()=>Core.applyImport(s,p,{batchName:'历史已录入人员'}),/同名/);assert.equal(s.members.length,1);
});
test('new imports select their participants without deleting old people',()=>{
 const s=state([person()]);Core.applyImport(s,Core.planImport(s,[person('乙','002')]),{batchName:'第二批'});assert.equal(s.members.length,2);assert.deepEqual(s.screeningDraft.selectedIds,[s.members[1]._memberId]);
});
test('new and old students can be selected together with tied ranking',()=>{
 const s=state([person(),person('乙','002'),person('丙','003')]);s.screeningDraft.selectedIds=s.members.slice(0,2).map(m=>m._memberId);
 const rows=Core.selectedRows(s,Core.scoreRows(s,score));assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.rank),[1,1]);
});
test('legacy veto flags do not exclude anyone from current rankings',()=>{
 const s=state([person(),person('乙','002')]);s.screeningDraft.selectedIds=s.members.map(m=>m._memberId);
 const rows=Core.selectedRows(s,Core.scoreRows(s,m=>({...score(m),veto:m['姓名']==='甲'})));assert(rows.every(r=>r.rank===1));assert(rows.every(r=>!('veto' in r)));
});
test('screening requires a name, statistical period and selected people',()=>{
 const s=state([person()]);assert.throws(()=>Core.saveScreening(s,Core.scoreRows(s,score),{name:'筛选',period:'本学年'}),/勾选/);
 s.screeningDraft.selectedIds=[s.members[0]._memberId];assert.throws(()=>Core.saveScreening(s,Core.scoreRows(s,score),{name:'筛选',period:''}),/统计口径/);
});
test('pending review requires explicit acknowledgment and stays marked in the snapshot',()=>{
 const s=state([person('甲','001',{_unc:[{raw:'不明确的材料'}]})]);s.screeningDraft.selectedIds=[s.members[0]._memberId];const rows=Core.scoreRows(s,score);
 assert.throws(()=>Core.saveScreening(s,rows,{name:'筛选',period:'本学年'}),/待审核/);
 const snap=Core.saveScreening(s,rows,{name:'筛选',period:'本学年',allowPending:true});assert.equal(snap.status,'待审核');assert.equal(snap.rows[0].uncertain,1);
});
test('historical result retains scores, people and rules after subsequent changes',()=>{
 const s=state([person()]);s.screeningDraft.selectedIds=[s.members[0]._memberId];const snap=Core.saveScreening(s,Core.scoreRows(s,score),{name:'筛选',period:'本学年'});
 s.members[0]['姓名']='已更名';s.rules.acCap=99;s.screeningDraft.selectedIds=[];assert.equal(snap.rows[0].name,'甲');assert.equal(snap.rows[0].total,30);assert.equal(snap.rules.acCap,40);
 const backup=JSON.parse(JSON.stringify(s));Core.ensure(backup);assert.equal(backup.screeningHistory[0].rows[0].total,30);
});
test('two writers from the same base cannot silently overwrite each other',async()=>{
 let document={_id:'one',key:'main_admin_account_v2',iv:'base',updatedAt:1},writes=0;
 const col={where(expected){return{async update(fields){if(!Object.entries(expected).every(([k,v])=>document[k]===v))return{updated:0};document={...document,...fields};writes++;return{updated:1};}};}};
 const a=Sync.create(),b=Sync.create();a.adopt(document);b.adopt(document);
 const results=await Promise.allSettled([a.write(col,{key:document.key,iv:'A',updatedAt:2}),b.write(col,{key:document.key,iv:'B',updatedAt:3})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected')[0].reason.code,'CLOUD_CONFLICT');assert.equal(writes,1);
});
test('subsequent writes use the returned revision, not the original base',async()=>{
 let document={_id:'one',key:'main_admin_account_v2',iv:'base',revision:5,updatedAt:1};
 const col={where(expected){return{async update(fields){assert.equal(expected.revision,document.revision);document={...document,...fields};return{updated:1};}};}};
 const sync=Sync.create();sync.adopt(document);await sync.write(col,{key:document.key,iv:'A',updatedAt:2});await sync.write(col,{key:document.key,iv:'B',updatedAt:3});assert.equal(document.revision,7);
});
test('database errors or ambiguous success never become a successful blind overwrite',async()=>{
 const sync=Sync.create();sync.adopt({_id:'one',key:'key',iv:'base'});
 await assert.rejects(sync.write({where(){return{async update(){return{code:'PERMISSION_DENIED',message:'no access'};}};}},{key:'key',iv:'new'}),/no access/);
 await assert.rejects(sync.write({where(){return{async update(){return{};}};}},{key:'key',iv:'new'}),e=>e.code==='CLOUD_CONFLICT');
 assert.equal(sync.getBase().iv,'base');
});
test('cloud writing without an adopted base is rejected',async()=>await assert.rejects(Sync.create().write({},{}),e=>e.code==='INVALID_BASE'));


test('continuous full-history resubmission merges old plus new material once even with numbering, whitespace and different date formats',()=>{
 const field='参与学校、学院的活动（请罗列）',s=state([person('甲','001',{[field]:'2025年10月1日｜理论学习\n2025年10月2日｜理论学习'})]);
 const p=Core.planImport(s,[person('甲','001',{[field]:'1. 2025/10/01 理论学习；2、2025-10-02｜理论学习；2026年3月1日｜理论学习'})]);assert.equal(p.entries[0].materialDuplicates,2);assert.equal(p.entries[0].materialReview.length,0);Core.applyImport(s,p,{batchName:'第二批累计补录'});assert.equal(s.members[0][field].split('\n').length,3);
 const again=Core.planImport(s,[person('甲','001',{[field]:'2026年3月1日｜理论学习；2025年10月1日｜理论学习；2025年10月2日｜理论学习'})]);Core.applyImport(s,again,{batchName:'再次完整填报'});assert.equal(s.members[0][field].split('\n').length,3);
});

test('same activity titles on different explicit dates or years are not merged or treated as ambiguous duplicates',()=>{
 const r=Core.analyzeMaterialMerge('2025年10月1日｜学院主题团日活动','2025年10月2日｜学院主题团日活动；2026年10月1日｜学院主题团日活动');assert.equal(r.text.split('\n').length,3);assert.equal(r.duplicates.length,0);assert.equal(r.possible.length,0);
});

test('similar material requires a deliberate same or different decision before any import mutation',()=>{
 const field='参与学校、学院的活动（请罗列）',s=state([person('甲','001',{[field]:'2025年10月1日｜学院迎新活动'})]),p=Core.planImport(s,[person('甲','001',{[field]:'参加学院迎新活动'})]),before=JSON.stringify(s);assert.equal(p.entries[0].materialReview.length,1);assert.throws(()=>Core.applyImport(s,p,{batchName:'补录'}),/疑似重复/);assert.equal(JSON.stringify(s),before);
 p.entries[0].materialReview[0].decision='same';Core.applyImport(s,p,{batchName:'补录'});assert.equal(s.members[0][field],'2025年10月1日｜学院迎新活动');
});

test('a confirmed different event is preserved instead of being silently discarded for a similar title',()=>{
 const field='参与学校、学院的活动（请罗列）',s=state([person('甲','001',{[field]:'2025年10月1日｜学院迎新活动'})]),p=Core.planImport(s,[person('甲','001',{[field]:'参加学院迎新活动'})]);p.entries[0].materialReview[0].decision='different';Core.applyImport(s,p,{batchName:'另一次活动'});assert.equal(s.members[0][field].split('\n').length,2);
});

test('supplement-only activities preserve all old material and a cumulative volunteer value replaces rather than adds',()=>{
 const field='参与学校、学院的活动（请罗列）',s=state([person('甲','001',{[field]:'2025年10月1日｜理论学习','志愿总时长':'10'})]);Core.applyImport(s,Core.planImport(s,[person('甲','001',{[field]:'2026年3月1日｜理论学习','志愿总时长':'15'})]),{batchName:'补新资料'});assert.equal(s.members[0][field].split('\n').length,2);assert.equal(s.members[0]['志愿总时长'],'15');
});

test('canonical material keys retain meaningful date, award stage and award class while ignoring punctuation and numbering',()=>{
 assert.equal(Core.materialKey('1. 2025/10/01｜理论学习'),Core.materialKey('2025年10月1日 理论学习'));
 assert.notEqual(Core.materialKey('2025年大赛省赛一等奖'),Core.materialKey('2025年大赛校赛一等奖'));
 assert.notEqual(Core.materialKey('2025年大赛省赛一等奖'),Core.materialKey('2026年大赛省赛一等奖'));
 assert.notEqual(Core.materialKey('2025年大赛省赛一等奖'),Core.materialKey('2025年大赛省赛二等奖'));
});


test('full-width and ASCII activity or position headings resolve to the same fields when importing',()=>{
 const s=state([person('甲','001',{'参与学校、学院的活动（请罗列）':'2025年10月1日｜党课学习'})]);const p=Core.planImport(s,[person('甲','001',{'参与学校、学院的活动(请罗列)':'2025/10/01｜党课学习','职位(班级/部门)':'学院学生会宣传部负责人'})]);assert.equal(p.entries[0].materialDuplicates,1);Core.applyImport(s,p,{batchName:'规范表头'});assert.equal(s.members[0]['参与学校、学院的活动（请罗列）'],'2025年10月1日｜党课学习');assert.equal(s.members[0]['职位（班级/部门）'],'学院学生会宣传部负责人');
});
