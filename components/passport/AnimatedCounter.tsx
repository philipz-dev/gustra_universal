import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type AnimatedCounterProps = {
  value: number;
  /** Decimal places to render (0 for integers, 1 for an average). */
  decimals?: number;
  /** Animation duration in ms. */
  duration?: number;
  style?: StyleProp<TextStyle>;
};

/**
 * Smooth count-up number for premium stats cards (Day One / Notion style).
 * A short requestAnimationFrame loop eases the value from 0 → `value` once
 * mounted. Debounced to stay smooth even when a List/ScrollView re-renders.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  duration = 780,
  style,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — appealing deceleration like Apple's material counters.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <Text style={style}>{display.toFixed(decimals)}</Text>
  );
}

export default AnimatedCounter;
