import { useEffect, useRef } from 'react';

/**
 * Tracks scroll depth and pushes events to GTM dataLayer.
 * Includes scroll_percentage, page_type, and user_email for every event.
 * 
 * @param {number[]} thresholds - Array of scroll percentage thresholds.
 * @param {object} options - { pageType: string, userEmail: string }
 */
export function useScrollTracking(thresholds = [25, 50, 75, 100], options = {}) {
  const triggeredThresholds = useRef(new Set());
  const gtmReadyRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const waitForGTM = () => {
      return new Promise((resolve) => {
        if (window.google_tag_manager && window.dataLayer) {
          resolve(true);
          return;
        }
        let attempts = 0;
        const maxAttempts = 100;
        const interval = setInterval(() => {
          attempts++;
          if (window.google_tag_manager && window.dataLayer) {
            clearInterval(interval);
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
      });
    };

    const handleScroll = () => {
      if (!gtmReadyRef.current) return;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight === 0) return;
      const scrollPercentage = Math.round((scrollTop / scrollHeight) * 100);

      thresholds.forEach((threshold) => {
        if (scrollPercentage >= threshold && !triggeredThresholds.current.has(threshold)) {
          triggeredThresholds.current.add(threshold);

          window.dataLayer.push({
            event: "scroll_depth",
            scroll_percentage: threshold,
            page_type: options.pageType || "product",
            user_email: options.userEmail || null,
          });
        }
      });
    };

    waitForGTM().then((isReady) => {
      gtmReadyRef.current = isReady;
      if (isReady) {
        window.addEventListener("scroll", handleScroll, { passive: true });
        setTimeout(() => handleScroll(), 500);
      }
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [thresholds, options.pageType, options.userEmail]);
}
