import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ReportCategory } from '@smart-city/shared';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One icon per shared report category (labels come from the `reportCategory` translations). */
export const CATEGORY_ICONS: Readonly<Record<ReportCategory, IconName>> = {
  pothole: 'construct-outline',
  streetlight: 'bulb-outline',
  garbage: 'trash-outline',
  water_leak: 'water-outline',
  sidewalk: 'walk-outline',
  road: 'car-outline',
  public_infrastructure: 'business-outline',
  noise: 'volume-high-outline',
  other: 'ellipsis-horizontal-circle-outline',
};
