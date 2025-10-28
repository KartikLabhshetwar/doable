"use client";

import React from 'react';

interface HowToUseSectionProps {
  className?: string;
}

export const HowToUseSection: React.FC<HowToUseSectionProps> = ({ className = '' }) => {
  const steps = [
    {
      number: "01",
      title: "Sign Up for Free",
      description: "Create your account in seconds. No credit card required, no hidden fees."
    },
    {
      number: "02", 
      title: "Create Your First Team",
      description: "Set up your team workspace and invite your colleagues to collaborate."
    },
    {
      number: "03",
      title: "Start Managing Tasks",
      description: "Create projects, add tasks, and watch your team's productivity soar."
    }
  ];

  return (
    <div id="how-it-works" className={`py-16 md:py-24 lg:py-32 bg-muted/30 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            How to Get Started
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started with Doable in just three simple steps. No complex setup required!
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-3xl mx-auto">
          <div className="space-y-10">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="flex items-start gap-6 group"
              >
                {/* Step Number */}
                <div className="flex-shrink-0">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full text-xl font-bold group-hover:bg-primary/90 transition-colors">
                    {step.number}
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  {/* Title */}
                  <h3 className="text-2xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed text-base">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
