"use client";
import React, { useRef, useState, useEffect } from 'react';
import { getVideoUrl } from '@/lib/cloudinary';

interface FeatureCard {
  title: string;
  description: string;
  videoSrc: string;
}

const features: FeatureCard[] = [
  {
    title: "Doable AI",
    description: "Create an issue using Doable AI. Our AI assistant understands context and helps you get things done faster.",
    videoSrc: "feature-1-doable",
  },
  {
    title: "Assign issues to team members",
    description: "You can list all issues and assign them to team members.",
    videoSrc: "feature-2-doable",
  },
  {
    title: "Delete issues",
    description: "You can delete issues using Doable AI.",
    videoSrc: "feature-3-doable",
  },
  {
    title: "Create projects",
    description: "You can create your projects using Doable AI",
    videoSrc: "feature-5-doable",
  },
  {
    title: "Invite team members",
    description: "You can invite team members using Doable AI.",
    videoSrc: "feature-4-doable",
  },
];

export const FeatureCardsBento: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Track which videos have failed to load from Cloudinary
  const [failedVideos, setFailedVideos] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Play the active video
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === activeIndex) {
          video.play().catch(() => {
            // Auto-play was prevented, which is fine
          });
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });
  }, [activeIndex]);

  // Detect which card is currently visible when scrolling manually
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(containerCenter - cardCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveIndex((prevIndex) => {
        if (closestIndex !== prevIndex) {
          return closestIndex;
        }
        return prevIndex;
      });
    };

    // Use Intersection Observer to detect visible cards
    const observerOptions = {
      root: container,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0.5,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = cardRefs.current.indexOf(entry.target as HTMLDivElement);
          if (index !== -1) {
            setActiveIndex((prevIndex) => {
              if (index !== prevIndex) {
                return index;
              }
              return prevIndex;
            });
          }
        }
      });
    }, observerOptions);

    // Observe all cards
    const cards = cardRefs.current;
    cards.forEach((card) => {
      if (card) observer.observe(card);
    });

    // Listen to scroll events
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const handleVideoEnd = (index: number) => {
    // Move to next feature when video ends
    const nextIndex = (index + 1) % features.length;
    setActiveIndex(nextIndex);
    
    // Scroll to next feature smoothly
    if (containerRef.current) {
      const nextCard = containerRef.current.children[nextIndex] as HTMLElement;
      if (nextCard) {
        nextCard.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  };

  // Handle video load error - fallback to local if Cloudinary fails
  const handleVideoError = (index: number, feature: FeatureCard) => {
    if (!failedVideos.has(index)) {
      const video = videoRefs.current[index];
      if (video) {
        const cloudinaryUrl = getVideoUrl(feature.videoSrc, `/${feature.videoSrc}.mp4`);
        const localPath = `/${feature.videoSrc}.mp4`;
        // Only fallback if it was trying to load from Cloudinary
        if (cloudinaryUrl.includes('cloudinary.com') && cloudinaryUrl !== localPath) {
          video.src = localPath;
          video.load(); // Reload with local source
          setFailedVideos(prev => new Set([...prev, index]));
        }
      }
    }
  };

  return (
    <div id="features" className="py-20 lg:py-40 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Powerful features, beautiful design
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Everything you need to manage tasks efficiently, collaborate effectively, and ship faster.
          </p>
        </div>
        
        {/* Horizontal Scrollable Container */}
        <div 
          ref={containerRef}
          className="flex gap-8 overflow-x-auto snap-x snap-mandatory pb-8 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              className="flex-shrink-0 w-full md:w-[90%] lg:w-[85%] snap-center"
            >
              <div className="group relative bg-gradient-to-b from-card to-card/50 rounded-2xl border border-border overflow-hidden backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
                <div className="flex flex-col md:flex-row">
                  {/* Video Container - Left/Top */}
                  <div className="relative w-full md:w-3/5 min-h-[450px] md:min-h-[550px] lg:min-h-[650px] bg-card flex-shrink-0 flex items-center justify-center p-4">
                    <video
                      ref={(el) => {
                        videoRefs.current[index] = el;
                      }}
                      className="w-full h-full max-w-full max-h-full object-contain rounded-lg"
                      autoPlay
                      muted
                      loop={false}
                      playsInline
                      onEnded={() => handleVideoEnd(index)}
                      onError={() => handleVideoError(index, feature)}
                      aria-label={`${feature.title} - ${feature.description}`}
                      src={failedVideos.has(index) 
                        ? `/${feature.videoSrc}.mp4` 
                        : getVideoUrl(feature.videoSrc, `/${feature.videoSrc}.mp4`)
                      }
                    >
                      Your browser does not support the video tag.
                    </video>
                    
                    {/* Subtle border glow effect */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  </div>
                  
                  {/* Text Content - Right/Bottom */}
                  <div className="flex flex-col justify-center w-full md:w-2/5 p-8 md:p-12 bg-card/50 backdrop-blur-sm min-h-[450px] md:min-h-[550px] lg:min-h-[650px]">
                    <div className="mb-4">
                      <span className="text-sm font-medium text-primary/60 mb-2 block">
                        Feature {index + 1} of {features.length}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-4 text-foreground group-hover:text-primary transition-colors duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                    
                    {/* Progress Indicators */}
                    <div className="flex gap-2 mt-8">
                      {features.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i === index
                              ? 'bg-primary'
                              : i < index
                              ? 'bg-primary/40'
                              : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-card/50 backdrop-blur-sm text-sm font-medium text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>All features included in the free plan</span>
          </div>
        </div>
      </div>
    </div>
  );
};

