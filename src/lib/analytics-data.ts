export type AnalyticsInsights = {
  systemYieldEfficiency: string;
  facilityConversionRate: string;
  aiMetadataMatchRate: string;
};

export type FeedstockStream = {
  material: string;
  trackingVolume: string;
  stabilityIndex: number;
};

export type AnalyticsDb = {
  insights: AnalyticsInsights;
  feedstockStreams: FeedstockStream[];
};

export const defaultAnalytics: AnalyticsDb = {
  insights: {
    systemYieldEfficiency: "91.8% Average",
    facilityConversionRate: "+4.2% MoM growth",
    aiMetadataMatchRate: "94.6% Auto-Parsed",
  },
  feedstockStreams: [
    {
      material: "HDPE",
      trackingVolume: "1,240 kg/h",
      stabilityIndex: 0.94,
    },
    {
      material: "Mixed Plastics",
      trackingVolume: "2,100 kg/h",
      stabilityIndex: 0.88,
    },
    {
      material: "Textile",
      trackingVolume: "860 kg/h",
      stabilityIndex: 0.92,
    },
  ],
};
