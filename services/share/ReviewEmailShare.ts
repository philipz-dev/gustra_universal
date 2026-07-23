import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import type { Restaurant, Review } from '@/data/types';
import {
  emailSubject,
  makeCompanionHTML,
  resolvedIntroMessage,
} from '@/services/share/ReviewEmailHTML';
import {
  attachmentFileName,
  buildEmailCardProps,
  captureReviewEmailJPEG,
} from '@/services/share/ReviewEmailSnapshot';

/**
 * Share a visual recommendation: companion HTML + JPEG card attachment
 * (Swift emailHTML path via `ReviewEmailSnapshotService` + `ReviewEmailHTMLBuilder`).
 */
export async function shareReviewAsEmail(args: {
  review: Review;
  restaurant: Restaurant;
  sharedBy: string;
  enabledCriteria: { id: string; title: string }[];
  /** Optional personal message for the HTML intro (Swift message sheet). */
  personalMessage?: string;
  /** Fired once the JPEG is ready, before Mail opens (dismiss preparing UI). */
  onSnapshotReady?: () => void;
}): Promise<void> {
  const sharedBy = args.sharedBy.trim();
  if (!sharedBy) {
    throw new Error('Your name is included when you share reviews.');
  }

  const introMessage = resolvedIntroMessage(
    sharedBy,
    args.personalMessage ?? '',
  );
  const subject = emailSubject(args.restaurant);
  const html = makeCompanionHTML({
    review: args.review,
    restaurant: args.restaurant,
    sharedBy,
    introMessage,
  });
  const card = buildEmailCardProps({
    review: args.review,
    restaurant: args.restaurant,
    sharedBy,
    enabledCriteria: args.enabledCriteria,
  });
  const fileName = attachmentFileName(args.restaurant.name);

  let jpegUri: string;
  try {
    jpegUri = await captureReviewEmailJPEG({ card, fileName });
  } catch {
    throw new Error(
      'Could not create the visual recommendation. Please try again.',
    );
  }

  args.onSnapshotReady?.();

  const available = await MailComposer.isAvailableAsync();
  if (available) {
    await MailComposer.composeAsync({
      subject,
      body: html,
      isHtml: true,
      attachments: [jpegUri],
    });
    return;
  }

  // Fallback: share the JPEG (+ plain intro) when Mail is unavailable.
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(jpegUri, {
      mimeType: 'image/jpeg',
      dialogTitle: subject,
      UTI: 'public.jpeg',
    });
    return;
  }

  await Share.share({
    title: subject,
    message:
      Platform.OS === 'ios'
        ? `${introMessage}\n\nMy personal review of ${card.restaurantName} is below.`
        : `${introMessage}\n\n${jpegUri}`,
    url: Platform.OS === 'ios' ? jpegUri : undefined,
  });
}
