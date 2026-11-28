// The text tools' output formats, from @xena-tools/mc-text, as picker options.
// Kept apart from FormatPicker so tools that don't write game text (Startup
// Flags, Server Status, the Log Analyzer) don't load mc-text for its labels.

import { OUTPUT_FORMATS, type OutputFormat } from "@xena-tools/mc-text";
import type { FormatOption } from "../components/FormatPicker";

export const TEXT_FORMATS: FormatOption<OutputFormat>[] = OUTPUT_FORMATS.map((f) => ({
  id: f.id,
  label: f.label,
  usedBy: f.usedBy,
}));

export const isOutputFormat = (v: string | null): v is OutputFormat =>
  OUTPUT_FORMATS.some((f) => f.id === v);
