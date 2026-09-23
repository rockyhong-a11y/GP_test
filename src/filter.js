import { CLASS_NAME } from './classes.js';
export function filteredDecks(decks, filters) {
  const q = filters.query.trim().toLocaleLowerCase('ko');
  return decks.filter(d => (filters.selectedClass === 'all' || d.class === filters.selectedClass)
    && (filters.tier === 'all' || (filters.tier === 'unrated' ? d.tier == null : String(d.tier) === filters.tier))
    && (!q || `${d.name} ${CLASS_NAME[d.class] || d.class}`.toLocaleLowerCase('ko').includes(q)))
    .sort((a,b) => filters.sort === 'winrate'
      ? (b.winRate ?? -1) - (a.winRate ?? -1) || (a.tier ?? 99) - (b.tier ?? 99)
      : (a.tier ?? 99) - (b.tier ?? 99) || (b.winRate ?? -1) - (a.winRate ?? -1));
}
