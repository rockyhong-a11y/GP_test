import { readFile } from 'node:fs/promises';
import { validateData, validDeckCode } from './lib.mjs';
const data=validateData(JSON.parse(await readFile('public/data/decks.json','utf8')));
const invalid=data.decks.filter(d=>!validDeckCode(d.deckCode));
if(invalid.length) throw new Error(`유효하지 않은 덱 코드: ${invalid.map(d=>d.id).join(', ')}`);
console.log(`스키마 및 덱 코드 검증 완료 (${data.decks.length}개)`);
