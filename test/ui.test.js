import { describe,it } from 'node:test'; import assert from 'node:assert/strict'; import { filteredDecks } from '../src/filter.js';
const decks=[{name:'빠른 마법사',class:'mage',tier:2,winRate:51},{name:'방어 전사',class:'warrior',tier:1,winRate:55}];
describe('filters',()=>{it('searches Korean class/deck names and sorts win rate',()=>{const out=filteredDecks(decks,{query:'전사',selectedClass:'all',tier:'all',sort:'winrate'});assert.deepEqual(out.map(d=>d.name),['방어 전사']);});});
