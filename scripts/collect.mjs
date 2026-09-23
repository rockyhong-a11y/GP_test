import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { allowedByRobots, fetchWithRetry, parseDeckLinks, parseDeckPage, preserveAfterFailure, sleep, validDeckCode, validateData } from './lib.mjs';

const output=resolve(process.env.OUTPUT_PATH||'public/data/decks.json');
const base=process.env.SOURCE_ORIGIN||'https://hearthstone-decks.net';
const metaUrl=`${base}/standard-deck/`;
const tierRule='출처에 메타 티어가 없으므로 모든 덱을 미평가로 표시합니다. 개인 Score는 승률이나 티어로 사용하지 않습니다.';
async function previous() { try{return JSON.parse(await readFile(output,'utf8'));}catch{return null;} }
async function atomic(data) { await mkdir(dirname(output),{recursive:true});const temp=`${output}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,output); }
async function run() {
  const old=await previous();
  const attemptedAt=new Date().toISOString();
  try {
    const robots=await fetchWithRetry(`${base}/robots.txt`);
    if(!allowedByRobots(robots,'/standard-deck/')) throw new Error('robots.txt가 수집 경로를 허용하지 않습니다.');
    const found=parseDeckLinks(await fetchWithRetry(metaUrl),base);
    const unique=[...new Map(found.map(x=>[x.sourceUrl,x])).values()];if(!unique.length)throw new Error('목록 페이지에서 덱 상세 링크를 찾지 못했습니다(페이지 구조 변경 가능).');
    const decks=[],counts={};
    for(const link of unique) { await sleep(Number(process.env.REQUEST_DELAY_MS||1000));const deck=parseDeckPage(await fetchWithRetry(link.sourceUrl),link);if(deck.class&&validDeckCode(deck.deckCode)&&(counts[deck.class]||0)<2){decks.push(deck);counts[deck.class]=(counts[deck.class]||0)+1;}if(Object.keys(counts).length===11&&Object.values(counts).every(n=>n>=2))break; }
    if(!decks.length)throw new Error('유효한 덱 코드가 있는 덱을 찾지 못했습니다.');
    const data=validateData({schemaVersion:1,collectedAt:attemptedAt,collectionAttemptedAt:attemptedAt,source:{name:'Hearthstone-Decks.net',url:metaUrl,scope:'정규전 최신 공개 덱',tierRule},decks}); await atomic(data);
    console.log(`${decks.length}개 덱 수집 완료: ${data.collectedAt}`);
  } catch(error) {
    console.error(`수집 실패: ${error.message}`);
    const preserved=preserveAfterFailure(old,error.message,attemptedAt);
    if(preserved){ await atomic(preserved); console.error(`기존 데이터와 정상 수집 시각(${old.collectedAt??'없음'})을 보존했습니다.`); }
    throw error;
  }
}
await run();
