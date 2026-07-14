// src/styles/theme.js
export const ACCESS_KEYS = { 
  OWNER_KEY: "BOSS_LOEI_2026",
  STAFF_KEY: "STAFF_MLG_123" 
};

export const theme = {
  auth: {
    wrapper: "min-h-screen bg-emerald-900 flex items-center justify-center p-4 font-sans",
    card: "w-full max-w-md bg-white p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl",
    input: "w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl mb-4 outline-none",
    btnPrimary: "w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl"
  },
  checkout: {
    container: "max-w-xl mx-auto p-4 sm:p-8 bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl border-t-[12px] border-emerald-600 mt-4 sm:mt-10 font-sans",
    sectionTitle: "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4",
    row: "flex justify-between items-center py-3 border-b border-slate-50 last:border-0",
    label: "text-slate-600 font-bold text-sm",
    input: "border border-slate-200 rounded-xl w-20 p-2 text-center font-bold",
    pointsBox: "bg-emerald-50 p-6 rounded-3xl border border-emerald-100 my-6",
    totalCard: "bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 my-6 text-center",
    btnPay: "w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-xl mt-4"
  },
  admin: {
    card: "w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 font-sans text-left shadow-sm sm:p-8 overflow-hidden",
    title: "text-xl sm:text-2xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-3 leading-tight",
    inputLabel: "text-xs sm:text-sm font-black uppercase tracking-widest mb-2 sm:mb-3 block ml-1",
    input: "w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 outline-none font-bold text-slate-700",
    
    // --- ระบบค้นหา ---
    searchWrapper: "relative mb-6 sm:mb-10 group",
    searchIcon: "absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-xl text-slate-400 group-focus-within:text-emerald-500 transition-colors",
    searchInput: "w-full pl-10 sm:pl-16 pr-4 sm:pr-6 py-3 sm:py-5 bg-white border-2 border-slate-600 rounded-2xl sm:rounded-[2.5rem] focus:border-emerald-500 shadow-sm outline-none font-bold text-sm sm:text-base text-slate-600 transition-all placeholder:text-slate-300",
    
    // --- การจัดการรายการ (ไม้กอล์ฟ) ---
    itemCard: "p-4 sm:p-6 border-2 border-slate-50 rounded-3xl lg:rounded-[3rem] flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white shadow-sm hover:shadow-md transition-all mb-4",
    itemCardDisabled: "p-4 sm:p-6 border-2 border-slate-100 rounded-3xl lg:rounded-[3rem] flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50 opacity-60 grayscale transition-all mb-4",
    
    // --- สไตล์ส่วนตั้งค่า (Service & Points) ที่เพิ่มใหม่ ---
    sectionWrapper: "grid grid-cols-1 lg:grid-cols-2 gap-10", 
    settingGroup: "bg-slate-50/50 p-4 sm:p-8 rounded-3xl lg:rounded-[3rem] border border-slate-100",
    itemRow: "flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 bg-white rounded-2xl mb-3 shadow-sm border border-slate-50",
    itemRowDisabled: "flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 bg-slate-100 rounded-2xl mb-3 opacity-60 grayscale border border-slate-200",
    textValue: "font-black text-emerald-600 text-lg",
    textDisabled: "font-bold text-slate-400 text-lg",

    // --- ส่วนประกอบปุ่มต่างๆ ---
    qtyWrapper: "flex items-center gap-4 bg-emerald-50 px-4 py-2 rounded-2xl mx-4 border border-emerald-100",
    qtyBtn: "w-8 h-8 bg-white rounded-full flex items-center justify-center font-black shadow-sm active:scale-90",
    btnEmerald: "bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95",
    btnRestore: "bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white px-6 py-3 rounded-2xl font-black text-sm uppercase transition-all active:scale-95",
    btnCancelAction: "bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-6 py-3 rounded-2xl font-black text-sm uppercase transition-all active:scale-95",
    btnAmber: "bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white px-6 py-3 rounded-2xl font-black text-sm transition-all",
    btnSave: "bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase shadow-md transition-all",
    btnCancel: "bg-slate-100 text-slate-500 px-6 py-3 rounded-2xl font-black text-sm uppercase transition-all"
  },
  modal: {
    overlay: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200",
    card: "bg-white w-full max-w-sm rounded-3xl sm:rounded-[3rem] p-5 sm:p-10 shadow-2xl border border-white/20 transform animate-in zoom-in-95 duration-200 max-h-[calc(100vh-1.5rem)] overflow-y-auto",
    iconWrapper: "w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center text-3xl",
    title: "text-2xl font-black text-slate-800 text-center mb-2 tracking-tighter",
    message: "text-slate-500 text-center text-sm font-bold leading-relaxed mb-8",
    btnConfirm: "w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all mb-3",
    btnCancel: "w-full bg-slate-50 text-slate-400 py-4 rounded-2xl font-black active:scale-95 transition-all"
  }
};
