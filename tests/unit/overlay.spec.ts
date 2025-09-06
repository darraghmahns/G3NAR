
import { calcPlaneScale } from '../../src/ar/overlay';
import { describe, it, expect } from 'vitest';

describe('overlay aspect', () => {
  it('uses meta/video aspect when provided', () => {
    const s = calcPlaneScale({ aspect: 4/3 });
    expect(s.width / s.height).toBeCloseTo(4/3, 2);
  });
});
