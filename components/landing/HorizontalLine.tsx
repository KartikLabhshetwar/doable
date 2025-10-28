import React from 'react';

interface HorizontalLineProps {
  className?: string;
}

export const HorizontalLine: React.FC<HorizontalLineProps> = ({ className = '' }) => {
  return (
    <div className={`w-full h-px bg-gray-200 dark:bg-neutral-700 ${className}`} />
  );
};
