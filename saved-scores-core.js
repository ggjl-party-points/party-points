(function(root){
 'use strict';
 function live(list){return !!list&&list.scoreMode==='live';}
 function recycle(state,list,snapshot){var now=new Date().toISOString();if(list)list.summaryDeletedAt=now;else if(snapshot)snapshot.summaryDeletedAt=now;}
 function restore(entry){delete entry.summaryDeletedAt;}
 function ordered(rows,key,direction){var sign=direction==='desc'?-1:1;return rows.slice().sort(function(a,b){var x=key.indexOf('.')>=0?value(a,key):a[key],y=key.indexOf('.')>=0?value(b,key):b[key];var emptyX=x==null||x==='',emptyY=y==null||y==='';if(emptyX||emptyY)return emptyX===emptyY?0:emptyX?1:-1;var n=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'zh-CN',{numeric:true});return sign*n||String(a.memberId||'').localeCompare(String(b.memberId||''));});}
 function value(row,key){var p=key.split('.');return row[p[0]]&&row[p[0]][Number(p[1])];}
 root.SavedScoresCore={isLive:live,recycle:recycle,restore:restore,ordered:ordered};
})(typeof window!=='undefined'?window:globalThis);
