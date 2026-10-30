export const BACK_TO_LINE = {
  areas: [
    "NECK/COLLAR", "SHOULDER", "ARMHOLE", "SLEEVE", "CUFF", "SLIT/VENT",
    "SLEEVE HEMMING", "BOTTOM HEMMING", "LINING", "FRONT/PLACKET", "OVERLOCK",
    "SIDE SEAM", "POCKET", "LABEL", "YOKE", "BACK BODY", "PLEAT/CUP NAT",
    "ZIPPER", "WAIST", "BLINSTITCH", "LOOP/RIBBON", "EMBROIDERY", "COMBO",
    "FRONT RISE", "BACK RISE", "PIPING", "BARTACK", "TACKING", "STAIN",
    "TRIMMING", "BUTTON", "ASCOLATE", "BUTTON HOLE", "SHADING", "SIZE SPEC",
    "YARNPULL", "HOLE",
  ],
  types: [
    "BROKEN STITCH", "DIMPLE", "EXPOSED", "FULLNESS", "GAPING OPEN", "HIGH-LOW",
    "HIKING", "LOOSE STITCH", "MISS PLACED", "MISSING", "NEEDLE CHEW", "NEEDLE HOLE",
    "NOT CENTER", "PLEATED", "POOR SHAPE", "PUCKERING" ,"PULLING OUT", "RAW EDGE",
    "ROLLING OUT", "RUN OF STITCH", "SKIP STITCH", "SLANTED", "TWISTED",
    "UNBALANCE", "UNEVEN", "UNFULL STITCH", "UNKISSING", "UNMATCH",
    "UNREMOVED STITCH", "UNSTRAIGHT", "VISIBLE STITCH", "WRONG DIRECTION",
    "WRONG LABEL",
  ],
};

// Kategori yang hanya punya defect type (tanpa area)
export const TYPE_ONLY = {
  TRIMMING: ["UNCUT_THREAD", "FRAYING"],
  STAIN: ["LINGKUNGAN", "OIL STAIN", "STREAK MARK", "CHEMICAL STAIN"],
  "FABRIC DEF": [
    "SLUB", "MISSING YARN", "KNOT", "FOREIGN YARN", "DOT STAIN", "THICK PICK",
    "LINE MARK", "HEAVY CREASE", "WHITE SPOT", "MISS PRINT",
  ],
  OTHERS: ["YARNPULL", "HOLE", "SHADING", "SIZE SPEC (+,- WRONG SIZE)", "OTHER"],
};

// Tab tambahan khusus section tertentu
export const SECTION_EXTRA = {
  washing: {
    label: "WASHING",
    types: ["HANDFEEL OOT", "COLOR OR BLEEDING", "OUT OF SHADE", "ODOR", "ABRASION"],
  },
  finishing: {
    label: "FINISHING",
    types: ["IRONING", "FOLDING", "HANDMADE"],
  },
};

export function categoriesFor(section) {
  const list = [
    {
      key: "BACK TO LINE",
      label: "BACK TO LINE",
      kind: "areaType",
      areas: BACK_TO_LINE.areas,
      types: BACK_TO_LINE.types,
    },
    ...Object.entries(TYPE_ONLY).map(([label, types]) => ({
      key: label, label, kind: "type", types,
    })),
  ];
  const extra = SECTION_EXTRA[section];
  if (extra) list.push({ key: extra.label, label: extra.label, kind: "type", types: extra.types });
  return list;
}