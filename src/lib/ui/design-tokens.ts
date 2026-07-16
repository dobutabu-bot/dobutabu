export const v4DesignTokens = {
  colors: {
    background: "var(--v4-bg)",
    backgroundSoft: "var(--v4-bg-soft)",
    ink: "var(--v4-ink)",
    inkStrong: "var(--v4-ink-strong)",
    muted: "var(--v4-muted)",
    surface: "var(--v4-surface)",
    glass: "var(--v4-glass)",
    border: "var(--v4-border)",
    accent: "var(--v4-accent)",
    positive: "var(--v4-positive)",
    negative: "var(--v4-negative)",
    warning: "var(--v4-warning)",
    info: "var(--v4-info)",
    disabled: "var(--v4-disabled)"
  },
  layout: {
    sidebarWidth: "var(--v4-sidebar-width)",
    headerHeight: "var(--v4-header-height)",
    contentMaxWidth: "var(--v4-content-max)",
    touchTarget: "var(--v4-touch-target)"
  },
  radius: {
    card: "var(--v4-radius-card)",
    cardSmall: "var(--v4-radius-card-sm)",
    field: "var(--v4-radius-field)"
  },
  spacing: {
    xs: "var(--v4-space-1)",
    sm: "var(--v4-space-2)",
    md: "var(--v4-space-3)",
    lg: "var(--v4-space-4)",
    xl: "var(--v4-space-6)",
    "2xl": "var(--v4-space-8)",
    "3xl": "var(--v4-space-12)"
  }
} as const;

export type V4Tone = "neutral" | "positive" | "negative" | "warning" | "info";
