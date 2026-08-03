import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SFSymbol } from 'expo-symbols';

/** Icons shared by review form + criteria setup. */
export function criterionIcon(id: string): {
  ios: SFSymbol;
  android: keyof typeof MaterialIcons.glyphMap;
} {
  switch (id) {
    case 'food':
      return { ios: 'fork.knife', android: 'local-dining' };
    case 'drinks':
      return { ios: 'mug.fill', android: 'local-cafe' };
    case 'wines':
      return { ios: 'wineglass', android: 'local-bar' };
    case 'service':
      return { ios: 'person.2.fill', android: 'groups' };
    case 'setting':
      return { ios: 'sofa.fill', android: 'chair' };
    case 'valueForMoney':
      return { ios: 'tag.fill', android: 'sell' };
    case 'quality':
      return { ios: 'star.circle.fill', android: 'workspace-premium' };
    case 'freshness':
      return { ios: 'leaf.fill', android: 'eco' };
    case 'variety':
      return { ios: 'square.grid.2x2.fill', android: 'grid-view' };
    case 'portions':
      return { ios: 'scalemass.fill', android: 'scale' };
    case 'presentation':
      return { ios: 'rectangle.3.group.fill', android: 'breakfast-dining' };
    case 'comfort':
      return { ios: 'chair.fill', android: 'weekend' };
    case 'speed':
      return { ios: 'timer', android: 'timer' };
    case 'expertise':
      return { ios: 'graduationcap.fill', android: 'school' };
    case 'timing':
      return { ios: 'clock.fill', android: 'schedule' };
    case 'hygiene':
      return { ios: 'hands.and.sparkles.fill', android: 'clean-hands' };
    case 'reception':
      return { ios: 'figure.wave', android: 'waving-hand' };
    case 'familyFriendly':
      return { ios: 'figure.2.and.child.holdinghands', android: 'family-restroom' };
    case 'dietary':
      return { ios: 'leaf.circle.fill', android: 'spa' };
    case 'acoustics':
      return { ios: 'speaker.wave.2.fill', android: 'volume-up' };
    case 'accessibility':
      return { ios: 'figure.roll', android: 'accessible' };
    default:
      return { ios: 'star.circle.fill', android: 'star' };
  }
}
