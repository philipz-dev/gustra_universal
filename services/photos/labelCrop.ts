import * as ImageManipulator from 'expo-image-manipulator';

export type CropTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type ImageSize = {
  width: number;
  height: number;
};

export type LabelCropViewport = {
  width: number;
  height: number;
};

/** Max longest side for saved wine-label crops. */
export const WINE_LABEL_MAX_SIDE = 1200;

/** Aspect-fill size of the image inside a rectangular viewport. */
export function labelCoverSize(
  image: ImageSize,
  viewport: LabelCropViewport,
): ImageSize {
  const vw = Math.max(viewport.width, 1);
  const vh = Math.max(viewport.height, 1);
  if (image.width <= 0 || image.height <= 0) {
    return { width: vw, height: vh };
  }
  const imageAspect = image.width / image.height;
  const viewAspect = vw / vh;
  if (imageAspect > viewAspect) {
    return { width: vh * imageAspect, height: vh };
  }
  return { width: vw, height: vw / imageAspect };
}

export function clampLabelOffset(
  offsetX: number,
  offsetY: number,
  image: ImageSize,
  viewport: LabelCropViewport,
  scale: number,
): { x: number; y: number } {
  const cover = labelCoverSize(image, viewport);
  const displayW = cover.width * Math.max(scale, 1);
  const displayH = cover.height * Math.max(scale, 1);
  const limitX = Math.max(0, (displayW - viewport.width) / 2);
  const limitY = Math.max(0, (displayH - viewport.height) / 2);
  return {
    x: Math.min(Math.max(offsetX, -limitX), limitX),
    y: Math.min(Math.max(offsetY, -limitY), limitY),
  };
}

/**
 * Crop the rectangular label viewport from the pan/zoom canvas.
 */
export async function renderCroppedLabel(args: {
  uri: string;
  image: ImageSize;
  viewport: LabelCropViewport;
  transform: CropTransform;
  maxSide?: number;
}): Promise<string> {
  const vw = Math.max(args.viewport.width, 1);
  const vh = Math.max(args.viewport.height, 1);
  const scale = Math.max(args.transform.scale, 1);
  const cover = labelCoverSize(args.image, args.viewport);
  const displayW = cover.width * scale;
  const displayH = cover.height * scale;
  const originX = (vw - displayW) / 2 + args.transform.offsetX;
  const originY = (vh - displayH) / 2 + args.transform.offsetY;

  const pxPerPointX = args.image.width / displayW;
  const pxPerPointY = args.image.height / displayH;
  let cropX = (0 - originX) * pxPerPointX;
  let cropY = (0 - originY) * pxPerPointY;
  let cropW = vw * pxPerPointX;
  let cropH = vh * pxPerPointY;

  cropX = Math.min(Math.max(0, cropX), Math.max(0, args.image.width - 1));
  cropY = Math.min(Math.max(0, cropY), Math.max(0, args.image.height - 1));
  cropW = Math.min(cropW, args.image.width - cropX);
  cropH = Math.min(cropH, args.image.height - cropY);

  const maxSide = args.maxSide ?? WINE_LABEL_MAX_SIDE;
  const longest = Math.max(cropW, cropH);
  const actions: ImageManipulator.Action[] = [
    {
      crop: {
        originX: Math.round(cropX),
        originY: Math.round(cropY),
        width: Math.max(1, Math.round(cropW)),
        height: Math.max(1, Math.round(cropH)),
      },
    },
  ];
  if (longest > maxSide && longest > 0) {
    const ratio = maxSide / longest;
    actions.push({
      resize: {
        width: Math.max(1, Math.round(cropW * ratio)),
        height: Math.max(1, Math.round(cropH * ratio)),
      },
    });
  }

  const result = await ImageManipulator.manipulateAsync(args.uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}
