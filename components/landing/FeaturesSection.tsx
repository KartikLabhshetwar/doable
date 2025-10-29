import React from 'react';
import { FeatureCardsBento } from './FeatureCardsBento';

interface FeaturesSectionProps {
  className?: string;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ className = '' }) => {
  return <FeatureCardsBento />;
};
