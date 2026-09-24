import { describe, expect, it } from 'vitest';
import { detectNaturalMath } from '../../components/contour/modules/calculator';
import { isContourCandidateGrounded, shouldConsultContourExtended } from './intentPolicy';

describe('Contour intent policy', () => {
  it('keeps ordinary chat and generative writing out of Contour', () => {
    expect(shouldConsultContourExtended('write me a paragraph on earthquake')).toBe(false);
    expect(shouldConsultContourExtended('The car wash is 2 minutes away. Should I walk there or drive?')).toBe(false);
    expect(shouldConsultContourExtended('explain why leaves are green')).toBe(false);
  });

  it('admits bounded actions, including small typos', () => {
    expect(shouldConsultContourExtended('multipky 6by 2')).toBe(true);
    expect(shouldConsultContourExtended('please stash this as a note: buy milk')).toBe(true);
    expect(shouldConsultContourExtended('translate good morning to Bangla')).toBe(true);
  });

  it('handles obvious natural arithmetic entirely in Core', () => {
    expect(detectNaturalMath('multiply 12 by 6')?.result).toBe(72);
    expect(detectNaturalMath('multipky 6by 2')?.result).toBe(12);
    expect(detectNaturalMath('would you kindly multiply 21 by 2')?.result).toBe(42);
    expect(detectNaturalMath('subtract 3 from 10')?.result).toBe(7);
  });

  it('requires evidence specific to the tool Needle selected', () => {
    expect(isContourCandidateGrounded('hash', 'hash', 'write me a paragraph on earthquake')).toBe(false);
    expect(isContourCandidateGrounded('translator', 'translator', 'write me a paragraph on earthquake')).toBe(false);
    expect(isContourCandidateGrounded('timer', 'timer', 'the shop is 2 minutes away')).toBe(false);
    expect(isContourCandidateGrounded('hash', 'hash', 'sha256 hash this text')).toBe(true);
  });
});
