import { describe, expect, it } from 'vitest';
import { canonicalGoogleMeetUrl } from '@/shared/google-meet';
import { googleMeetLinkSchema, googleMeetUrlSchema } from '@/shared/validation';
import { sessionClock } from '@/shared/session-clock';

describe('copied Google Meet links', () => {
  const canonical = 'https://meet.google.com/abc-defg-hij';
  it('removes sharing parameters/fragments and persists only the meeting code', () => {
    for (const input of [canonical, `${canonical}?authuser=0&hs=122`, `${canonical}#shared`, `  ${canonical}?redirect=https://other.example  `]) {
      expect(googleMeetLinkSchema.parse({ url: input })).toEqual({ url: canonical });
    }
    expect(googleMeetLinkSchema.parse({ url: null })).toEqual({ url: null });
  });
  it('rejects lookalike hosts, credentials, redirect/creation pages, control characters and oversized input', () => {
    for (const input of ['http://meet.google.com/abc-defg-hij', 'https://meet.google.com.evil.test/abc-defg-hij', 'https://meet.google.com@evil.test/abc-defg-hij', 'https://person@meet.google.com/abc-defg-hij', 'https://meet.google.com/new', 'https://meet.google.com/landing?meeting=abc-defg-hij', 'https:////meet.google.com/abc-defg-hij', `${canonical}\n`, `${canonical}?x=${'a'.repeat(2048)}`]) {
      expect(canonicalGoogleMeetUrl(input)).toBeNull();
      expect(googleMeetLinkSchema.safeParse({ url: input }).success).toBe(false);
    }
  });
  it('keeps returned/granted links strictly canonical', () => {
    expect(googleMeetUrlSchema.safeParse(`${canonical}?authuser=0`).success).toBe(false);
    expect(googleMeetLinkSchema.safeParse({ url: canonical, actorId: 'someone' }).success).toBe(false);
  });
});

it('session schedule distinguishes pre-start, actual duration and ended time without extending on navigation', () => {
  const startsAt = '2026-10-11T12:00:00Z', endsAt = '2026-10-11T12:30:00Z', start = Date.parse(startsAt), end = Date.parse(endsAt);
  expect(sessionClock(startsAt, endsAt, start - 5 * 60000)).toEqual({ phase: 'before', text: '05:00' });
  expect(sessionClock(startsAt, endsAt, start)).toEqual({ phase: 'during', text: '30:00' });
  expect(sessionClock(startsAt, endsAt, start + 10 * 60000)).toEqual({ phase: 'during', text: '20:00' });
  expect(sessionClock(startsAt, endsAt, end)).toEqual({ phase: 'ended', text: '00:00' });
  expect(sessionClock(startsAt, endsAt, end + 60 * 60000)).toEqual({ phase: 'ended', text: '00:00' });
});
