export interface ApplicationPace { frequency:"manual"|"daily"|"weekly"; batchLimit:number; totalLimit:number; }
export function increasesPace(next:ApplicationPace, saved?:ApplicationPace|null) {
  if(!saved)return next.frequency!=="manual" || next.batchLimit>10;
  const rank={manual:0,weekly:1,daily:2};
  return rank[next.frequency]>rank[saved.frequency] || next.batchLimit>saved.batchLimit || next.totalLimit>saved.totalLimit;
}
export const paceWarning="Increasing frequency or application volume can increase spam and automation-screening risk. There is no published universal safe rate or guarantee against ATS flags. Keep applications relevant and respect each platform's limits.";
