import { Platform } from 'react-native';

const palette = {
  ink: '#1C1F23',
  inkMuted: '#4F5966',
  slate: '#4D5E72',
  slateSoft: '#7B8896',
  accent: '#C08732',
  success: '#2F6E4F',
  background: '#FFFFFF',
  surface: '#F5F6F7',
  border: '#E4E7EC',
  darkBackground: '#0F1217',
  darkSurface: '#151921',
};

export const Palette = palette;

export const Theme = {
  palette,
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 20,
  },
};

export const Colors = {
  light: {
    text: palette.ink,
    background: palette.background,
    tint: palette.slate,
    icon: palette.inkMuted,
    tabIconDefault: palette.inkMuted,
    tabIconSelected: palette.slate,
  },
  dark: {
    text: '#E1E6EE',
    background: palette.darkBackground,
    tint: palette.surface,
    icon: '#A1A9B6',
    tabIconDefault: '#7A8394',
    tabIconSelected: '#FFFFFF',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
