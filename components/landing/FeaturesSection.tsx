import React from 'react';
import FeaturesSectionDemo from '@/components/features-section-demo-1';

interface FeaturesSectionProps {
  className?: string;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ className = '' }) => {
  return <FeaturesSectionDemo />;
};
