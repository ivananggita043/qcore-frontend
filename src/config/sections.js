export const SECTIONS = {
  cutting:   { label: "Cutting",   frequency: "daily",  flow: "cutting" },
  sewing:    { label: "Sewing",    frequency: "hourly", flow: "standard" },
  washing:   { label: "Washing",   frequency: "hourly", flow: "standard" },
  finishing: { label: "Finishing", frequency: "daily",  flow: "standard" },
  packing:   { label: "Packing",   frequency: "daily",  flow: "standard" },
};

// 24 jam kerja: slot 00.00 sampai 23.00 (slot terakhir 23.00 – 00.00)
export const WORK_HOURS = { start: 0, end: 24 };

const pad = (n) => String(n).padStart(2, "0");

export const hourSlots = () =>
  Array.from({ length: WORK_HOURS.end - WORK_HOURS.start }, (_, i) => WORK_HOURS.start + i);

export const hourLabel = (h) => `${pad(h)}.00 – ${pad((h + 1) % 24)}.00`;