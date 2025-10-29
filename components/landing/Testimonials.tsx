"use client";
import React from 'react';
import { Marquee } from '@/components/ui/marquee';
import { Tweet } from 'react-tweet';

interface TestimonialsProps {
  className?: string;
}

export const Testimonials: React.FC<TestimonialsProps> = ({ className = '' }) => {
  // Array of relevant Twitter/X tweet IDs that you can customize
  // Replace these with actual tweet IDs about your product
  const tweetIds = [
    '1983433254024917384',
    '1983426984094118063',
    '1983433841722437683',
    '1983219728970612809', // Example: Replace with your actual tweet IDs
    '1983182854843760765',
    '1983201545765433515',
    '1983176263885021590',
    '1983201090402431148',
    '1983182111495598535',
    '1983206997794148449',
    '1983167317057118535',
    '1983181826744300006',
    '1983185162986045701',
    '1983192855469535320',
    '1983249882308588021',
    '1983199563428311117',
    '1983177463246258524',
    '1983176857827828209',
  ];

  return (
    <div className={`w-full py-20 relative overflow-hidden ${className}`}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-4">
            What People Are Saying
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See what developers and teams are saying about Doable
          </p>
        </div>

        {/* Marquee with Tweets */}
        <div className="relative">
          {/* Left gradient fade */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background via-background to-transparent z-10 pointer-events-none" />
          
          {/* Right gradient fade */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background via-background to-transparent z-10 pointer-events-none" />
          
          <Marquee pauseOnHover className="[--duration:200s]">
            {tweetIds.map((tweetId, index) => (
              <div key={index} className="mx-3 w-[350px] sm:w-[400px] min-w-[350px] sm:min-w-[400px]">
                <Tweet id={tweetId} />
              </div>
            ))}
          </Marquee>
        </div>

        {/* Reverse Marquee for variety */}
        <div className="relative mt-8">
          {/* Left gradient fade */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background via-background to-transparent z-10 pointer-events-none" />
          
          {/* Right gradient fade */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background via-background to-transparent z-10 pointer-events-none" />
          
          <Marquee reverse pauseOnHover className="[--duration:200s]">
            {tweetIds.slice().reverse().map((tweetId, index) => (
              <div key={`reverse-${index}`} className="mx-3 w-[350px] sm:w-[400px] min-w-[350px] sm:min-w-[400px]">
                <Tweet id={tweetId} />
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    </div>
  );
};

