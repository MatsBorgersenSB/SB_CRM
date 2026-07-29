/** Niche Channel Radar types — safe for client components. */

export type ChannelCategory = "EXPO" | "ASSOCIATION" | "COMMUNITY" | "REGISTRY";

export type ChannelFocusArea =
  | "METALLURGY"
  | "BATTERY_STORAGE"
  | "CONSTRUCTION"
  | "WATER_TREATMENT"
  | "BIOCHAR_CDR"
  | "FEEDSTOCK";

export type NicheChannel = {
  channelName: string;
  category: ChannelCategory;
  focusArea: ChannelFocusArea;
  relevanceScore: number;
  strategicAdvice: string;
};

export type NicheChannelRadarResult = {
  companyId: string;
  companyName: string;
  channels: NicheChannel[];
  groundedIn: string[];
};

export const FOCUS_AREA_LABELS: Record<ChannelFocusArea, string> = {
  METALLURGY: "Metallurgy & Reductants",
  BATTERY_STORAGE: "Battery & Energy Storage",
  CONSTRUCTION: "Construction & Infrastructure",
  WATER_TREATMENT: "Environmental & Water Treatment",
  BIOCHAR_CDR: "Biochar & CDR",
  FEEDSTOCK: "Feedstock & Biomass",
};

export const CATEGORY_LABELS: Record<ChannelCategory, string> = {
  EXPO: "Expo / Conference",
  ASSOCIATION: "Industry Association",
  COMMUNITY: "Community / Network",
  REGISTRY: "Carbon Registry",
};
