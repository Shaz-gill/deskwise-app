import { useCallback, useState } from 'react';

const STORAGE_KEY = 'deskwise-theme';

function getIsDark() {
   return document.documentElement.classList.contains('dark');
}

// Initial state is read from the DOM rather than localStorage/matchMedia —
// the inline script in index.html already set the class pre-paint, so this
// avoids the two ever disagreeing.
export function useDarkMode() {
   const [isDark, setIsDark] = useState(getIsDark);

   const toggle = useCallback(() => {
      setIsDark((prev) => {
         const next = !prev;
         document.documentElement.classList.toggle('dark', next);
         localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
         return next;
      });
   }, []);

   return { isDark, toggle };
}
