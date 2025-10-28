"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { TextAnimate } from '@/components/ui/text-animate';
import { DotPattern } from '@/components/ui/dot-pattern';

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

interface HeroSectionProps {
  tagline?: string;
  title: string;
  highlightText?: string;
  description: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
  className?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  tagline = "Finally, a task manager that doesn't suck.",
  title = "Modern Team Task Management",
  highlightText = "Modern",
  description = "Built for teams who want to get things done. Clean, fast, and powerful task management with Swiss design principles.",
  primaryButtonText = "Get Started Free",
  primaryButtonHref = "/dashboard",
  secondaryButtonText = "View on GitHub",
  secondaryButtonHref = "https://github.com/KartikLabhshetwar/doable",
  className = '',
}) => {
  return (
    <div className={`min-h-[calc(100vh-10rem)] w-full max-w-7xl mx-auto flex flex-col items-center justify-center px-4 pt-20 pb-10 md:pt-32 md:pb-20 relative ${className}`}>
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 overflow-hidden">
        <DotPattern
          width={24}
          height={24}
          cr={1}
          className="opacity-70 text-gray-300"
          glow={true}
        />
      </div>
      
      {/* Background Effects - Removed purple gradient */}
      
      <div className="relative z-10 text-center w-full">

        {/* Main Title */}
        <h1 className="text-center text-3xl font-light tracking-tight text-foreground md:text-4xl lg:text-6xl mb-6">
          {title.split(' ').map((word, index) => {
            if (highlightText && word.toLowerCase() === highlightText.toLowerCase()) {
              return (
                <span key={index} className="relative inline-block">
                  <TextAnimate
                    by="character"
                    animation="blurInUp"
                    delay={0.2 + (index * 0.1)}
                    duration={0.4}
                    className="inline text-primary"
                  >
                    {word}
                  </TextAnimate>
                </span>
              );
            }
            return (
              <TextAnimate
                key={index}
                by="character"
                animation="blurInUp"
                delay={0.2 + (index * 0.1)}
                duration={0.4}
                className="inline"
              >
                {word}
              </TextAnimate>
            );
          }).reduce((prev: (React.ReactElement | string)[], curr, index) => {
            return index === 0 ? [curr] : [...prev, ' ', curr];
          }, [] as (React.ReactElement | string)[])}
        </h1>
        
        {/* Description */}
        <p className="text-center text-sm font-medium tracking-tight text-muted-foreground md:text-sm lg:text-base mx-auto mt-6 max-w-lg mb-12">
          <TextAnimate
            by="word"
            animation="fadeIn"
            delay={0.8}
            duration={0.6}
            className="inline"
            as="span"
          >
            {description}
          </TextAnimate>
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Button
            size="lg"
            className="group px-8 py-4 text-lg font-medium bg-primary hover:bg-primary/90"
            asChild
          >
            <a href={primaryButtonHref}>
              {primaryButtonText}
            </a>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
              className="group px-6 py-4 text-lg font-medium bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800 transition-all duration-300 hover:scale-105"
              asChild
            >
            <a href="https://github.com/KartikLabhshetwar/doable" target="_blank" rel="noopener noreferrer">
              Open Source
              <GitHubIcon />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};