
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startCamera } from '../../src/ar/camera';

describe('camera permissions', () => {
  const orig = navigator.mediaDevices;
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue({ name: 'NotAllowedError' }) },
      configurable: true
    });
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: orig });
  });
  it('maps NotAllowedError to camera-permission-denied', async () => {
    await expect(startCamera()).rejects.toThrow('camera-permission-denied');
  });
});
