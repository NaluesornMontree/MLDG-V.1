import { toWholeNumber } from './numberUtils';

export const getPaymentItemQuantity = (item = {}) => Math.max(
  0,
  toWholeNumber(item.qty ?? item.quantity ?? 0)
);

export const getPaymentItemUnit = (item = {}) => (
  item.unit || item.Unit || item.Service_Unit || 'รายการ'
);

export const getPaymentItemTotal = (item = {}) => {
  const storedTotal = item.total ?? item.lineTotal ?? item.line_total ?? item.price;
  if (storedTotal !== undefined && storedTotal !== null) {
    return Math.max(0, toWholeNumber(storedTotal));
  }

  return getPaymentItemQuantity(item) * getPaymentItemUnitPrice(item);
};

export const getPaymentItemUnitPrice = (item = {}) => {
  const storedUnitPrice = item.unitPrice ?? item.unit_price ?? item.Price_Rate ?? item.priceRate;
  if (storedUnitPrice !== undefined && storedUnitPrice !== null) {
    return Math.max(0, toWholeNumber(storedUnitPrice));
  }

  const quantity = getPaymentItemQuantity(item);
  const storedTotal = item.total ?? item.lineTotal ?? item.line_total ?? item.price;
  const total = Math.max(0, toWholeNumber(storedTotal || 0));
  return quantity > 0 ? Math.floor(total / quantity) : total;
};
