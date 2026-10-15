import { I18nManager, Platform, type ViewStyle } from 'react-native';

export type Direction = 'ltr' | 'rtl';

export function honoursDirectionProp(): boolean {
  if (Platform.OS !== 'android') return true;
  const scope = globalThis as { nativeFabricUIManager?: unknown };
  return scope.nativeFabricUIManager !== undefined && scope.nativeFabricUIManager !== null;
}

export function rowStyle(direction: Direction): ViewStyle {
  if (honoursDirectionProp()) return { flexDirection: 'row', direction };
  const base: Direction = I18nManager.isRTL ? 'rtl' : 'ltr';
  return { flexDirection: direction === base ? 'row' : 'row-reverse' };
}
