import { fetchWithRetry, allowedByRobots, validDeckCode } from './lib.mjs';

export const RANKING_URL='https://www.vicioussyndicate.com/drr/vs-power-rankings-data-reaper-report/';
export const RANK_SCOPE='전설 상위 1,000명';
const decode=s=>String(s).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'");
const plain=s=>decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export const normalizeName=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const classes=[['death-knight','deathknight'],['demon-hunter','demonhunter'],...['druid','hunter','mage','paladin','priest','rogue','shaman','warlock','warrior'].map(c=>[c,c])];
export function classify(name){const normalized=normalizeName(name);return classes.find(([,word])=>normalized.endsWith(word))?.[0]||null;}

export function parseRankingCells(cells){
  const tiers=cells.filter(c=>/^Tier [1-4]$/.test(c.text)&&c.level==='1').map(c=>({...c,tier:+c.text.slice(-1)}));
  if(!tiers.length)throw new Error('공개 티어 표의 등급 구간을 찾지 못했습니다.');
  const rows=cells.filter(c=>c.level==='2'&&classify(c.text)).map(c=>{
    const matches=tiers.filter(t=>c.top+c.height/2>=t.top&&c.top+c.height/2<t.top+t.height);
    if(matches.length!==1)throw new Error('덱과 티어 행 구간이 모호합니다: '+c.text);
    return {name:c.text,class:classify(c.text),tier:matches[0].tier};
  });
  if(rows.length<5||new Set(rows.map(r=>normalizeName(r.name))).size!==rows.length)throw new Error('공개 티어 표가 비어 있거나 중복되었습니다.');
  return rows;
}
export function parseVsReport(html,reportUrl){
  const date=html.match(/<time\b[^>]*datetime=["']([^"']+)/i)?.[1] || (html.match(/<span\b[^>]*class=["'][^"']*entry-meta-date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] && plain(html.match(/<span\b[^>]*class=["'][^"']*entry-meta-date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)[1])+' UTC');
  if(!date||!Number.isFinite(Date.parse(date)))throw new Error('보고서 게시 날짜를 찾지 못했습니다.');
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({sourceUrl:new URL(decode(m[1]),reportUrl).href,name:plain(m[2])})).filter(l=>new URL(l.sourceUrl).origin==='https://www.vicioussyndicate.com'&&new URL(l.sourceUrl).pathname.startsWith('/decks/'));
  return {date:new Date(date).toISOString(),links:[...new Map(links.map(l=>[l.sourceUrl,l])).values()]};
}
export function matchRating(name,ratings){
  const n=normalizeName(name);
  const matches=ratings.filter(r=>n.endsWith(normalizeName(r.name)));
  return matches.length===1?matches[0]:null;
}
export function parseVsDeckCode(html){
  const candidates=[...html.matchAll(/<input\b[^>]*>/gi)].filter(([s])=>/\bname=["']deckstring["']/i.test(s)).map(([s])=>decode(s.match(/\bvalue=["']([^"']+)/i)?.[1]||''));
  return candidates.find(validDeckCode)||null;
}

export function makeRatedDeck(link,html,report){
  const rating=matchRating(link.name,report.ratings),deckCode=parseVsDeckCode(html);
  if(!rating||!deckCode)return null;
  return {id:'vs-'+new URL(link.sourceUrl).pathname.split('/').filter(Boolean).pop(),name:link.name,class:rating.class,archetype:rating.name,tier:rating.tier,tierMethod:'source',tierSourceUrl:report.reportUrl,tierDate:report.date,rankScope:report.rankScope,winRate:null,sampleSize:null,sourceDate:null,sourceUrl:link.sourceUrl,sourceName:'Vicious Syndicate',deckCode};
}

export async function collectRankings(){
  const robots=await fetchWithRetry('https://www.vicioussyndicate.com/robots.txt');
  if(!allowedByRobots(robots,new URL(RANKING_URL).pathname))throw new Error('티어 출처 robots.txt 제한');
  const html=await fetchWithRetry(RANKING_URL);
  const name=decode(html.match(/<param\s+name=['"]name['"]\s+value=['"]([^'"]+)/i)?.[1]||'');
  if(!/^DataReaper\d+-vSPowerRankings\/vSPowerRankingsDashboard$/.test(name))throw new Error('공개 티어 표 주소를 찾지 못했습니다.');
  const reportNumber=Number(name.match(/^DataReaper(\d+)/)[1]);
  const reportUrl='https://www.vicioussyndicate.com/vs-data-reaper-report-'+reportNumber+'/';
  if(!allowedByRobots(robots,new URL(reportUrl).pathname))throw new Error('현재 보고서 링크를 확인하지 못했습니다.');
  const report=parseVsReport(await fetchWithRetry(reportUrl),reportUrl);
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    const tableUrl='https://public.tableau.com/views/'+name+'?:showVizHome=no&:embed=y';
    await page.goto(tableUrl,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('gridcell',{name:'Tier 1',exact:true}).waitFor({timeout:90000});
    const body=await page.locator('body').innerText();
    if(!body.includes('Top 1K Legend'))throw new Error('티어 표의 전설 상위 1,000명 기준을 확인하지 못했습니다.');
    const cells=await page.locator('[role="gridcell"]').evaluateAll(els=>els.map(el=>({text:el.textContent.trim(),level:el.getAttribute('aria-level'),top:parseFloat(el.style.top),height:parseFloat(el.style.height)})));
    const ratings=parseRankingCells(cells);
    return {...report,reportUrl,reportNumber,tableUrl,rankScope:RANK_SCOPE,ratings,robots};
  }finally{await browser.close();}
}
if(process.argv[1]?.endsWith('/tier-source.mjs')){
  console.log(JSON.stringify(await collectRankings()));
}
