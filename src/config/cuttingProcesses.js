export const PANELS = [
  "BACK", "BKYK", "PCT",
  "FRONT", "COLLAR", "PLT",
  "SLEEVE", "CUFF", "TAB",
];

export const CUTTING_PROCESSES = [
  {
    key: "marker",
    label: "MARKER",
    defects: [
      "Overlaping", "Not clear print", "Pattern not same",
      "Wrong qty", "No Allowance/Matching", "Other",
    ],
  },
  {
    key: "fabric",
    label: "FABRIC",
    defects: ["Fabric defect", "Color defect", "Out of shade", "Other"],
  },
  {
    key: "spreading",
    label: "SPREADING",
    defects: [
      "Length Sorter", "Width Sorter", "Weavy",
      "Wrong Side", "Wrong Face Side", "Other",
    ],
  },
  {
    key: "cutting",
    label: "CUTTING",
    defects: [
      "Smaller from patter", "Bigger from pattern", "No notch",
      "Wrong Notch", "Notch to Deep", "Other",
    ],
  },
  {
    key: "fuse",
    label: "FUSE",
    defects: [
      "Bubbling", "Strike-Through", "Not enough againts pattern",
      "Position", "Weaving Defect", "Dirty", "Thread",
      "Delimination", "Other",
    ],
  },
  {
    key: "bundle",
    label: "BUNDLE & NUMBERING",
    defects: ["Wrong Number", "Wrong ticket bundle", "Other"],
  },
];