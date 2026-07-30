import MaterialIcons from '@expo/vector-icons/MaterialIcons';

/** Icons shared by review form + criteria setup. */
export function criterionIcon(id: string): {
  ios: string;
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
    default:
      return { ios: 'star.circle.fill', android: 'star' };
  }
}
