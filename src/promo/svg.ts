import type React from 'react';

export type SvgComponent = React.ComponentType<Record<string, unknown>>;

export interface SvgModule {
  Svg: SvgComponent;
  Path: SvgComponent;
}

export function optionalSvg(): SvgModule | null {
  try {
    const mod = require('react-native-svg') as { Svg?: unknown; Path?: unknown; default?: unknown } | null;
    const Svg = mod?.Svg ?? mod?.default;
    const Path = mod?.Path;
    if (!Svg || !Path) return null;
    return { Svg: Svg as SvgComponent, Path: Path as SvgComponent };
  } catch {
    return null;
  }
}
