/**
 * Format labels by removing all whitespace while preserving original casing.
 * Example: "Local Temperature" -> "LocalTemperature".
 */
export function noSpaces(label?: string): string | undefined {
    if (label == null) return label;
    return label.replace(/\s+/g, "");
}
