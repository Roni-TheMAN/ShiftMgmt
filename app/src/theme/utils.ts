import { Platform, type ViewStyle } from 'react-native';

type ShadowOptions = {
  color: string;
  opacity: number;
  radius: number;
  offsetY: number;
  elevation: number;
  offsetX?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace('#', '').trim();
  const safeAlpha = clamp(alpha, 0, 1);

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  if (!/^[0-9A-Fa-f]{6}$/.test(expanded)) {
    return hexColor;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

export function createShadow({
  color,
  elevation,
  offsetX = 0,
  offsetY,
  opacity,
  radius,
}: ShadowOptions): ViewStyle {
  const baseShadow: ViewStyle = {
    shadowColor: color,
    shadowOffset: {
      width: offsetX,
      height: offsetY,
    },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };

  if (Platform.OS === 'android') {
    return {
      elevation,
      shadowColor: color,
    };
  }

  return baseShadow;
}
