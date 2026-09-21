"use client";

import { ClockFormatPicker } from "@/components/ui/clock-format-picker";
import { FontPicker } from "@/components/ui/font-picker";
import { FontSizePicker } from "@/components/ui/font-size-picker";
import { TextColorPicker } from "@/components/ui/text-color-picker";

/** Font family, size, clock format, and user text colors — shared dashboard header cluster. */
export function DashboardTypographyControls() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ClockFormatPicker />
      <FontPicker />
      <FontSizePicker />
      <TextColorPicker />
    </div>
  );
}
