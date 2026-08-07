/**
 * A lightweight reference to a photo in the device media library, as returned
 * by `expo-media-library`'s `getAssetsAsync`. On iOS `uri` is a `ph://` ref
 * (rendered by the PhotoKit image loader without downloading the full photo);
 * on Android it's a content/media URI. The full photo is only materialized
 * when the user confirms and `saveReviewPhoto` copies it into the app.
 */
export type LibraryAsset = {
  id: string;
  uri: string;
  width: number;
  height: number;
  creationTime: number;
};
