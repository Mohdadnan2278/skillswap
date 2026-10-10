import { describe,it,expect } from "vitest";
import { localToUtc } from "@/shared/time";
import { createBookingSchema,utcInstantSchema } from "@/shared/validation";
describe('session timestamps',()=>{
 it('converts Kolkata and fractional-offset zones across UTC dates',()=>{
  expect(localToUtc('2026-10-11T00:30','Asia/Kolkata')).toBe('2026-10-10T19:00:00.000Z');
  expect(localToUtc('2026-10-11T00:30','Asia/Kathmandu')).toBe('2026-10-10T18:45:00.000Z');
  expect(localToUtc('2026-10-11T12:00','UTC')).toBe('2026-10-11T12:00:00.000Z');
 });
 it('rejects nonexistent, ambiguous and invalid wall-clock dates',()=>{
  expect(()=>localToUtc('2026-03-08T02:30','America/New_York')).toThrow('does not exist');
  expect(()=>localToUtc('2026-11-01T01:30','America/New_York')).toThrow('occurs twice');
  expect(()=>localToUtc('2026-02-30T12:00','UTC')).toThrow('valid date');
  expect(()=>localToUtc('2026-10-11T25:00','UTC')).toThrow('valid date');
 });
 it('requires valid UTC timestamps and rejects client-controlled booking fields',()=>{
  expect(utcInstantSchema.safeParse('2026-10-11T12:00:00+05:30').success).toBe(false);
  expect(utcInstantSchema.safeParse('2026-02-30T12:00:00Z').success).toBe(false);
  const request={teacherId:'41000000-0000-4000-8000-000000000001',skillId:'41000000-0000-4000-8000-000000000002',startsAt:'2026-10-11T12:00:00.000Z',durationMinutes:60};
  expect(createBookingSchema.safeParse(request).success).toBe(true);
  for(const fields of [{costUnits:1},{state:'accepted'},{learnerId:request.teacherId},{durationMinutes:15}])expect(createBookingSchema.safeParse({...request,...fields}).success).toBe(false);
 });
});
