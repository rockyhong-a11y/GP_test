import { assertData } from '../src/data-schema.js';

export const USER_AGENT = 'GP-test-deck-collector/1.0 (+https://github.com/rockyhong-a11y/GP_test)';
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const networkDetail=error=>{let current=error,last='';for(let i=0;i<5&&current;i++){last=current.code?`${current.code}: ${current.message||''}`:current.message||last;current=current.cause;}return last;};

export async function fetchWithRetry(url, { attempts=3, timeoutMs=15000, fetchImpl=fetch }={}) {
  let last;
  for (let i=0;i<attempts;i++) {
    try {
      const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
      const res=await fetchImpl(url,{headers:{'user-agent':USER_AGENT,'accept':'text/html,application/xhtml+xml'},signal:controller.signal}); clearTimeout(timer);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return await res.text();
    } catch(e) { const detail=networkDetail(e.cause);last=new Error(detail?`${e.message} (${detail})`:e.message,{cause:e});if(i<attempts-1) await sleep(500 * 2**i); }
  }
  throw last;
}

export function allowedByRobots(text, path, agent='GP-test-deck-collector') {
  let active=false; const disallowed=[];
  for(const raw of text.split(/\r?\n/)) { const line=raw.replace(/#.*/,'').trim(); if(!line) continue; const [key,...rest]=line.split(':'); const value=rest.join(':').trim();
    if(key.toLowerCase()==='user-agent') active=value==='*'||value.toLowerCase()===agent.toLowerCase();
    else if(active&&key.toLowerCase()==='disallow'&&value) disallowed.push(value);
  }
  return !disallowed.some(rule => path.startsWith(rule));
}
export const number = value => { if(value===undefined||value===null||String(value).trim()==='')return null;const n=Number(String(value).replace(/[% ,]/g,'')); return Number.isFinite(n)?n:null; };
const entities=s=>String(s).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'");
export function parseDeckLinks(html, base='https://hearthstone-decks.net') {
  const links=[]; const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let match;
  while((match=re.exec(html))){const text=entities(match[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());let url;try{url=new URL(entities(match[1]),base)}catch{continue}
    if(url.origin===new URL(base).origin && /\blegend\b/i.test(text) && CLASS_WORDS.some(([,re])=>re.test(text)) && !/^\/(?:category|tag|author)\//i.test(url.pathname)) links.push({sourceUrl:url.href,name:text});}
  return [...new Map(links.map(x=>[x.sourceUrl,x])).values()];
}
const CLASS_WORDS=[['death-knight',/death[ -]?knight/i],['demon-hunter',/demon[ -]?hunter/i],['druid',/druid/i],['hunter',/hunter/i],['mage',/mage/i],['paladin',/paladin/i],['priest',/priest/i],['rogue',/rogue/i],['shaman',/shaman/i],['warlock',/warlock/i],['warrior',/warrior/i]];
export function parseDeckPage(html, link) {
  const headings=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>entities(m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()));
  const title=headings.find(h=>/\blegend\b/i.test(h)&&CLASS_WORDS.some(([,re])=>re.test(h)))||link.name;
  const klass=CLASS_WORDS.find(([,re])=>re.test(`${title} ${html.match(/class=["'][^"']*(?:category|class)[^"']*["'][^>]*>([^<]+)/i)?.[1]||''}`))?.[0]||null;
  const rawDate=html.match(/<time[^>]*datetime=["']([^"']+)["']/i)?.[1] || html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i)?.[1]; const date=rawDate&&Number.isFinite(Date.parse(rawDate))?new Date(rawDate).toISOString():null;
  return {id:new URL(link.sourceUrl).pathname.split('/').filter(Boolean).pop(),name:title,class:klass,tier:null,tierMethod:'unrated',winRate:null,sampleSize:null,sourceDate:date,sourceUrl:link.sourceUrl,deckCode:parseDeckCode(html)};
}

export function parseDeckCode(html) {
  const inputs=[...html.matchAll(/<input\b[^>]*\bid=["']Code\d+["'][^>]*>/gi)]
    .map(([tag])=>tag.match(/\bvalue=["']([^"']+)["']/i)?.[1]);
  const candidates=[
    ...inputs,
    ...[...html.matchAll(/data-deck-code=["']([^"']+)/gi)].map(m=>m[1]),
    ...[...html.matchAll(/<textarea[^>]*class=["'][^"']*deck-code[^"']*["'][^>]*>([^<]+)/gi)].map(m=>m[1])
  ].filter(c=>typeof c==='string').map(c=>entities(c).trim());
  return candidates.find(validDeckCode) || null;
}
function readVarint(bytes,state){let value=0,shift=0;for(let i=0;i<5;i++){if(state.at>=bytes.length)throw new Error('잘린 varint');const byte=bytes[state.at++];value+=(byte&127)*2**shift;if(!(byte&128))return value;shift+=7;}throw new Error('너무 긴 varint');}
export function decodeDeckCode(code) {
  if(typeof code!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(code)||code.length%4)throw new Error('base64 형식');
  const bytes=Buffer.from(code,'base64'); if(bytes.toString('base64')!==code)throw new Error('비정규 base64');
  const state={at:0}; if(bytes[state.at++]!==0)throw new Error('예약 헤더');
  const version=readVarint(bytes,state);if(version!==1)throw new Error('지원하지 않는 버전');
  const format=readVarint(bytes,state);if(format<1||format>3)throw new Error('게임 형식');
  const heroCount=readVarint(bytes,state);if(heroCount<1||heroCount>2)throw new Error('영웅 수');const heroes=[];for(let i=0;i<heroCount;i++){const id=readVarint(bytes,state);if(!id)throw new Error('영웅 ID');heroes.push(id);}
  const cards=[];for(const copies of [1,2]){const count=readVarint(bytes,state);if(count>60)throw new Error('카드 항목 수');for(let i=0;i<count;i++){const id=readVarint(bytes,state);if(!id)throw new Error('카드 ID');cards.push([id,copies]);}}
  const other=readVarint(bytes,state);if(other>60)throw new Error('기타 카드 수');for(let i=0;i<other;i++){const id=readVarint(bytes,state),copies=readVarint(bytes,state);if(!id||copies<3||copies>99)throw new Error('기타 카드');cards.push([id,copies]);}
  while(state.at<bytes.length){if(readVarint(bytes,state)!==0)throw new Error('알 수 없는 후행 데이터');}
  const total=cards.reduce((n,[,copies])=>n+copies,0);if(cards.length<1||total<30||total>40)throw new Error('완전한 덱 카드 수가 아님');
  return {version,format,heroes,cards,total};
}
export function validDeckCode(code) { try { decodeDeckCode(code);return true; } catch { return false; } }
export function validateData(data) { return assertData(data); }
export function preserveAfterFailure(previous, message, attemptedAt=new Date().toISOString()) {
  if(!previous||!Array.isArray(previous.decks))return null;
  return {...previous,collectionAttemptedAt:attemptedAt,collectionError:message};
}
