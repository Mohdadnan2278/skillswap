/** Financial RPCs encode bigint amounts as strings to avoid JSON precision loss. */
export function safeUnits(value: unknown): number {
 if(typeof value !== 'string'||! /^-?\d+$/.test(value))throw new Error('Invalid credit amount');
 const integer=BigInt(value);
 if(integer>BigInt(Number.MAX_SAFE_INTEGER)||integer<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('Credit amount exceeds safe range');
 return Number(integer);
}
export function creditsLabel(units: number): string {
 if(!Number.isSafeInteger(units))throw new Error('Invalid credit amount');
 return `${(units/60).toLocaleString('en',{maximumFractionDigits:2})} credits`;
}
