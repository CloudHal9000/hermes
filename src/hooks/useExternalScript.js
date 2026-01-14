import { useState, useEffect } from 'react';

export const useExternalScript = (url) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!url) return;

    if (document.querySelector(`script[src="${url}"]`)) {

      const checkGlobal = setInterval(() => {
        if (window.ROSLIB) {
          setIsReady(true);
          clearInterval(checkGlobal);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => {

      setTimeout(() => setIsReady(true), 50);
    };
    script.onerror = () => setIsReady(false);

    document.body.appendChild(script);

    return () => {

    };
  }, [url]);

  return isReady;
};
