import { CLASSES, CLASS_NAME } from './classes.js';
import { filteredDecks } from './filter.js';
const state={decks:[],selectedClass:'all',query:'',tier:'all',sort:'tier',collectionError:'',source:null};
const $=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatKst=iso=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(iso));
const formatDate=iso=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(iso));
function renderSource(){
  const source=state.source;
  if(!source?.reportDate){$('#tierSummary').textContent='티어 데이터 확인 중';return;}
  const counts=[1,2,3,4].map(t=>state.decks.filter(d=>d.tier===t).length);
  $('#tierSummary').innerHTML='<div><p class="eyebrow">VS DATA REAPER #'+esc(source.reportNumber)+'</p><h2>이번 메타의 티어 덱</h2><p>'+esc(source.rankScope)+' · '+formatDate(source.reportDate)+' 보고서 기준</p></div><div class="tier-counts">'+counts.map((n,i)=>'<span class="tier-badge tier-'+(i+1)+'">티어 '+(i+1)+' <b>'+n+'</b></span>').join('')+'</div><p class="tier-note">티어는 덱 유형의 평가이며 아래 코드는 같은 보고서의 추천 구성입니다. 하루 4회 새 보고서를 확인합니다. <a href="'+esc(source.reportUrl)+'" target="_blank" rel="noopener noreferrer">평가 원문 보기 ↗</a></p>';
}
function renderFilters(){
  $('#classFilters').innerHTML=[['all','전체'],...CLASSES].map(([id,name])=>'<button type="button" class="class-filter '+(state.selectedClass===id?'active':'')+'" data-class="'+id+'" aria-pressed="'+(state.selectedClass===id)+'">'+name+'</button>').join('');
}
function card(d){
  const rated=d.tier!=null;
  const stats=d.winRate==null?'개별 덱 승률 자료 없음':'승률 <strong>'+d.winRate.toFixed(1)+'%</strong>'+(d.sampleSize==null?'':' · '+d.sampleSize.toLocaleString('ko-KR')+'게임');
  const date=d.sourceDate?' · 게시 '+formatKst(d.sourceDate)+' KST':'';
  const provenance=rated?'vS 덱 유형 평가':(d.unratedReason||'출처에 티어 평가가 없습니다.');
  return '<article class="deck-card class-'+esc(d.class)+'"><div class="deck-main"><div class="deck-title"><span class="class-dot" aria-hidden="true"></span><div><div class="deck-rating"><span class="tier-badge tier-'+(d.tier??'unrated')+'">'+(rated?'티어 '+d.tier:'평가 없음')+'</span><span>'+esc(CLASS_NAME[d.class]||d.class)+'</span></div><h3>'+esc(d.name)+'</h3><p class="rating-context">'+esc(provenance)+'</p></div></div><p class="stats">'+stats+date+'</p></div><div class="deck-actions"><a href="'+esc(d.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(d.sourceName||'출처')+' ↗<span class="sr-only"> (새 창)</span></a><button class="copy" data-code="'+esc(d.deckCode)+'">덱 코드 복사</button></div><details><summary>덱 코드 직접 보기</summary><label>복사에 실패하면 아래 코드를 선택하세요<textarea readonly rows="3">'+esc(d.deckCode)+'</textarea></label></details></article>';
}
function render(){
  renderFilters();const decks=filteredDecks(state.decks,state);
  $('#status').innerHTML=(state.collectionError?'<p class="warning">최근 수집 실패 — 마지막 정상 데이터를 표시합니다.</p>':'')+'<span>'+decks.length+'개 덱</span>';
  if(!decks.length&&(state.query||state.tier!=='all')){$('#results').innerHTML='<div class="empty-state"><h2>해당 조건의 덱이 없습니다</h2><p>직업이나 티어 필터를 바꿔 보세요. 평가가 없는 덱은 전체 평가에서 확인할 수 있습니다.</p></div>';return;}
  let groups=state.selectedClass==='all'?CLASSES:CLASSES.filter(([id])=>id===state.selectedClass);
  if(state.query||state.tier!=='all')groups=groups.filter(([id])=>decks.some(d=>d.class===id));
  $('#results').innerHTML=groups.map(([id,name])=>{
    const items=decks.filter(d=>d.class===id);
    return '<section class="class-section" aria-labelledby="heading-'+id+'"><h2 id="heading-'+id+'"><span class="class-dot class-'+id+'" aria-hidden="true"></span>'+name+'<small>'+items.length+'</small></h2>'+(items.length?items.map(card).join(''):'<p class="empty">현재 출처에 추천 덱 자료가 없습니다.</p>')+'</section>';
  }).join('');
}
async function copyCode(button){
  try{await navigator.clipboard.writeText(button.dataset.code);button.textContent='복사 완료';button.classList.add('copied');}
  catch{const area=button.closest('.deck-card').querySelector('textarea');button.closest('.deck-card').querySelector('details').open=true;area.focus();area.select();button.textContent='코드를 직접 복사하세요';}
  setTimeout(()=>{button.textContent='덱 코드 복사';button.classList.remove('copied');},2500);
}
async function load(){
  try{
    const response=await fetch(new URL('data/decks.json',document.baseURI),{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();state.decks=data.decks;state.source=data.source;state.collectionError=data.collectionError||'';
    const age=data.collectedAt?Date.now()-new Date(data.collectedAt).getTime():Infinity;
    const attempt=data.collectionAttemptedAt?' · 시도 '+formatKst(data.collectionAttemptedAt)+' KST':'';
    $('#freshness').innerHTML=data.collectedAt?'<strong>수집 '+formatKst(data.collectedAt)+' KST</strong><span>'+(age>12*36e5?'⚠ 오래된 데이터':'최근 갱신')+attempt+'</span>':'<strong>수집 전</strong><span>최초 수집 대기 중'+attempt+'</span>';
    renderSource();render();
  }catch{
    $('#freshness').textContent='데이터를 불러오지 못함';
    $('#results').innerHTML='<div class="error"><h2>덱 데이터를 불러올 수 없습니다</h2><p>잠시 후 다시 시도해 주세요.</p><button onclick="location.reload()">다시 시도</button></div>';
  }
}
document.addEventListener('click',e=>{const filter=e.target.closest('[data-class]');if(filter){state.selectedClass=filter.dataset.class;render();}const copy=e.target.closest('.copy');if(copy)copyCode(copy);});
$('#search').addEventListener('input',e=>{state.query=e.target.value;render();});
$('#tier').addEventListener('change',e=>{state.tier=e.target.value;render();});
$('#sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
load();
