import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRankingCells, parseVsReport, matchRating, makeRatedDeck, normalizeName } from '../scripts/tier-source.mjs';
import { validateData } from '../scripts/lib.mjs';
import { filteredDecks } from '../src/filter.js';
const cells=JSON.parse(await readFile(new URL('./fixtures/vs-tier-cells.json',import.meta.url),'utf8'));
const ratings=parseRankingCells(cells);
const code='AAECAQcC69YHstgHDuPmBqr8Bqv8BqWFB+iHB9KXB7etB+yyB7XAB5XCB5vCB5zCB6ngB/vgBwAA';
const link={name:'Cannoneer Dragon Warrior',sourceUrl:'https://www.vicioussyndicate.com/decks/cannoneer-dragon-warrior/'};
const report={ratings,reportUrl:'https://www.vicioussyndicate.com/vs-data-reaper-report-358/',date:'2026-09-17T00:00:00.000Z',rankScope:'전설 상위 1,000명'};
it('assigns published tiers by grouped table rows, not deck list rank',()=>{
 assert.equal(ratings.find(r=>r.name==='Dragon Warrior').tier,1);
 assert.equal(ratings.find(r=>r.name==='Egg DeathKnight').tier,2);
 assert.equal(ratings.find(r=>r.name==='Quest Priest').tier,3);
 assert.equal(ratings.find(r=>r.name==='Pure Paladin').tier,4);
});
it('rejects missing or ambiguous tier groups',()=>{
 assert.throws(()=>parseRankingCells(cells.filter(c=>c.level!=='1')));
 assert.throws(()=>parseRankingCells([...cells,{text:'Tier 2',level:'1',top:0,height:703}]));
});
it('normalizes class spacing without merging distinct archetypes',()=>{
 assert.equal(normalizeName('Egg Death Knight'),normalizeName('Egg DeathKnight'));
 assert.equal(matchRating('Thalena Egg Death Knight',ratings).class,'death-knight');
 assert.equal(matchRating('Face Hunter',ratings),null);
});
it('reads the report date and recommended deck links from published markup',()=>{
 const r=parseVsReport('<span class="entry-meta-date updated"><i></i><a>September 17, 2026</a></span><a href="'+link.sourceUrl+'">'+link.name+'</a><a href="/deck-library/">Library</a>',report.reportUrl);
 assert.equal(r.date,report.date);assert.deepEqual(r.links,[link]);
});
it('a real recommended deck reaches the tier 1 filter with its valid code and provenance',()=>{
 const d=makeRatedDeck(link,'<input name="deckstring" value="'+code+'">',report);
 assert.equal(d.tier,1);assert.equal(d.tierMethod,'source');assert.equal(d.deckCode,code);assert.equal(d.tierSourceUrl,report.reportUrl);
 const shown=filteredDecks([d],{query:'',selectedClass:'all',tier:'1',sort:'tier'});
 assert.equal(shown.length,1);assert.equal(shown[0].id,d.id);
});
it('does not attach a tier to an invalid or unrelated deck',()=>{
 assert.equal(makeRatedDeck(link,'<input name="deckstring" value="bad">',report),null);
 assert.equal(makeRatedDeck({...link,name:'Face Hunter'},'<input name="deckstring" value="'+code+'">',report),null);
});
it('rejects a successful tier collection that silently loses every rating',()=>{
 assert.throws(()=>validateData({schemaVersion:1,collectedAt:'2026-09-23T00:00:00Z',source:{requiresRatings:true},decks:[]}),/티어/);
});
