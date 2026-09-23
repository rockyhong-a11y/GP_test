import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { allowedByRobots, fetchWithRetry, parseDeckLinks, parseDeckPage, preserveAfterFailure, sleep, validDeckCode, validateData } from './lib.mjs';
import { collectRankings, makeRatedDeck, matchRating, RANKING_URL } from './tier-source.mjs';
import { CLASSES } from '../src/classes.js';

const output=resolve(process.env.OUTPUT_PATH||'public/data/decks.json');
const base=process.env.SOURCE_ORIGIN||'https://hearthstone-decks.net';
const metaUrl=base+'/standard-deck/';
async function previous(){try{return JSON.parse(await readFile(output,'utf8'));}catch{return null;}}
async function atomic(data){await mkdir(dirname(output),{recursive:true});const temp=output+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,output);}
async function run(){
  const old=await previous(),attemptedAt=new Date().toISOString();
  try{
    const report=await collectRankings(),decks=[];
    const links=report.links.filter(link=>matchRating(link.name,report.ratings));
    if(!links.length)throw new Error('티어 표와 연결되는 보고서 덱이 없습니다.');
    for(const link of links){
      if(!allowedByRobots(report.robots,new URL(link.sourceUrl).pathname))continue;
      await sleep(Number(process.env.REQUEST_DELAY_MS||1000));
      const deck=makeRatedDeck(link,await fetchWithRetry(link.sourceUrl),report);
      if(deck)decks.push(deck);
    }
    if(!decks.length)throw new Error('실제 티어와 유효한 코드가 있는 덱이 없습니다.');
    const ratedClasses=new Set(decks.map(d=>d.class)),counts={};
    if(CLASSES.some(([id])=>!ratedClasses.has(id))){
      const robots=await fetchWithRetry(base+'/robots.txt');
      if(!allowedByRobots(robots,'/standard-deck/'))throw new Error('보완 출처 robots.txt 제한');
      const found=parseDeckLinks(await fetchWithRetry(metaUrl),base);
      for(const link of found){
        const guessed=link.name.match(/death[ -]?knight|demon[ -]?hunter|druid|hunter|mage|paladin|priest|rogue|shaman|warlock|warrior/i)?.[0].toLowerCase().replace(/ /g,'-');
        if(!guessed||ratedClasses.has(guessed)||(counts[guessed]||0)>=2||!allowedByRobots(robots,new URL(link.sourceUrl).pathname))continue;
        await sleep(Number(process.env.REQUEST_DELAY_MS||1000));
        const deck=parseDeckPage(await fetchWithRetry(link.sourceUrl),link);
        if(deck.class&&validDeckCode(deck.deckCode)){
          decks.push({...deck,sourceName:'Hearthstone-Decks.net',unratedReason:'현재 vS 티어 표에 평가가 없는 직업의 공개 전설 덱입니다.'});
          counts[deck.class]=(counts[deck.class]||0)+1;
        }
      }
    }
    const unique=[...new Map(decks.map(d=>[d.deckCode,d])).values()];
    const data=validateData({schemaVersion:1,collectedAt:attemptedAt,collectionAttemptedAt:attemptedAt,source:{name:'Vicious Syndicate',url:RANKING_URL,reportUrl:report.reportUrl,reportNumber:report.reportNumber,reportDate:report.date,rankScope:report.rankScope,scope:'정규전 · '+report.rankScope,requiresRatings:true,tierRule:'vS 공개 티어 표의 덱 유형 평가입니다. 같은 보고서의 추천 덱 코드와 연결합니다. 순위표에 없는 직업의 보완 덱에는 티어를 임의 부여하지 않습니다. 하루 4회 새 보고서를 확인하며 출처의 평가는 보고서 발행 시 갱신됩니다.'},decks:unique});
    await atomic(data);
    console.log(data.decks.length+'개 덱 수집 완료 ('+data.decks.filter(d=>d.tier!==null).length+'개 티어 평가): '+data.collectedAt);
  }catch(error){
    console.error('수집 실패: '+error.message);
    const preserved=preserveAfterFailure(old,error.message,attemptedAt);
    if(preserved)await atomic(preserved);
    throw error;
  }
}
await run();
