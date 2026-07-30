import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { useCriteriaSettings } from '@/context/CriteriaSettings';

/**
 * Routes first-time users to criteria setup until they finish personalizing.
 */
export function CriteriaSetupGate() {
  const { ready, setupCompleted } = useCriteriaSettings();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready || setupCompleted) return;
    if (segments[0] === 'criteria-setup') return;
    router.replace('/criteria-setup');
  }, [ready, router, segments, setupCompleted]);

  return null;
}
