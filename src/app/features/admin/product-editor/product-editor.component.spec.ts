import { parsePriceToMinor } from '../product-editor.component';

describe('parsePriceToMinor', () => {
  it('converts Brazilian decimal values to integer cents', () => {
    expect(parsePriceToMinor('29,90')).toBe(2990);
    expect(parsePriceToMinor('10')).toBe(1000);
    expect(parsePriceToMinor('0,05')).toBe(5);
  });

  it('rejects invalid or over-precise values', () => {
    expect(parsePriceToMinor('12,999')).toBeNull();
    expect(parsePriceToMinor('-1')).toBeNull();
    expect(parsePriceToMinor('produto')).toBeNull();
  });
});
