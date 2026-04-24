export async function resizeAndCompress(
  blob: Blob,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<Blob> {
  const maxDim = opts.maxDim ?? 1024;
  const quality = opts.quality ?? 0.8;

  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("toBlob produced null"))),
      "image/jpeg",
      quality
    )
  );
}
