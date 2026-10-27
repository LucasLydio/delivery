import { formatBrazilianPhoneInput } from './phone';

describe('formatBrazilianPhoneInput', () => {
  it('formats local and country-prefixed Brazilian mobile numbers', () => {
    expect(formatBrazilianPhoneInput('11987654321')).toBe('(11) 9 8765-4321');
    expect(formatBrazilianPhoneInput('+55 11 98765-4321')).toBe('(11) 9 8765-4321');
  });

  it('limits input to one Brazilian mobile number', () => {
    expect(formatBrazilianPhoneInput('119876543219999')).toBe('(11) 9 8765-4321');
  });
});
