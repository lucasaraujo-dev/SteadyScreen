// Turns any picture the person picks into a small square photo before it
// goes to the server: cut to a centered square, 256x256, WebP (or JPEG
// where the browser can't make WebP). A phone photo of several MB ends up
// around 20 KB.

const SIZE = 256;

/** Thrown when the file isn't a picture the browser can open. */
export class NotAnImage extends Error {}

export async function makeAvatar(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new NotAnImage();
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new NotAnImage();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.86));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new NotAnImage();
  return jpeg;
}
