const MAX_MONEY_CENTS = 999_999_999_999;

export function parsePositiveMoneyToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [wholePart, fractionPart = ''] = value.split('.');
  const normalizedWholePart = wholePart.replace(/^0+(?=\d)/, '');

  if (normalizedWholePart.length > 10) {
    return null;
  }

  const cents =
    Number(normalizedWholePart) * 100 + Number(fractionPart.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_MONEY_CENTS) {
    return null;
  }

  return cents;
}
