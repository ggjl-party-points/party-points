(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AiImportDrafts=api;})(typeof window!=='undefined'?window:this,function(){
'use strict';
function create(options){
 var storage=options.storage,prefix='pps_ai_draft_v1:'+String(options.owner)+':',known=new Map(),tail=Promise.resolve(),pending=0,lastError='';
 function validId(id){if(typeof id!=='string'||!/^[a-z0-9-]{1,90}$/i.test(id))throw Error('草稿标识无效。');return id;}
 function key(id){return prefix+validId(id);}
 function list(){var result=[];for(var i=0;i<storage.length;i++){var k=storage.key(i);if(!k||!k.startsWith(prefix))continue;try{var record=JSON.parse(storage.getItem(k));if(record&&record.format===1&&typeof record.iv==='string'&&typeof record.data==='string'&&record.id&&key(record.id)===k)result.push({id:record.id,savedAt:record.savedAt});}catch(e){}}return result.sort(function(a,b){return String(b.savedAt).localeCompare(String(a.savedAt));});}
 function save(job){
  var id=validId(job.draftId),snapshot=options.snapshot(job);pending++;
  var task=tail.catch(function(){}).then(async function(){var cryptKey=options.getKey();if(!cryptKey)throw Error('请先登录后保存核对草稿。');var k=key(id),before=storage.getItem(k);if(before&&known.get(id)!==before)throw Error('其他标签页已修改此草稿，请先关闭其他核对页后重新打开草稿。');var savedAt=new Date().toISOString(),encrypted=await options.encrypt(cryptKey,JSON.stringify({format:1,owner:options.owner,job:snapshot}));if(options.getKey()!==cryptKey)throw Error('登录状态已变化，草稿未保存。');if(storage.getItem(k)!==before)throw Error('其他标签页已修改此草稿，未覆盖。');var record=JSON.stringify({format:1,id:id,savedAt:savedAt,iv:encrypted.iv,data:encrypted.data});try{storage.setItem(k,record);}catch(e){throw Error('草稿保存失败：浏览器存储空间不足或不可用。请保持页面打开，勿刷新。');}known.set(id,record);lastError='';return{id:id,savedAt:savedAt};});
  tail=task;task.then(function(){pending--;},function(e){pending--;lastError=e.message;});return task;
 }
 async function load(id){await tail.catch(function(){});var raw=storage.getItem(key(id));if(!raw)throw Error('草稿不存在或已删除。');var r=JSON.parse(raw),cryptKey=options.getKey();if(!cryptKey)throw Error('请先登录后恢复草稿。');if(r.format!==1)throw Error('草稿版本不受支持。');var data;try{data=JSON.parse(await options.decrypt(cryptKey,r.iv,r.data));}catch(e){throw Error('无法解密草稿，请使用原管理员登录；草稿仍保留。');}if(data.format!==1||data.owner!==options.owner||!data.job||data.job.draftId!==id)throw Error('草稿身份或格式不匹配。');known.set(id,raw);return data.job;}
 async function remove(id){await tail.catch(function(){});var k=key(id),raw=storage.getItem(k);if(raw&&known.has(id)&&known.get(id)!==raw)throw Error('草稿已在其他标签页更新，请重新打开后删除。');storage.removeItem(k);known.delete(id);}
 return{save:save,load:load,list:list,remove:remove,flush:function(){return tail;},pending:function(){return pending;},error:function(){return lastError;}};
}
return{create:create};
});
