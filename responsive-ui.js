(function(){
 'use strict';
 function el(id){return document.getElementById(id);}
 function policy(width){return{compact:width<=1380,menu:width<=900,phone:width<=620};}
 function width(){return window.innerWidth||(document.documentElement&&document.documentElement.clientWidth)||1280;}
 var nav=el('workspaceNavToggle'),menu=el('topbarMoreMenu'),moves=[];
 ['scoringRulesLink','adminManualLink','btnWorkflow','btnExport'].forEach(function(id){
  var node=el(id);if(!node||!node.parentNode||!menu)return;
  var marker=document.createElement('span');marker.hidden=true;node.parentNode.insertBefore(marker,node);moves.push({node:node,marker:marker});
 });
 function person(open){document.body.classList.toggle('mobile-person-open',!!open);var main=el('mainContent');if(main)main.scrollTop=0;}
 var personHost=el('workspacePersonHost'),peopleHost=el('workspacePeopleHost');
 if(personHost&&peopleHost){
  var back=document.createElement('div');back.className='mobile-person-controls';back.innerHTML='<button class="btn" id="mobileBackPeople" type="button">← 返回成员列表</button>';personHost.insertBefore(back,personHost.firstChild);
  var forward=document.createElement('div');forward.className='mobile-person-controls';forward.innerHTML='<button class="btn" id="mobileCurrentPerson" type="button">查看当前成员 →</button>';peopleHost.insertBefore(forward,peopleHost.firstChild);
  if(el('mobileBackPeople'))el('mobileBackPeople').onclick=function(){person(false);};
  if(el('mobileCurrentPerson'))el('mobileCurrentPerson').onclick=function(){if(APP.members.length)person(true);};
 }
 if(el('memberList'))el('memberList').addEventListener('click',function(e){if(policy(width()).phone&&e.target.closest('[data-mi]'))person(true);},true);
 if(nav)nav.addEventListener('click',function(e){if(!policy(width()).menu)return;e.stopImmediatePropagation();var open=!document.body.classList.contains('mobile-menu-open');document.body.classList.toggle('mobile-menu-open',open);nav.setAttribute('aria-expanded',String(open));},true);
 document.addEventListener('click',function(e){if(policy(width()).phone&&e.target.closest('[data-review-member]'))person(true);var link=e.target.closest('[data-workspace]');if(!link)return;document.body.classList.remove('mobile-menu-open');if(nav&&policy(width()).menu)nav.setAttribute('aria-expanded','false');if(link.dataset.workspace==='members')person(false);},true);
 if(window.AdminWorkspace){var previousNavigate=AdminWorkspace.navigate;AdminWorkspace.navigate=function(page){previousNavigate(page);if(page==='members'&&policy(width()).phone)person(true);};}
 if(window.RosterNavigation){var previous=RosterNavigation.openMember;RosterNavigation.openMember=function(mid,from){previous(mid,from);if(policy(width()).phone)person(true);};}
 function apply(){
  var p=policy(width());
  moves.forEach(function(m){if(p.compact){if(m.node.parentNode!==menu)menu.appendChild(m.node);}else if(m.marker.parentNode)m.marker.parentNode.insertBefore(m.node,m.marker);});
  if(nav){if(p.menu){nav.textContent='☰';nav.setAttribute('aria-label','展开或收起导航菜单');nav.setAttribute('aria-expanded',String(document.body.classList.contains('mobile-menu-open')));}else{document.body.classList.remove('mobile-menu-open');nav.textContent=document.body.classList.contains('workspace-nav-collapsed')?'›':'‹';nav.setAttribute('aria-label',document.body.classList.contains('workspace-nav-collapsed')?'展开导航':'收起导航');nav.setAttribute('aria-expanded',String(!document.body.classList.contains('workspace-nav-collapsed')));}}
 }
 window.addEventListener('resize',apply);apply();
 window.ResponsiveLayout={policy:policy,apply:apply,showPerson:person};
})();
