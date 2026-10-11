import type {Reputation} from '@/shared/contracts';
export function ReputationLabel({value}:{value:Reputation}){return <p className="mt-3 text-sm text-muted">{value.averageRating===null?'No ratings yet.':`${value.averageRating.toFixed(2)} / 5 · ${value.ratingCount} ${value.ratingCount===1?'rating':'ratings'}`}</p>;}
