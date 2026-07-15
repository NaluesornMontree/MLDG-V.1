export const normalizeWholeNumberInput = (value = '') => {
  const integerPart = String(value ?? '').split(/[.,]/)[0];
  return integerPart.replace(/\D/g, '');
};

export const toWholeNumber = (value = 0) => {
  const normalized = normalizeWholeNumberInput(value);
  return normalized ? Math.trunc(Number(normalized)) : 0;
};
