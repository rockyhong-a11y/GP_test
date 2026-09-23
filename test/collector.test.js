import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { allowedByRobots, decodeDeckCode, number, parseDeckCode, parseDeckLinks, parseDeckPage, preserveAfterFailure, validDeckCode, validateData } from '../scripts/lib.mjs';
const fixture=name=>readFile(new URL(`./fixtures/${name}`,import.meta.url),'utf8');
describe('collector',()=>{
  it('parses public listing/detail markup without treating Score as win rate',async()=>{const [link]=parseDeckLinks(await fixture('meta.html'));const deck=parseDeckPage(await fixture('deck.html'),link);assert.deepEqual({class:deck.class,tier:deck.tier,tierMethod:deck.tierMethod,winRate:deck.winRate,sampleSize:deck.sampleSize,sourceDate:deck.sourceDate},{class:'mage',tier:null,tierMethod:'unrated',winRate:null,sampleSize:null,sourceDate:'2025-09-20T12:30:00.000Z'});});
  it('fully parses a genuine deckstring and rejects truncation',async()=>{const code=parseDeckCode(await fixture('deck.html'));assert.equal(decodeDeckCode(code).total,30);assert.equal(validDeckCode(code.slice(0,-8)),false);});
  it('does not coerce a missing number to zero',()=>assert.equal(number(undefined),null));
  it('respects robots disallow rules',()=>assert.equal(allowedByRobots('User-agent: *\nDisallow: /meta','/meta'),false));
  it('rejects invalid schema data',()=>assert.throws(()=>validateData({schemaVersion:1})));
  it('preserves the original collection time and decks after failure',()=>{const old={collectedAt:'2025-01-01T00:00:00Z',decks:[{id:'x'}]};assert.deepEqual(preserveAfterFailure(old,'timeout','2025-01-02T00:00:00Z'),{...old,collectionAttemptedAt:'2025-01-02T00:00:00Z',collectionError:'timeout'});});
  it('records failure metadata before the first successful collection',()=>{const old={collectedAt:null,decks:[]};assert.deepEqual(preserveAfterFailure(old,'blocked','2025-01-02T00:00:00Z'),{...old,collectionAttemptedAt:'2025-01-02T00:00:00Z',collectionError:'blocked'});});
});

it('finds root-level Legend deck articles instead of category navigation',()=>{
  const links=parseDeckLinks('<a href="/standard-decks/mage/">Mage</a><a href="/burn-mage-50-legend-unknown/">Burn Mage #50 Legend – Unknown</a><a href="https://example.com/mage/">Mage Legend</a>');
  assert.equal(links.length,1); assert.equal(links[0].sourceUrl,'https://hearthstone-decks.net/burn-mage-50-legend-unknown/');
});

it('reads a real Code1 input before unrelated base64 in the page',()=>{const code='AAECAfHhBAzDgwf1mAfsmwfXnQfgnQftnweSpAfSrgeOvwfa1wes2ged2wcJgf0Gl4IHupUHn54H4rEHrtoHtNoHptwHv98HAAA=';const html='<style>AAEAAAAAAAAAAAAAAAAAAAAA</style><input id="Code1" type="text" value="'+code+'">';assert.equal(parseDeckCode(html),code);assert.equal(decodeDeckCode(code).format,2);assert.equal(decodeDeckCode(code).total,30);});

it('ignores the site logo h1 before the deck article heading',()=>{const d=parseDeckPage('<h1>Hearthstone-Decks.net</h1><h1>UUB Egg Death Knight #21 Legend</h1><input id="Code1" value="AAECAfHhBAzDgwf1mAfsmwfXnQfgnQftnweSpAfSrgeOvwfa1wes2ged2wcJgf0Gl4IHupUHn54H4rEHrtoHtNoHptwHv98HAAA=">',{name:'UUB Egg Death Knight #21 Legend',sourceUrl:'https://hearthstone-decks.net/uub-egg-death-knight-21-legend/'});assert.equal(d.class,'death-knight');assert.equal(d.name,'UUB Egg Death Knight #21 Legend');});

it('parses a real Paladin deck with its sideboard without inflating the deck size',()=>{
  const code='AAECAZ8FBvD+Bu6oB++oB/CoB+XBB53dBwzJoAS6lgfLqQfErge+sgfiwQfowQfqwQeDwgfc1QeZ3QfX4gcAAQGa3Qed3QcAAA==';const decoded=decodeDeckCode(code);
  assert.equal(decoded.total,30);assert.deepEqual(decoded.sideboards,[[126618,1,126621]]);
  assert.equal(parseDeckCode('<input id="Code1" value="'+code+'">'),code);
});
it('rejects incomplete sideboards and unknown trailing bytes',()=>{
  const bytes=Buffer.from('AAECAZ8FBvD+Bu6oB++oB/CoB+XBB53dBwzJoAS6lgfLqQfErge+sgfiwQfowQfqwQeDwgfc1QeZ3QfX4gcAAQGa3Qed3QcAAA==','base64');
  assert.equal(validDeckCode(bytes.subarray(0,-1).toString('base64')),false);
  assert.equal(validDeckCode(Buffer.concat([bytes,Buffer.from([2])]).toString('base64')),false);
});
