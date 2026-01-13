// Em src/hooks/useExternalScript.js
import { useState, useEffect } from 'react';

export const useExternalScript = (url) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!url) return;

    // Verifica se o script já existe para não carregar de novo
    if (document.querySelector(`script[src="${url}"]`)) {
      // Tenta verificar se o objeto global já está disponível
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
      // Adiciona um pequeno delay para garantir que o objeto global foi anexado
      setTimeout(() => setIsReady(true), 50);
    };
    script.onerror = () => setIsReady(false);

    document.body.appendChild(script);

    return () => {
      // Opcional: remover o script ao desmontar
      // document.body.removeChild(script);
    };
  }, [url]);

  return isReady;
};
