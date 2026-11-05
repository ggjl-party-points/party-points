(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BatchCore=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var AWARDS='获奖情况',ACTIVITIES='参与学校、学院的活动（请罗列）';
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function text(value){return value==null?'':String(value).normalize('NFKC').trim();}
  function id(prefix){return prefix+'_'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));}
  function studentId(m){return text(m['学号']);}
  function manualItems(m){
    if(!m._cl)return clone(m._manualItems||[]);
    var items=[];['ac','pt','dc'].forEach(function(cat){(m._cl[cat]||[]).forEach(function(arr,si){arr.forEach(function(item){if(item.auto===false)items.push({cat:cat,si:si,item:clone(item)});});});});return items;
  }
  function ensure(state){
    if(!state||!Array.isArray(state.members))throw new Error('人员数据格式不正确。');
    if(!Array.isArray(state.batches))state.batches=[];
    if(!Array.isArray(state.screeningHistory))state.screeningHistory=[];
    if(!state.screeningDraft||!Array.isArray(state.screeningDraft.selectedIds))state.screeningDraft={name:'',period:'',selectedIds:[]};
    var ids=new Set(),batchIds=new Set(state.batches.map(function(b){return b.id;}));
    state.members.forEach(function(m){
      if(!m._memberId||ids.has(m._memberId))m._memberId=id('person');ids.add(m._memberId);
      if(!Array.isArray(m._batchIds)||!m._batchIds.length)m._batchIds=['legacy'];
      m._batchIds=Array.from(new Set(m._batchIds));
      m._batchIds.forEach(function(b){if(!batchIds.has(b)){state.batches.push({id:b,name:b==='legacy'?'历史已录入人员':'原有批次',createdAt:null});batchIds.add(b);}});
    });
    state.screeningDraft.selectedIds=Array.from(new Set(state.screeningDraft.selectedIds.filter(function(mid){return ids.has(mid);})));state.workflowVersion=1;return state;
  }
  function normalizeRow(row){
    var clean={};Object.keys(row).forEach(function(key){var k=text(key).replace(/\r?\n/g,'');if(k===text(ACTIVITIES))k=ACTIVITIES;if(k===text('职位（班级/部门）'))k='职位（班级/部门）';if(!k||k[0]==='_'||['__proto__','constructor','prototype'].indexOf(k)>=0)return;clean[k]=row[key];});
    clean['姓名']=text(clean['姓名']||clean['名字']);clean['班级']=text(clean['班级']||clean['班别']);
    if(clean['学号']!=null&&clean['学号']!=='')clean['学号']=text(clean['学号']);
    delete clean['名字'];delete clean['班别'];return clean;
  }
  function signature(state){return JSON.stringify(state.members.map(function(m){var c={};Object.keys(m).sort().forEach(function(k){if(k[0]!=='_'||['_memberId','_batchIds','_updatedAt'].indexOf(k)>=0)c[k]=m[k];});c.manual=manualItems(m);return c;}));}
  function materialLines(v){return String(v||'').split(/[\r\n；;]+/).map(function(x){return x.trim();}).filter(function(x){return x&&!/^(无|暂无|-)$/.test(x);});}
  function cleanMaterial(v){
    return text(v).toLowerCase().replace(/^\s*(?:[（(]\d{1,2}[）)]\s*|\d{1,2}[、]\s*|\d{1,2}[.．](?:\s+|(?=[^\d]))|[一二三四五六七八九十]+[、]\s*)/,'');
  }
  function materialDate(v){var t=cleanMaterial(v),m=t.match(/(20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*日?/);if(m)return{year:m[1],month:String(+m[2]),day:String(+m[3]),raw:m[0]};m=t.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);if(m)return{year:m[1],month:String(+m[2]),day:'',raw:m[0]};m=t.match(/20\d{2}/);return m?{year:m[0],month:'',day:'',raw:m[0]}:{year:'',month:'',day:'',raw:''};}
  function materialKey(v){var t=cleanMaterial(v),dt=materialDate(t);if(dt.raw&&dt.day)t=t.replace(dt.raw,dt.year+'年'+dt.month+'月'+dt.day+'日');return t.replace(/[\s|｜,，。:：、！!？?（）()「」“”"'·]/g,'');}
  function materialName(v){var t=cleanMaterial(v),dt=materialDate(t);if(dt.raw)t=t.replace(dt.raw,'');return t.replace(/^(?:于|参加了?|参与了?)\s*/,'').replace(/^(?:参加了?|参与了?)\s*/,'').replace(/[\s|｜,，。:：、！!？?（）()「」“”"'·]/g,'').replace(/(?:活动)?(?:参与|参加)$/,'').replace(/活动$/,'');}
  function distance(a,b){var row=Array.from({length:b.length+1},function(_,i){return i;});for(var i=1;i<=a.length;i++){var prev=row[0];row[0]=i;for(var j=1;j<=b.length;j++){var keep=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=keep;}}return row[b.length];}
  function maybeSame(a,b){var stages=/国家级|全国赛|省赛|省级|市赛|市级|校赛|校级|院赛|院级|初赛|复赛|决赛/,levels=/一等奖|二等奖|三等奖|特等奖|金奖|银奖|铜奖/;var sa=String(a).match(stages),sb=String(b).match(stages),la=String(a).match(levels),lb=String(b).match(levels);if(sa&&sb&&sa[0]!==sb[0]||la&&lb&&la[0]!==lb[0])return false;var da=materialDate(a),db=materialDate(b);if(['year','month','day'].some(function(k){return da[k]&&db[k]&&da[k]!==db[k];}))return false;var x=materialName(a),y=materialName(b);if(Math.min(x.length,y.length)<4)return false;if(x===y)return true;if(Math.min(x.length,y.length)<7)return false;return 1-distance(x,y)/Math.max(x.length,y.length)>=.84;}
  function analyzeMaterialMerge(oldText,newText,decisions){
    var lines=[],seen=new Set(),duplicates=[],possible=[];
    materialLines(oldText).forEach(function(line){var key=materialKey(line);if(!seen.has(key)){seen.add(key);lines.push(line);}});
    materialLines(newText).forEach(function(line){var key=materialKey(line),same=lines.find(function(x){return materialKey(x)===key;});if(same){duplicates.push({existing:same,incoming:line});return;}
      var candidates=lines.filter(function(x){return maybeSame(x,line);});
      if(candidates.length){possible.push({existing:candidates.join('\n'),incoming:line,key:key});if(decisions&&decisions[key]==='same'){duplicates.push({existing:candidates[0],incoming:line});return;}}
      if(!seen.has(key)){seen.add(key);lines.push(line);}
    });
    return{text:lines.join('\n')||text(oldText)||text(newText),duplicates:duplicates,possible:possible};
  }
  function mergeLines(oldText,newText){return analyzeMaterialMerge(oldText,newText).text;}
  function materialValue(m,field){var alias=text(field);if(alias!==field&&m[alias])return mergeLines(m[field]||'',m[alias]);return m[field]||'';}
  function materialReviews(old,row){var result=[];[AWARDS,ACTIVITIES].forEach(function(field){if(row[field]==null||text(row[field])==='')return;var report=analyzeMaterialMerge(materialValue(old,field),row[field]);report.possible.forEach(function(p){result.push({field:field,key:p.key,existing:p.existing,incoming:p.incoming,decision:''});});});return result;}
  function mergeMember(old,row,reviews){
    var m=clone(old);m._manualItems=manualItems(old);
    Object.keys(row).forEach(function(k){if(k[0]==='_'||k==='序号'||k==='编号'||row[k]==null||text(row[k])==='')return;if(k===AWARDS||k===ACTIVITIES){var decisions={};(reviews||[]).filter(function(r){return r.field===k;}).forEach(function(r){decisions[r.key]=r.decision;});m[k]=analyzeMaterialMerge(materialValue(m,k),row[k],decisions).text;if(text(k)!==k)delete m[text(k)];}else m[k]=typeof row[k]==='string'?row[k].trim():row[k];});
    m._ok=null;m._cl=null;m._unc=null;return m;
  }
  function differences(old,row){var m=mergeMember(old,row),diff=[];Object.keys(row).forEach(function(k){if(k[0]==='_'||k==='序号'||k==='编号')return;if(text(old[k])!==text(m[k]))diff.push({field:k,before:old[k]==null?'':old[k],after:m[k]});});return diff;}
  function planImport(state,rows){
    ensure(state);var bySid=new Map(),byNameClass=new Map(),byName=new Map(),incomingSid=new Map(),incomingName=new Map();
    function add(map,key,value){if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(value);}
    state.members.forEach(function(m){add(bySid,studentId(m),m);add(byName,text(m['姓名']),m);add(byNameClass,text(m['姓名'])+'\u0000'+text(m['班级']),m);});
    var normalized=rows.map(normalizeRow),entries=[];
    normalized.forEach(function(r,i){if(r['姓名']===text('张三（填写示例，请删除或替换）'))return;add(incomingSid,studentId(r),i);add(incomingName,r['姓名']+'\u0000'+r['班级'],i);});
    normalized.forEach(function(r,i){
      if(r['姓名']===text('张三（填写示例，请删除或替换）'))return;
      if(!r['姓名']&&!r['班级']&&!studentId(r))return;
      var e={row:typeof rows[i].__rowNum__==='number'?rows[i].__rowNum__+1:i+2,data:r,status:'new',reason:'新增人员',targetId:null,changes:[]};
      function conflict(reason){e.status='conflict';e.reason=reason;entries.push(e);}
      if(!r['姓名']||!r['班级']){conflict('缺少姓名或班级，请补齐后重新导入。');return;}
      var sid=studentId(r),pair=r['姓名']+'\u0000'+r['班级'];
      var originalSid=rows[i]['学号'];
      if(typeof originalSid==='number'&&!Number.isSafeInteger(originalSid)){conflict('学号被Excel转成了不安全数字，请将学号设为文本后核对。');return;}
      if(sid&&/[eE][+-]?\d+$/.test(sid)){conflict('学号显示为科学计数法，请核对原始学号。');return;}
      if((sid&&incomingSid.get(sid).length>1)||incomingName.get(pair).length>1){conflict('本次表格存在重复学号或同名同班记录，请先核对。');return;}
      var exact=sid?bySid.get(sid)||[]:[],fallback=byNameClass.get(pair)||[],target=null;
      if(exact.length>1){conflict('已有人员中该学号不唯一，请先核对。');return;}
      if(exact.length===1){target=exact[0];if(text(target['姓名'])!==r['姓名']){conflict('学号已存在，但姓名不同，请核对身份。');return;}e.reason='学号匹配已有人员';}
      else if(fallback.length>1){conflict('姓名和班级匹配到多个人员，无法安全合并。');return;}
      else if(fallback.length===1){target=fallback[0];if(sid&&studentId(target)&&sid!==studentId(target)){conflict('同名同班人员已有另一个学号，请核对。');return;}e.reason='仅按姓名＋班级匹配，请核对身份';}
      if(!target&&(byName.get(r['姓名'])||[]).some(function(m){return !sid||!studentId(m);})){conflict('已有同名不同班人员，且缺少可核对的学号，请先核对身份。');return;}
      e.materialReview=materialReviews(target||{},r);e.materialDuplicates=[AWARDS,ACTIVITIES].reduce(function(n,k){return n+analyzeMaterialMerge(target?materialValue(target,k):'',r[k]||'').duplicates.length;},0);
      if(target){e.targetId=target._memberId;e.changes=differences(target,r);e.status=e.changes.length?'update':'unchanged';if(!e.changes.length)e.reason+='；材料未变化';}
      entries.push(e);
    });
    return{entries:entries,baseSignature:signature(state),counts:entries.reduce(function(c,e){c[e.status]++;return c;},{new:0,update:0,unchanged:0,conflict:0})};
  }
  function applyImport(state,plan,options){
    ensure(state);if(signature(state)!==plan.baseSignature)throw new Error('预览期间人员资料已变化，请重新预览后导入。');
    var usable=plan.entries.filter(function(e){return e.status!=='conflict';});if(!usable.length)throw new Error('没有可导入的有效记录。');
    if(plan.counts.conflict&&!options.skipConflicts)throw new Error('存在冲突，请明确确认跳过后再导入。');
    usable.forEach(function(e){if((e.materialReview||[]).some(function(r){return r.decision!=='same'&&r.decision!=='different';}))throw new Error('第'+e.row+'行有疑似重复材料，请先确认是否同一项活动或奖项。');});
    var batch,now=options.now||new Date().toISOString();
    if(options.batchId){batch=state.batches.find(function(b){return b.id===options.batchId;});if(!batch)throw new Error('所选批次不存在。');}
    else{var name=text(options.batchName);if(!name)throw new Error('请填写批次名称。');if(state.batches.some(function(b){return text(b.name)===name;}))throw new Error('已有同名批次，请选择已有批次或修改名称。');batch={id:id('batch'),name:name,createdAt:now};}
    var next=clone(state.members),imported=[];
    usable.forEach(function(e){
      var index=e.targetId?next.findIndex(function(m){return m._memberId===e.targetId;}):-1,m;
      if(e.targetId&&index<0)throw new Error('待更新人员已经不存在，请重新预览。');
      if(index>=0){m=mergeMember(next[index],e.data,e.materialReview);next[index]=m;}
      else{m=mergeMember({},e.data,e.materialReview);m._memberId=id('person');m._batchIds=[];m._ok=null;m._cl=null;m._unc=null;next.push(m);}
      m._batchIds=Array.from(new Set((m._batchIds||[]).concat(batch.id)));m._updatedAt=now;imported.push(m._memberId);
    });
    if(!options.batchId)state.batches.push(batch);state.members=next;
    state.screeningDraft.selectedIds=Array.from(new Set(imported));state.screeningDraft.name=batch.name+'汇总筛选';state.screeningDraft.period=options.period||'';
    return{batch:batch,memberIds:state.screeningDraft.selectedIds.slice(),counts:clone(plan.counts)};
  }
  function batchNames(state,m){return(m._batchIds||[]).map(function(bid){var b=state.batches.find(function(b){return b.id===bid;});return b?b.name:'未知批次';}).join('、');}
  function rankRows(rows){
    rows.sort(function(a,b){return b.total-a.total||a.name.localeCompare(b.name,'zh-CN')||a.memberId.localeCompare(b.memberId);});
    var last=null,rank=0,eligible=0;rows.forEach(function(r){eligible++;if(last!==r.total)rank=eligible;r.rank=rank;last=r.total;});return rows;
  }
  function scoreRows(state,score){
    ensure(state);return rankRows(state.members.map(function(m){var v=score(m);return{memberId:m._memberId,studentId:studentId(m),name:text(m['姓名']),className:text(m['班级']),batchIds:m._batchIds.slice(),batches:batchNames(state,m),updatedAt:m._updatedAt||null,acT:v.acT,ptT:v.ptT,dcT:v.dcT,ac:Array.isArray(v.ac)?v.ac.slice():[],pt:Array.isArray(v.pt)?v.pt.slice():[],dc:Array.isArray(v.dc)?v.dc.slice():[],total:v.t,uncertain:(m._unc||[]).length};}));
  }
  function selectedRows(state,rows){var selected=new Set(state.screeningDraft.selectedIds);return rankRows(clone(rows.filter(function(r){return selected.has(r.memberId);})));}
  function saveScreening(state,rows,options){
    ensure(state);var chosen=selectedRows(state,rows);if(!chosen.length)throw new Error('请先勾选本次参与筛选的人员。');
    if(!text(options.name)||!text(options.period))throw new Error('请填写筛选名称和统一统计口径。');
    if(chosen.some(function(r){return r.uncertain>0;})&&!options.allowPending)throw new Error('名单仍有待审核项，请确认保存为待审核结果。');
    var snapshot={id:id('screening'),name:text(options.name),period:text(options.period),createdAt:options.now||new Date().toISOString(),rows:chosen,rules:clone(state.rules),criteriaVersion:state.criteriaVersion||state.schemaVersion,coefficient:1,status:chosen.some(function(r){return r.uncertain>0;})?'待审核':'已留存'};
    state.screeningHistory.push(snapshot);state.screeningDraft.name=snapshot.name;state.screeningDraft.period=snapshot.period;return snapshot;
  }
  return{MATERIAL_SCOPE:'自各自确定为入党积极分子之日起持续累计',materialKey:materialKey,analyzeMaterialMerge:analyzeMaterialMerge,ensure:ensure,text:text,id:id,studentId:studentId,planImport:planImport,applyImport:applyImport,mergeLines:mergeLines,signature:signature,batchNames:batchNames,scoreRows:scoreRows,selectedRows:selectedRows,saveScreening:saveScreening,clone:clone,rankRows:rankRows};
});
