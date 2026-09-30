"use client";

import { ClockFormatPicker } from "@/components/ui/clock-format-picker";
import { DashboardHeaderClock } from "@/components/ui/dashboard-header-clock";
import { FontPicker } from "@/components/ui/font-picker";
import { FontSizePicker } from "@/components/ui/font-size-picker";
import { TextColorPicker } from "@/components/ui/text-color-picker";

/** Live clock, format, font family/size, and user text colors — shared dashboard header cluster. */
export function DashboardTypographyControls() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DashboardHeaderClock />
      <ClockFormatPicker />
      <FontPicker />
      <FontSizePicker />
      <TextColorPicker />
    </div>
  );
}
