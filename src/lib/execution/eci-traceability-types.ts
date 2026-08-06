/** EC&I / P&ID Traceability types — safe for client components. */

export type EciInstrumentType =
  | "TEMPERATURE"
  | "PRESSURE"
  | "GAS_ANALYZER"
  | "VALVE_ACTUATOR"
  | "LEVEL_SENSOR"
  | "FLOW_METER"
  | "SAFETY_SWITCH";

export type EciIoType =
  | "DIGITAL_INPUT"
  | "DIGITAL_OUTPUT"
  | "ANALOG_INPUT"
  | "ANALOG_OUTPUT"
  | "MODBUS_RS485"
  | "PROFINET";

export type EciInstrumentTagRecord = {
  id: string;
  projectId: string;
  tagNumber: string;
  description: string;
  instrumentType: EciInstrumentType;
  ioType: EciIoType;
  exRating: string | null;
  isCalibrated: boolean;
  loopChecked: boolean;
  locationZone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EciReadiness = {
  totalTags: number;
  calibratedPercent: number;
  loopCheckedPercent: number;
  pendingSafetyTags: EciInstrumentTagRecord[];
};

export type EciProjectSummary = {
  projectId: string;
  projectTitle: string;
  tags: EciInstrumentTagRecord[];
  readiness: EciReadiness;
};

export const ECI_INSTRUMENT_TYPE_LABELS: Record<EciInstrumentType, string> = {
  TEMPERATURE: "Temperature",
  PRESSURE: "Pressure",
  GAS_ANALYZER: "Gas Analyzer",
  VALVE_ACTUATOR: "Valve / Actuator",
  LEVEL_SENSOR: "Level Sensor",
  FLOW_METER: "Flow Meter",
  SAFETY_SWITCH: "Safety Switch",
};

export const ECI_IO_TYPE_LABELS: Record<EciIoType, string> = {
  DIGITAL_INPUT: "DI",
  DIGITAL_OUTPUT: "DO",
  ANALOG_INPUT: "AI",
  ANALOG_OUTPUT: "AO",
  MODBUS_RS485: "Modbus RS485",
  PROFINET: "PROFINET",
};

export const ECI_INSTRUMENT_TYPE_OPTIONS: Array<{
  id: EciInstrumentType;
  label: string;
}> = [
  { id: "TEMPERATURE", label: "Temperature" },
  { id: "PRESSURE", label: "Pressure" },
  { id: "GAS_ANALYZER", label: "Gas Analyzer" },
  { id: "VALVE_ACTUATOR", label: "Valves" },
  { id: "LEVEL_SENSOR", label: "Level" },
  { id: "FLOW_METER", label: "Flow" },
  { id: "SAFETY_SWITCH", label: "Safety Switch" },
];

export const ECI_IO_TYPE_OPTIONS: Array<{ id: EciIoType; label: string }> = [
  { id: "ANALOG_INPUT", label: "Analog Input" },
  { id: "ANALOG_OUTPUT", label: "Analog Output" },
  { id: "DIGITAL_INPUT", label: "Digital Input" },
  { id: "DIGITAL_OUTPUT", label: "Digital Output" },
  { id: "MODBUS_RS485", label: "Modbus RS485" },
  { id: "PROFINET", label: "PROFINET" },
];

export const CRITICAL_SAFETY_INSTRUMENT_TYPES: EciInstrumentType[] = [
  "GAS_ANALYZER",
  "SAFETY_SWITCH",
];
