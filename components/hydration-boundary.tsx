'use client';

import { useEffect, useRef } from 'react';

export function HydrationBoundary({ children }: { children: React.ReactNode }) {
  const cleanedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution
    if (cleanedRef.current) return;
    cleanedRef.current = true;

    // Remove Grammarly and other extension attributes that cause hydration mismatches
    const removeExtensionAttributes = (target: Element) => {
      // Remove Grammarly attributes
      target.removeAttribute('data-gr-ext-installed');
      target.removeAttribute('data-new-gr-c-s-check-loaded');
    };

    // Initial cleanup
    removeExtensionAttributes(document.documentElement);
    removeExtensionAttributes(document.body);

    // Use MutationObserver to catch extensions that inject attributes late
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element;
          const attributeName = mutation.attributeName;
          
          // Only process Grammarly-related attributes
          if (attributeName === 'data-gr-ext-installed' || attributeName === 'data-new-gr-c-s-check-loaded') {
            removeExtensionAttributes(target);
          }
        }

        // Also check added nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            removeExtensionAttributes(element);
          }
        });
      });
    });

    // Observe document changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-gr-ext-installed', 'data-new-gr-c-s-check-loaded'],
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return <>{children}</>;
}
