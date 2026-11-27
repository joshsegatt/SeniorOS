// Monthly rate from a nominal annual percentage string such as '6.5'.
export function monthlyRate(annualRate) {
  if (typeof annualRate !== 'string' || !/^\d+(\.\d{1,6})?$/.test(annualRate)) {
    throw new RangeError(`invalid annual rate: ${annualRate}`);
  }
  return Number(annualRate) / 100 / 12;
}
