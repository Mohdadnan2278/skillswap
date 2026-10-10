import {describe,it,expect} from 'vitest';
import {safeUnits,creditsLabel} from '@/shared/credits';
describe('financial precision',()=>{it('reads exact integer RPC values and rejects unsafe or fractional amounts',()=>{expect(safeUnits('180')).toBe(180);expect(safeUnits('-30')).toBe(-30);for(const bad of ['9007199254740993','-9007199254740993','0.5','NaN',30,null])expect(()=>safeUnits(bad)).toThrow();});it('labels the adopted session costs',()=>{expect(creditsLabel(30)).toBe('0.5 credits');expect(creditsLabel(90)).toBe('1.5 credits');});});
