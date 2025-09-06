
import { resolveAssetUrls } from '../../src/routing/id';
import { describe, it, expect } from 'vitest';

describe('routing', () => {
  it('maps /art/foo to asset URLs', () => {
    const urls = resolveAssetUrls('/art/foo');
    expect(urls).toEqual({
      mind: '/targets/foo.mind',
      video: '/media/foo.mp4',
      meta: '/meta/foo.json'
    });
  });
});
