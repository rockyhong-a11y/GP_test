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
  it('preserves the original collection time and decks after failure',()=>{const old={collectedAt:'2025-01-01T00:00:00Z',decks:[{id:'x'}]};assert.deepEqual(preserveAfterFailure(old,'timeout'),{...old,collectionError:'timeout'});});
  it('records failure metadata before the first successful collection',()=>{const old={collectedAt:null,decks:[]};assert.deepEqual(preserveAfterFailure(old,'blocked'),{...old,collectionError:'blocked'});});
});
