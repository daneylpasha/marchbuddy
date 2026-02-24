import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface MilestoneIconProps {
  name: string;
  color: string;
  size: number;
}

export const MilestoneIcon: React.FC<MilestoneIconProps> = ({ name, color, size }) => {
  return <Ionicons name={name as React.ComponentProps<typeof Ionicons>['name']} size={size} color={color} />;
};
