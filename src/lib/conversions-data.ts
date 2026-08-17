export type ConversionBatchStatus = "active" | "success" | "pending" | "error";

export type ConversionBatch = {
  id: string;
  feedstock: string;
  throughput: string;
  status: ConversionBatchStatus;
};

export type MonthlyFacilityLoad = {
  facility: string;
  load: number;
};

export type MonthlyConversion = {
  label: string;
  facilities: MonthlyFacilityLoad[];
};

/** Production-safe empty conversions — hardcoded facility loads are local/CI only. */
export const emptyConversionMetrics = {
  totalPolymerProcessed: "—",
  oilCharYield: "—",
  systemUptime: "—",
} as const;

export const conversionMetrics = {
  totalPolymerProcessed: "4,762 metric tons",
  oilCharYield: "88.4% Average",
  systemUptime: "96.2%",
} as const;

export const monthlyConversions: MonthlyConversion[] = [
  {
    label: "Jul",
    facilities: [
      { facility: "Thermal", load: 88 },
      { facility: "Fiber", load: 62 },
      { facility: "Regrind", load: 74 },
    ],
  },
  {
    label: "Aug",
    facilities: [
      { facility: "Thermal", load: 91 },
      { facility: "Fiber", load: 58 },
      { facility: "Regrind", load: 80 },
    ],
  },
  {
    label: "Sep",
    facilities: [
      { facility: "Thermal", load: 84 },
      { facility: "Fiber", load: 71 },
      { facility: "Regrind", load: 69 },
    ],
  },
  {
    label: "Oct",
    facilities: [
      { facility: "Thermal", load: 93 },
      { facility: "Fiber", load: 66 },
      { facility: "Regrind", load: 85 },
    ],
  },
  {
    label: "Nov",
    facilities: [
      { facility: "Thermal", load: 79 },
      { facility: "Fiber", load: 54 },
      { facility: "Regrind", load: 72 },
    ],
  },
  {
    label: "Dec",
    facilities: [
      { facility: "Thermal", load: 86 },
      { facility: "Fiber", load: 61 },
      { facility: "Regrind", load: 77 },
    ],
  },
  {
    label: "Jan",
    facilities: [
      { facility: "Thermal", load: 90 },
      { facility: "Fiber", load: 68 },
      { facility: "Regrind", load: 82 },
    ],
  },
  {
    label: "Feb",
    facilities: [
      { facility: "Thermal", load: 87 },
      { facility: "Fiber", load: 63 },
      { facility: "Regrind", load: 76 },
    ],
  },
  {
    label: "Mar",
    facilities: [
      { facility: "Thermal", load: 95 },
      { facility: "Fiber", load: 70 },
      { facility: "Regrind", load: 88 },
    ],
  },
  {
    label: "Apr",
    facilities: [
      { facility: "Thermal", load: 92 },
      { facility: "Fiber", load: 67 },
      { facility: "Regrind", load: 84 },
    ],
  },
  {
    label: "May",
    facilities: [
      { facility: "Thermal", load: 89 },
      { facility: "Fiber", load: 72 },
      { facility: "Regrind", load: 81 },
    ],
  },
  {
    label: "Jun",
    facilities: [
      { facility: "Thermal", load: 94 },
      { facility: "Fiber", load: 65 },
      { facility: "Regrind", load: 86 },
    ],
  },
];

export const conversionBatches: ConversionBatch[] = [
  {
    id: "CV-2406",
    feedstock: "HDPE Batch A",
    throughput: "1,240 kg/h",
    status: "active",
  },
  {
    id: "CV-2405",
    feedstock: "Textile Stream 3",
    throughput: "860 kg/h",
    status: "success",
  },
  {
    id: "CV-2404",
    feedstock: "Mixed Plastics",
    throughput: "2,100 kg/h",
    status: "active",
  },
  {
    id: "CV-2403",
    feedstock: "PET Pre-sort",
    throughput: "540 kg/h",
    status: "pending",
  },
  {
    id: "CV-2402",
    feedstock: "PP Reclaim",
    throughput: "0 kg/h",
    status: "error",
  },
  {
    id: "CV-2401",
    feedstock: "LDPE Film Waste",
    throughput: "980 kg/h",
    status: "success",
  },
  {
    id: "CV-2400",
    feedstock: "Automotive Shred",
    throughput: "1,420 kg/h",
    status: "active",
  },
  {
    id: "CV-2399",
    feedstock: "Ocean-Bound PET",
    throughput: "720 kg/h",
    status: "success",
  },
];
