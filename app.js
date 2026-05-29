const data = window.FAULT_DATA || [];
const $ = (id)=>document.getElementById(id);
const state = { q:'', system:'', warranty:'', location:'', tag:'' };
function uniq(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'zh-Hans-CN'))}
function countBy(arr, keyFn){const m=new Map();arr.forEach(x=>{const k=keyFn(x)||'未填写';m.set(k,(m.get(k)||0)+1)});return [...m.entries()].sort((a,b)=>b[1]-a[1])}
function fillSelect(id, values){const el=$(id); values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)})}
function init(){
  $('totalCount').textContent = data.length;
  fillSelect('systemFilter', uniq(data.map(x=>x.system)));
  fillSelect('warrantyFilter', uniq(data.map(x=>x.warranty)));
  fillSelect('locationFilter', uniq(data.map(x=>x.location)).slice(0,300));
  fillSelect('tagFilter', uniq(data.flatMap(x=>x.tags||[])));
  $('q').addEventListener('input', e=>{state.q=e.target.value.trim().toLowerCase(); render()});
  $('systemFilter').addEventListener('change', e=>{state.system=e.target.value; render()});
  $('warrantyFilter').addEventListener('change', e=>{state.warranty=e.target.value; render()});
  $('locationFilter').addEventListener('change', e=>{state.location=e.target.value; render()});
  $('tagFilter').addEventListener('change', e=>{state.tag=e.target.value; render()});
  $('clearBtn').onclick=()=>{['q','systemFilter','warrantyFilter','locationFilter','tagFilter'].forEach(id=>$(id).value=''); Object.assign(state,{q:'',system:'',warranty:'',location:'',tag:''}); render()};
  $('exportBtn').onclick=()=>exportCsv(filterData());
  renderStats(); renderSide(); render();
}
function filterData(){return data.filter(x=>{
  const blob=[x.serviceNo,x.location,x.model,x.serialNo,x.deliveryDate,x.faultDate,x.hours,x.fault,x.solution,x.system,x.warranty,(x.tags||[]).join(' ')].join(' ').toLowerCase();
  return (!state.q || blob.includes(state.q)) && (!state.system || x.system===state.system) && (!state.warranty || x.warranty===state.warranty) && (!state.location || x.location===state.location) && (!state.tag || (x.tags||[]).includes(state.tag));
})}
function renderStats(){
  const systems=countBy(data,x=>x.system); const warranty=countBy(data,x=>x.warranty);
  const locations=uniq(data.map(x=>x.location)).length; const serials=uniq(data.map(x=>x.serialNo)).length;
  $('stats').innerHTML = `<div class="stat"><span>总记录</span><b>${data.length}</b></div><div class="stat"><span>故障系统</span><b>${systems.length}</b></div><div class="stat"><span>工作地点</span><b>${locations}</b></div><div class="stat"><span>整机编号</span><b>${serials}</b></div>`;
}
function renderSide(){
  const tagCounts=countBy(data.flatMap(x=>x.tags||[]),x=>x).slice(0,20);
  $('topTags').innerHTML=tagCounts.map(([k,v])=>`<div class="tagRow"><button data-tag="${escapeAttr(k)}">${k} · ${v}条</button></div>`).join('') || '<p>暂无标签</p>';
  $('topTags').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{$('tagFilter').value=btn.dataset.tag;state.tag=btn.dataset.tag;render()});
  const max=Math.max(...countBy(data,x=>x.system).map(x=>x[1]),1);
  $('systemBars').innerHTML=countBy(data,x=>x.system).slice(0,12).map(([k,v])=>`<div class="barRow"><b>${escapeHtml(k)}</b> <small>${v}</small><div class="barLine"><div class="barFill" style="width:${Math.round(v/max*100)}%"></div></div></div>`).join('');
}
function render(){
  const rows=filterData(); $('resultInfo').textContent=`当前显示 ${rows.length} / ${data.length} 条`;
  const box=$('results'); box.innerHTML='';
  if(!rows.length){box.innerHTML='<div class="empty">没有找到匹配记录，换一个关键词试试。</div>'; return}
  rows.slice(0,300).forEach(x=>box.appendChild(card(x)));
  if(rows.length>300){const div=document.createElement('div');div.className='empty';div.textContent=`结果较多，仅显示前 300 条。请继续输入关键词缩小范围。`;box.appendChild(div)}
}
function card(x){
  const tpl=$('cardTpl').content.cloneNode(true); const root=tpl.querySelector('.card');
  tpl.querySelector('.system').textContent=x.system||'未分类'; tpl.querySelector('.warranty').textContent=x.warranty||'未填写';
  tpl.querySelector('.fault').textContent=x.fault||'未填写故障描述';
  tpl.querySelector('.meta').innerHTML=`工作地点：${escapeHtml(x.location||'-')} ｜ 整机编号：${escapeHtml(x.serialNo||'-')} ｜ 故障时间：${escapeHtml(x.faultDate||'-')} ｜ 小时数：${escapeHtml(x.hours||'-')} ｜ 源表第${x.sourceRow}行`;
  tpl.querySelector('.solution').textContent=x.solution||'原表未填写处理方法。';
  tpl.querySelector('.tags').innerHTML=(x.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('');
  tpl.querySelector('.copyBtn').onclick=()=>navigator.clipboard.writeText(`故障：${x.fault}
处理方法：${x.solution}`).then(()=>alert('已复制故障和处理方案'));
  return root;
}
function exportCsv(rows){
  const headers=['序号','服务单号','工作地点','型号','整机编号','交机日期','故障时间','车辆小时数','故障描述','处理方法','故障系统','保内/保外','标签'];
  const body=rows.map(x=>[x.id,x.serviceNo,x.location,x.model,x.serialNo,x.deliveryDate,x.faultDate,x.hours,x.fault,x.solution,x.system,x.warranty,(x.tags||[]).join('|')]);
  const csv=[headers,...body].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('
');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='XDE130故障查询结果.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/'/g,'&#39;')}
init();
