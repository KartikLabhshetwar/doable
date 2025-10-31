"use client";
import React, { useState } from 'react';
import { getVideoUrl, getCloudinaryVideoPoster } from '@/lib/cloudinary';

interface DemoVideoSectionProps {
  videoSrc: string;
  title?: string;
  description?: string;
  className?: string;
  poster?: string;
}

export const DemoVideoSection: React.FC<DemoVideoSectionProps> = ({
  videoSrc='doable',
  title = "See Doable in Action",
  description = "Watch how teams use Doable to manage tasks and collaborate effectively.",
  className = '',
  poster
}) => {
  // Determine local fallback path
  const localPath = videoSrc.startsWith('/') ? videoSrc : `/${videoSrc}.mp4`;
  // Get Cloudinary URL or fallback to local path
  const cloudinaryUrl = getVideoUrl(videoSrc, localPath);
  const [videoSrcUrl, setVideoSrcUrl] = useState(cloudinaryUrl);
  const [hasError, setHasError] = useState(false);
  
  // Generate poster from Cloudinary if not provided (only if Cloudinary is configured)
  const posterUrl = poster || (videoSrc.startsWith('/') ? undefined : getCloudinaryVideoPoster(videoSrc));
  
  // Handle video load error - fallback to local if Cloudinary fails
  const handleVideoError = () => {
    if (!hasError && cloudinaryUrl !== localPath && cloudinaryUrl.includes('cloudinary.com')) {
      // Cloudinary failed, use local fallback
      setVideoSrcUrl(localPath);
      setHasError(true);
    }
  };
  
  return (
    <div id="demo" className={`py-16 md:py-24 lg:py-32 relative ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {description}
          </p>
        </div>

        {/* Video Container */}
        <div className="relative max-w-6xl mx-auto rounded-2xl overflow-hidden border border-border bg-card/50 backdrop-blur-sm shadow-2xl">
          <video
            className="w-full h-auto"
            autoPlay
            muted
            loop
            playsInline
            poster={posterUrl}
            aria-label={`${title} - ${description}`}
            onError={handleVideoError}
            src={videoSrcUrl}
          >
            Your browser does not support the video tag.
          </video>
          
          {/* Gradient overlays for better video integration */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Optional CTA or additional content can go here */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Try Doable free today. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
};

