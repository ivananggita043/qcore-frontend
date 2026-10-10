export const SECTIONS = {
  cutting:   { label: "Cutting",   frequency: "daily",  flow: "cutting" },
  sewing:    { label: "Sewing",    frequency: "hourly", flow: "standard" },
  washing:   { label: "Washing",   frequency: "hourly", flow: "standard" },
  finishing: { label: "Finishing", frequency: "daily",  flow: "standard" },
};

// Jam kerja: 07.00 sampai 17.00 (slot terakhir 16.00 - 17.00)
export const WORK_HOURS = { start: 7, end: 17 };

const pad = (n) => String(n).padStart(2, "0");

export const hourSlots = () =>
  Array.from({ length: WORK_HOURS.end - WORK_HOURS.start }, (_, i) => WORK_HOURS.start + i);

export const hourLabel = (h) => `${pad(h)}.00 – ${pad(h + 1)}.00`;