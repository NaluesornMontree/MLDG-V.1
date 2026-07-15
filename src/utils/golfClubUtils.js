const clubTypeOrder = ['driver', 'hybrid', 'iron', 'putter', 'wedge', 'wood'];

export const normalizeClubTypeDisplay = (value = '') => {
  const rawValue = value.toString().trim();
  return rawValue.toLowerCase() === 'other' ? 'อื่น ๆ' : rawValue;
};

export const getClubName = (data = {}) => (
  data.Club_Name || data.clubName || data.name || 'ไม่ระบุชื่อไม้กอล์ฟ'
);

export const getClubType = (data = {}) => (
  normalizeClubTypeDisplay(data.Club_Type || data.clubType || data.type || 'ไม่ระบุประเภทไม้')
);

export const getClubTotalQty = (data = {}) => Number(
  data.Quantity_Total ?? data.quantityTotal ?? data.totalQty ?? 0
);

export const getClubRepairQty = (data = {}) => Number(
  data.Repair_Club_Total ?? data.repairClubTotal ?? data.repairQty ?? 0
);

export const getClubPrice = (data = {}) => Number(
  data.Price_Rate ?? data.priceRate ?? data.price ?? 0
);

export const getClubTypeRank = (club = {}) => {
  const lowerName = `${getClubType(club)} ${getClubName(club)}`.toLowerCase();
  const rank = clubTypeOrder.findIndex(type => lowerName.includes(type));
  return rank === -1 ? clubTypeOrder.length : rank;
};

export const sortGolfClubsLikeInventory = (clubs = []) => clubs
  .map((club, index) => ({ club, index }))
  .sort((a, b) => {
    const rankDiff = getClubTypeRank(a.club) - getClubTypeRank(b.club);
    if (rankDiff !== 0) return rankDiff;

    const typeDiff = getClubType(a.club).localeCompare(getClubType(b.club), ['en', 'th'], {
      sensitivity: 'base'
    });
    if (typeDiff !== 0) return typeDiff;

    const nameDiff = getClubName(a.club).localeCompare(getClubName(b.club), ['en', 'th'], {
      numeric: true,
      sensitivity: 'base'
    });
    return nameDiff || a.index - b.index;
  })
  .map(({ club }) => club);
