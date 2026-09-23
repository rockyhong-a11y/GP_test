export function assertData(data) {
  const fail=m=>{throw new Error(`데이터 스키마 오류: ${m}`)};
  if(data?.schemaVersion!==1||!Array.isArray(data.decks)||!data.source)fail('필수 루트 필드');
  if(data.collectedAt!==null&&!Number.isFinite(Date.parse(data.collectedAt)))fail('collectedAt');
  for(const d of data.decks){
    if(!d.id||!d.name||!d.class||typeof d.deckCode!=='string'||!d.deckCode||(d.tier!==null&&![1,2,3,4].includes(d.tier))||!['source','calculated','unrated'].includes(d.tierMethod))fail(`덱 ${d.id||'unknown'}`);
    if(d.winRate!==null&&(!(typeof d.winRate==='number')||d.winRate<0||d.winRate>100))fail('winRate');
    if(d.sampleSize!==null&&(!Number.isInteger(d.sampleSize)||d.sampleSize<0))fail('sampleSize');
    try{new URL(d.sourceUrl)}catch{fail('sourceUrl')}
    if(d.sourceDate!==null&&d.sourceDate!==undefined&&!Number.isFinite(Date.parse(d.sourceDate)))fail('sourceDate');
  }
  return data;
}
