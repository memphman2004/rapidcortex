export type FeatureAddOnRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  unitPrice: number;
  billingCycle: "monthly" | "one_time";
  enabledAt?: string;
  enabledBy?: string;
  status: "enabled" | "disabled";
  serviceCode: string;
};
