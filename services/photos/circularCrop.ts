import * as ImageManipulator from 'expo-image-manipulator';

/** Matches Swift `ImageCompressionService.matchingReviewPhotoMaxPixelSide`. */
export const PROFILE_PHOTO_MAX_SIDE = 480;

export type CropTransform = {
  /** Pinch scale ≥ 1. */
  scale: number;
  /** Pan offset in crop-viewport points (same space as `diameter`). */
  offsetX: number;
  offsetY: number;
};

export type ImageSize = {
  width: number;
  height: number;
};

/** Aspect-fill size of the image inside a circular viewport of `diameter`. */
export function coverSize(image: ImageSize, diameter: number): ImageSize {
  if (image.width <= 0 || image.height <= 0 || diameter <= 0) {
    return { width: 0, height: 0 };
  }
  const aspect = image.width / image.height;
  if (aspect > 1) {
    return { width: diameter * aspect, height: diameter };
  }
  return { width: diameter, height: diameter / aspect };
}

export function maxOffset(
  image: ImageSize,
  diameter: number,
  scale: number,
): ImageSize {
  const cover = coverSize(image, diameter);
  const displayW = cover.width * scale;
  const displayH = cover.height * scale;
  return {
    width: Math.max(0, (displayW - diameter) / 2),
    height: Math.max(0, (displayH - diameter) / 2),
  };
}

export function clampOffset(
  offsetX: number,
  offsetY: number,
  image: ImageSize,
  diameter: number,
  scale: number,
): { x: number; y: number } {
  const limit = maxOffset(image, diameter, scale);
  return {
    x: Math.min(Math.max(offsetX, -limit.width), limit.width),
    y: Math.min(Math.max(offsetY, -limit.height), limit.height),
  };
}

/**
 * Crop the circular viewport to a square JPEG
 * — Swift `ReviewerPhotoEditorView.renderCroppedSquare`.
 */
export async function renderCroppedSquare(args: {
  uri: string;
  image: ImageSize;
  diameter: number;
  transform: CropTransform;
  outputSide?: number;
}): Promise<string> {
  const side = args.outputSide ?? PROFILE_PHOTO_MAX_SIDE;
  const diameter = Math.max(args.diameter, 1);
  const scale = Math.max(args.transform.scale, 1);
  const cover = coverSize(args.image, diameter);
  const displayW = cover.width * scale;
  const displayH = cover.height * scale;
  const originX =
    (diameter - displayW) / 2 + args.transform.offsetX;
  const originY =
    (diameter - displayH) / 2 + args.transform.offsetY;

  // Map viewport crop square → source image pixels.
  const pxPerPointX = args.image.width / displayW;
  const pxPerPointY = args.image.height / displayH;
  let cropX = (0 - originX) * pxPerPointX;
  let cropY = (0 - originY) * pxPerPointY;
  let cropW = diameter * pxPerPointX;
  let cropH = diameter * pxPerPointY;

  // Keep the crop inside the bitmap (float rounding).
  cropX = Math.min(Math.max(0, cropX), Math.max(0, args.image.width - 1));
  cropY = Math.min(Math.max(0, cropY), Math.max(0, args.image.height - 1));
  cropW = Math.min(cropW, args.image.width - cropX);
  cropH = Math.min(cropH, args.image.height - cropY);
  const square = Math.min(cropW, cropH);
  cropW = square;
  cropH = square;

  const result = await ImageManipulator.manipulateAsync(
    args.uri,
    [
      {
        crop: {
          originX: Math.round(cropX),
          originY: Math.round(cropY),
          width: Math.max(1, Math.round(cropW)),
          height: Math.max(1, Math.round(cropH)),
        },
      },
      { resize: { width: side } },
    ],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}
