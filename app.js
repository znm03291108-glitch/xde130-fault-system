const data = Array.isArray(window.FAULT_DATA) ? window.FAULT_DATA : [];
const $ = (id)=>document.getElementById(id);
const state = { q:'', system:'', warranty:'', location:'', tag:'', ranked:null };

const dict = {
  '漏油':['渗油','漏液','渗漏','漏'],
  '漏水':['渗水','防冻液','冷却液','水管渗漏','渗漏'],
  '报警':['红色报警','黄色报警','故障码','仪表报警','代码'],
  '异响':['噪音','响声','声音大','轴承响'],
  '高温':['温度高','水温高','过热'],
  '无法启动':['不能启动','启动不了','打不着','无法起动'],
  '挂挡':['档位','换挡','挡位','手柄','无反应'],
  '制动':['刹车','驻车','行车制动','压力低'],
  '转向':['方向','转向沉','转向压力'],
  '传感器':['压力传感器','温度传感器','插接件'],
  '线束':['线路','断路','虚接','插头','接插件'],
  '轴承':['轴承损坏','温度高'],
  '发动机':['康明斯','机油','水泵','喷油器','缸套'],
};

function uniq(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'zh-Hans-CN'))}
function countBy(arr, keyFn){const m=new Map();arr.forEach(x=>{const k=keyFn(x)||'未填写';m.set(k,(m.get(k)||0)+1)});return [...m.entries()].sort((a,b)=>b[1]-a[1])}
function fillSelect(id, values){const el=$(id); values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)})}
function normalize(s){return String(s||'').toLowerCase().replace(/[，。；、,.!?！？;:：\s]+/g,'')}
function tokenize(s){
  const raw = String(s||'').toLowerCase();
  const words = raw.split(/[\s，。；、,.!?！？;:：/\\|()（）【】\[\]"'“”]+/).filter(Boolean);
  const added = [];
  Object.entries(dict).forEach(([k,vals])=>{
    if(raw.includes(k) || vals.some(v=>raw.includes(v))) added.push(k,...vals);
  });
  words.forEach(w=>{
    if(w.length>1) added.push(w);
    for(let i=0;i<w.length-1;i++) added.push(w.slice(i,i+2));
  });
  return [...new Set(added.map(normalize).filter(x=>x.length>=2))];
}
function blob(x){return [x.fault,x.solution,x.system,x.warranty,x.location,x.serialNo,x.serviceNo,(x.tags||[]).join(' ')].join(' ')}
function rankByFault(input){
  const q = normalize(input); const tokens = tokenize(input);
  if(!q && !tokens.length) return [];
  return data.map(x=>{
    const b = normalize(blob(x));
    let score = 0;
    if(q && b.includes(q)) score += 120;
    tokens.forEach(t=>{ if(b.includes(t)) score += t.length>=4 ? 16 : 8; });
    (x.tags||[]).forEach(t=>{ const nt=normalize(t); if(tokens.includes(nt) || q.includes(nt)) score += 18; });
    if(normalize(x.fault).includes(q) && q.length>=2) score += 50;
    if(normalize(x.solution).includes(q) && q.length>=2) score += 20;
    return {...x, _score:score};
  }).filter(x=>x._score>0).sort((a,b)=>b._score-a._score || a.id-b.id);
}
function init(){
  $('totalCount').textContent = data.length;
  if(!data.length){
    $('aiHint').textContent='数据没有读取到。请确认 data.js 已上传完整，文件名必须是 data.js。';
  }
  fillSelect('systemFilter', uniq(data.map(x=>x.system)));
  fillSelect('warrantyFilter', uniq(data.map(x=>x.warranty)));
  fillSelect('locationFilter', uniq(data.map(x=>x.location)).slice(0,500));
  fillSelect('tagFilter', uniq(data.flatMap(x=>x.tags||[])));

  $('askBtn').onclick = ask;
  $('faultInput').addEventListener('keydown', e=>{ if(e.ctrlKey && e.key==='Enter') ask(); });
  $('clearBtn2').onclick = ()=>{ $('faultInput').value=''; state.ranked=null; $('bestBox').classList.add('hidden'); $('aiHint').textContent=''; render(); };
  document.querySelectorAll('.tips button').forEach(btn=>btn.onclick=()=>{ $('faultInput').value=btn.dataset.demo; ask(); });

  $('q').addEventListener('input', e=>{state.q=e.target.value.trim().toLowerCase(); state.ranked=null; render()});
  $('systemFilter').addEventListener('change', e=>{state.system=e.target.value; render()});
  $('warrantyFilter').addEventListener('change', e=>{state.warranty=e.target.value; render()});
  $('locationFilter').addEventListener('change', e=>{state.location=e.target.value; render()});
  $('tagFilter').addEventListener('change', e=>{state.tag=e.target.value; render()});
  $('clearBtn').onclick=()=>{['q','systemFilter','warrantyFilter','locationFilter','tagFilter'].forEach(id=>$(id).value=''); Object.assign(state,{q:'',system:'',warranty:'',location:'',tag:'',ranked:null}); render()};
  $('exportBtn').onclick=()=>exportCsv(filterData());
  renderStats(); renderSide(); render();
}
function ask(){
  const text = $('faultInput').value.trim();
  if(!text){ $('aiHint').textContent='请先输入故障现象，例如：发动机报警、漏水、异响、挂挡无反应。'; return; }
  const ranked = rankByFault(text);
  state.ranked = ranked;
  state.q = '';
  $('q').value = '';
  if(!ranked.length){
    $('bestBox').classList.remove('hidden');
    $('bestBox').innerHTML = '<h2>未找到相似历史故障</h2><p>建议换关键词：报警、故障码、漏水、异响、传感器、线束、制动压力低等。</p>';
    $('aiHint').textContent='没有匹配到历史案例。';
  } else {
    const best = ranked[0];
    $('bestBox').classList.remove('hidden');
    $('bestBox').innerHTML = `<h2>推荐解决方案</h2>
      <div class="best-card">
        <div><span class="badge system">${escapeHtml(best.system||'未分类')}</span><span class="badge warranty">匹配度 ${best._score}</span></div>
        <h3>${escapeHtml(best.fault||'未填写故障描述')}</h3>
        <p><b>处理方法：</b>${escapeHtml(best.solution||'原表未填写处理方法。')}</p>
        <small>地点：${escapeHtml(best.location||'-')} ｜ 整机编号：${escapeHtml(best.serialNo||'-')} ｜ 故障时间：${escapeHtml(best.faultDate||'-')}</small>
        <button id="copyBest">复制推荐方案</button>
      </div>`;
    $('copyBest').onclick=()=>copyText(`故障：${best.fault}\n处理方法：${best.solution}`);
    $('aiHint').textContent=`已找到 ${ranked.length} 条相似历史案例，下面按匹配度排序。`;
  }
  render();
  $('bestBox').scrollIntoView({behavior:'smooth',block:'start'});
}
function filterData(){
  let base = state.ranked || data;
  return base.filter(x=>{
    const b=blob(x).toLowerCase();
    return (!state.q || b.includes(state.q)) && (!state.system || x.system===state.system) && (!state.warranty || x.warranty===state.warranty) && (!state.location || x.location===state.location) && (!state.tag || (x.tags||[]).includes(state.tag));
  })
}
function renderStats(){
  const systems=countBy(data,x=>x.system); const locations=uniq(data.map(x=>x.location)).length; const serials=uniq(data.map(x=>x.serialNo)).length;
  $('stats').innerHTML = `<div class="stat"><span>总记录</span><b>${data.length}</b></div><div class="stat"><span>故障系统</span><b>${systems.length}</b></div><div class="stat"><span>工作地点</span><b>${locations}</b></div><div class="stat"><span>整机编号</span><b>${serials}</b></div>`;
}
function renderSide(){
  const tagCounts=countBy(data.flatMap(x=>x.tags||[]),x=>x).slice(0,20);
  $('topTags').innerHTML=tagCounts.map(([k,v])=>`<div class="tagRow"><button data-tag="${escapeAttr(k)}">${escapeHtml(k)} · ${v}条</button></div>`).join('') || '<p>暂无标签</p>';
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
  const score = tpl.querySelector('.score'); if(x._score){score.textContent='匹配度 '+x._score}else{score.remove()}
  tpl.querySelector('.fault').textContent=x.fault||'未填写故障描述';
  tpl.querySelector('.meta').innerHTML=`工作地点：${escapeHtml(x.location||'-')} ｜ 整机编号：${escapeHtml(x.serialNo||'-')} ｜ 故障时间：${escapeHtml(x.faultDate||'-')} ｜ 小时数：${escapeHtml(x.hours||'-')} ｜ 源表第${x.sourceRow}行`;
  tpl.querySelector('.solution').textContent=x.solution||'原表未填写处理方法。';
  tpl.querySelector('.tags').innerHTML=(x.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('');
  tpl.querySelector('.copyBtn').onclick=()=>copyText(`故障：${x.fault}\n处理方法：${x.solution}`);
  return root;
}
function copyText(text){
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>alert('已复制故障和处理方案'));}
  else {alert(text)}
}
function exportCsv(rows){
  const headers=['序号','服务单号','工作地点','型号','整机编号','交机日期','故障时间','车辆小时数','故障描述','处理方法','故障系统','保内/保外','标签','匹配度'];
  const body=rows.map(x=>[x.id,x.serviceNo,x.location,x.model,x.serialNo,x.deliveryDate,x.faultDate,x.hours,x.fault,x.solution,x.system,x.warranty,(x.tags||[]).join('|'),x._score||'']);
  const csv=[headers,...body].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='XDE130故障查询结果.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/'/g,'&#39;')}
init();
