import type { CSSProperties } from "react";

// The global theme gives every Button a blue background, which clashes with outline/default/subtle variants.
export const plainButtonStyle: CSSProperties = { background: "transparent" };
export const headerButtonStyle: CSSProperties = {
  background: "transparent",
  color: "var(--mantine-color-white)",
  border: "1px solid var(--mantine-color-white)",
};
