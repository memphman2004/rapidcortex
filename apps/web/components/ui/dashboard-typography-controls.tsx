"use client";

import { FontPicker } from "@/components/ui/font-picker";
import { FontSizePicker } from "@/components/ui/font-size-picker";
import { TextColorPicker } from "@/components/ui/text-color-picker";

/** Font family, size, and user text colors — shared dashboard header cluster. */
export function DashboardTypographyControls() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <FontPicker />
      <FontSizePicker />
      <TextColorPicker />
    </div>
  );
}
