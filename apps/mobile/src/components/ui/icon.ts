import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** "Forward" in the reading direction (the chevron of a link or a list row). */
export function forwardChevron(isRTL: boolean): IconName {
  return isRTL ? 'chevron-back' : 'chevron-forward';
}

export function forwardArrow(isRTL: boolean): IconName {
  return isRTL ? 'arrow-back' : 'arrow-forward';
}
