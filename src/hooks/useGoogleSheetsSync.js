import { useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { triggerGoogleSheetsSync } from '../services/googleSheetsSync';

/**
 * React hook that monitors Firestore inventory/items changes and
 * triggers Google Sheets sync with a 2-second debounce.
 * 
 * On mobile there's no multi-tab concern, so we skip leader election
 * (unlike the website which uses BroadcastChannel). The mobile app is
 * always the sole sync source when this hook is active.
 * 
 * Mirrors the website's useGoogleSheetsSync hook behavior.
 */
export const useGoogleSheetsSync = () => {
  const debounceTimerRef = useRef(null);

  // Periodic fallback sync (every 20 mins)
  useEffect(() => {
    const interval = setInterval(() => {
      triggerGoogleSheetsSync();
    }, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor Firestore changes (2-second debounce)
  useEffect(() => {
    let itemsLoaded = false;
    let invsLoaded = false;

    const handleDataChange = () => {
      if (!itemsLoaded || !invsLoaded) return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        triggerGoogleSheetsSync();
      }, 2000);
    };

    const unsubInvs = onSnapshot(collection(db, 'inventories'), () => {
      if (!invsLoaded) {
        invsLoaded = true;
      } else {
        handleDataChange();
      }
    });

    const unsubItems = onSnapshot(collection(db, 'items'), () => {
      if (!itemsLoaded) {
        itemsLoaded = true;
      } else {
        handleDataChange();
      }
    });

    return () => {
      unsubInvs();
      unsubItems();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);
};
