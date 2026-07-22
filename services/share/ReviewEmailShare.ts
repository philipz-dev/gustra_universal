import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import type { Restaurant, Review } from '@/data/types';

function titledRestaurantName(raw: string): string {
  const name = raw.trim() || 'Unknown Restaurant';
  return name
    .split(' ')
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function starsLine(rating: number): string {
  if (rating < 1 || rating > 10) return '';
  const full = Math.floor(rating / 2);
  const half = rating % 2 === 1;
  return `${'★'.repeat(full)}${half ? '½' : ''}`;
}

function buildPlainBody(args: {
  review: Review;
  restaurant: Restaurant;
  sharedBy: string;
}): string {
  const restaurant = titledRestaurantName(args.restaurant.name);
  const lines = [
    `${args.sharedBy} shared a restaurant review`,
    '',
    `My experience at ${restaurant}`,
    args.restaurant.city ? `${args.restaurant.city}` : '',
    '',
  ];

  for (const c of args.review.criteria) {
    if (c.rating < 1 || c.rating > 10) continue;
    lines.push(`${c.title}: ${starsLine(c.rating)}`);
    if (c.comment.trim()) lines.push(c.comment.trim());
    lines.push('');
  }

  if (args.review.generalComment.trim()) {
    lines.push('General comments');
    lines.push(args.review.generalComment.trim());
    lines.push('');
  }

  lines.push('—');
  lines.push('Shared with Gustra · https://gustra.net/#download');
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

function buildHtmlBody(args: {
  review: Review;
  restaurant: Restaurant;
  sharedBy: string;
}): string {
  const restaurant = titledRestaurantName(args.restaurant.name);
  const city = args.restaurant.city.trim();
  const criteriaHtml = args.review.criteria
    .filter((c) => c.rating >= 1 && c.rating <= 10)
    .map((c) => {
      const comment = c.comment.trim()
        ? `<p style="margin:4px 0 12px;color:#23201a;">${escapeHtml(c.comment.trim())}</p>`
        : '';
      return `<p style="margin:0;font-weight:600;color:#244e39;">${escapeHtml(c.title)} — ${escapeHtml(starsLine(c.rating))}</p>${comment}`;
    })
    .join('');

  const general = args.review.generalComment.trim()
    ? `<p style="margin:16px 0 0;"><strong>General comments</strong><br>${escapeHtml(args.review.generalComment.trim())}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#F5EEDD;color:#23201a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">
  <p style="margin:0 0 8px;color:#244e39;font-size:18px;font-weight:600;">${escapeHtml(args.sharedBy)} shared a restaurant review</p>
  <p style="margin:0 0 16px;">My personal review of ${escapeHtml(restaurant)}${city ? ` in ${escapeHtml(city)}` : ''} is below.</p>
  ${criteriaHtml}
  ${general}
  <p style="margin:24px 0 0;font-size:13px;color:rgba(35,32,26,0.65);">
    Shared with <a href="https://gustra.net/" style="color:#244e39;">Gustra</a> ·
    <a href="https://gustra.net/#download" style="color:#244e39;">Download the app</a>
  </p>
</body>
</html>`;
}

/**
 * Share a readable review recommendation via Mail or the system share sheet
 * (Swift visual/email path — text/HTML companion without JPEG snapshot).
 */
export async function shareReviewAsEmail(args: {
  review: Review;
  restaurant: Restaurant;
  sharedBy: string;
}): Promise<void> {
  const subject = `My experience at ${titledRestaurantName(args.restaurant.name)}`;
  const body = buildPlainBody(args);
  const html = buildHtmlBody(args);
  const attachments = args.review.photoUrls
    .filter((uri) => uri.startsWith('file://') || uri.startsWith('/'))
    .slice(0, 3);

  const available = await MailComposer.isAvailableAsync();
  if (available) {
    await MailComposer.composeAsync({
      subject,
      body: Platform.OS === 'ios' ? html : body,
      isHtml: Platform.OS === 'ios',
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Share.share({
      title: subject,
      message: `${subject}\n\n${body}`,
    });
    return;
  }

  throw new Error('Email is not available on this device.');
}
