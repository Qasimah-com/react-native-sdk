import { RIYAL_ASPECT_RATIO, RIYAL_PATHS, RIYAL_VIEWBOX, formatAmount } from '../src/money';

describe('formatAmount', () => {
  it.each([
    [1200, '1,200'],
    [300.5, '300.50'],
    [300, '300'],
    [0, '0'],
    [12.3, '12.30'],
    [12.34, '12.34'],
    [1234567.89, '1,234,567.89'],
    [99.999, '100'],
    [1000, '1,000'],
    [999, '999'],
    [0.05, '0.05'],
    [-45.5, '-45.50'],
  ])('formats %d as %s', (value, expected) => {
    expect(formatAmount(value)).toBe(expected);
  });

  it('uses Latin digits and never a currency word or code', () => {
    const text = formatAmount(1234567.5);
    expect(text).toMatch(/^[0-9,.]+$/);
    expect(text).not.toContain('SAR');
    expect(text).not.toContain('ريال');
    expect(text).not.toContain('﷼');
  });
});

describe('riyal glyph constants', () => {
  it('describes the reference glyph', () => {
    expect(RIYAL_VIEWBOX).toBe('0 0 1124.14 1256.39');
    expect(RIYAL_PATHS).toHaveLength(2);
    expect(RIYAL_ASPECT_RATIO).toBeCloseTo(1124.14 / 1256.39, 6);
  });
});
