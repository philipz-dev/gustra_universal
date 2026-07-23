import type { Restaurant, Review } from '@/data/types';

const CREAM = '#F5EEDD';
const FOREST = '#244e39';
const INK = '#23201a';
const DOWNLOAD_URL = 'https://gustra.net/#download';
const SITE_URL = 'https://gustra.net/';

export function titledRestaurantName(raw?: string | null): string {
  const name = (raw ?? 'Unknown Restaurant').trim();
  if (!name) return 'Unknown Restaurant';
  return name
    .split(' ')
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function experienceLine(restaurantName: string): string {
  return `My experience at ${titledRestaurantName(restaurantName)}`;
}

export function emailSubject(restaurant: Restaurant): string {
  return experienceLine(restaurant.name);
}

export function defaultIntroMessage(sharedBy: string): string {
  return `${sharedBy} shared a restaurant review`;
}

export function resolvedIntroMessage(
  sharedBy: string,
  customMessage: string,
): string {
  const trimmed = customMessage.trim();
  return trimmed.length === 0 ? defaultIntroMessage(sharedBy) : trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlIntroMarkup(introMessage: string, sharedBy: string): string {
  const name = sharedBy.trim();
  if (!name || !introMessage.startsWith(name)) {
    return escapeHtml(introMessage);
  }
  const rest = introMessage.slice(name.length);
  return `<strong style="color:${FOREST};">${escapeHtml(name)}</strong>${escapeHtml(rest)}`;
}

/**
 * Short HTML companion (Swift `ReviewEmailHTMLBuilder.makeCompanionHTML`).
 * Green footer lives in the JPEG, not here.
 */
export function makeCompanionHTML(args: {
  review: Review;
  restaurant: Restaurant;
  sharedBy: string;
  introMessage: string;
}): string {
  const city = args.restaurant.city.trim();
  const restaurant = titledRestaurantName(args.restaurant.name);
  const preheader = escapeHtml(
    `${args.sharedBy} shared a Gustra review of ${restaurant}${
      city ? ` in ${city}` : ''
    } — making food memories.`,
  );
  const introHTML = htmlIntroMarkup(args.introMessage, args.sharedBy);
  const reviewBelow = escapeHtml(
    `My personal review of ${restaurant} is below.`,
  );
  const lang =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0] || 'en'
      : 'en';

  return `<!DOCTYPE html>
<html lang="${lang}" bgcolor="${CREAM}" style="background-color:${CREAM} !important;margin:0;padding:0;height:100%;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Share review</title>
  <style type="text/css">
    html, body { background-color: ${CREAM} !important; margin: 0 !important; padding: 0 !important; }
  </style>
</head>
<body bgcolor="${CREAM}" style="margin:0;padding:0;background-color:${CREAM} !important;-webkit-text-size-adjust:100%;width:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CREAM}" style="width:100%;min-width:100%;background-color:${CREAM};">
    <tr>
      <td align="left" bgcolor="${CREAM}" style="padding:20px 16px 12px;background-color:${CREAM};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK};">
        <p align="left" style="margin:0 0 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK};white-space:pre-wrap;text-align:left !important;">
          ${introHTML}
        </p>
        <p align="left" style="margin:0 0 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK};text-align:left !important;">
          ${reviewBelow}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;">
          <tr>
            <td align="center" bgcolor="${FOREST}" style="border-radius:10px;background-color:${FOREST};">
              <a href="${DOWNLOAD_URL}"
                 style="display:inline-block;padding:12px 22px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.3;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                Download Gustra
              </a>
            </td>
          </tr>
        </table>
        <p align="center" style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.4;text-align:center;">
          <a href="${SITE_URL}" style="color:${FOREST};font-weight:500;text-decoration:underline;">gustra.net</a>
        </p>
      </td>
    </tr>
    <tr>
      <td bgcolor="${CREAM}" height="28" style="background-color:${CREAM};font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>
</body>
</html>`;
}
