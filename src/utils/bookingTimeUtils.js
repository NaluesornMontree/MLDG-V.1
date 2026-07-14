export const areSlotsContiguous = (slots = [], timeSlotsOrder = []) => {
  const uniqueSlots = [...new Set(slots)].filter(Boolean);
  if (uniqueSlots.length <= 1) return true;

  const indexes = uniqueSlots
    .map((slot) => timeSlotsOrder.indexOf(slot))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (indexes.length !== uniqueSlots.length) return false;

  return indexes.every((index, position) => {
    if (position === 0) return true;
    return index - indexes[position - 1] === 1;
  });
};

const normalizeSlotsByOrder = (slots = [], timeSlotsOrder = []) => (
  [...new Set(slots)]
    .filter(Boolean)
    .sort((a, b) => timeSlotsOrder.indexOf(a) - timeSlotsOrder.indexOf(b))
);

export const doSelectedLanesShareSameSlots = (selectedSlots = {}, timeSlotsOrder = []) => {
  const selectedSlotGroups = Object.values(selectedSlots)
    .filter((slots) => Array.isArray(slots) && slots.length > 0)
    .map((slots) => normalizeSlotsByOrder(slots, timeSlotsOrder));

  if (selectedSlotGroups.length <= 1) return true;

  const firstGroup = selectedSlotGroups[0];
  return selectedSlotGroups.every((slots) => (
    slots.length === firstGroup.length &&
    slots.every((slot, index) => slot === firstGroup[index])
  ));
};

export const isSelectedSlotsDraftValid = (selectedSlots = {}, timeSlotsOrder = []) => {
  const selectedSlotGroups = Object.values(selectedSlots)
    .filter((slots) => Array.isArray(slots) && slots.length > 0)
    .map((slots) => normalizeSlotsByOrder(slots, timeSlotsOrder));

  if (selectedSlotGroups.length === 0) return true;

  const everyLaneContiguous = selectedSlotGroups.every((slots) => areSlotsContiguous(slots, timeSlotsOrder));
  if (!everyLaneContiguous) return false;

  const allSlots = selectedSlotGroups.flat();
  if (!areSlotsContiguous(allSlots, timeSlotsOrder)) return false;

  const firstSelectedIndex = Math.min(
    ...allSlots.map((slot) => timeSlotsOrder.indexOf(slot)).filter((index) => index >= 0)
  );

  return selectedSlotGroups.every((slots) => timeSlotsOrder.indexOf(slots[0]) === firstSelectedIndex);
};

export const areSelectedSlotsContiguous = (selectedSlots = {}, timeSlotsOrder = []) => {
  const selectedSlotGroups = Object.values(selectedSlots).filter((slots) => Array.isArray(slots) && slots.length > 0);
  if (selectedSlotGroups.length === 0) return true;

  const everyLaneContiguous = selectedSlotGroups.every((slots) => areSlotsContiguous(slots, timeSlotsOrder));
  if (!everyLaneContiguous) return false;

  return doSelectedLanesShareSameSlots(selectedSlots, timeSlotsOrder);
};

export const canAddContiguousSlot = (currentSlots = [], slot, timeSlotsOrder = []) => {
  if (!Array.isArray(currentSlots) || currentSlots.length === 0) return true;
  if (currentSlots.includes(slot)) return true;

  return areSlotsContiguous([...currentSlots, slot], timeSlotsOrder);
};
