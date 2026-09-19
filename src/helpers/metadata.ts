import type { AttachedImage, MetadataTags } from "mediabunny";

export type AudioTags = {
  title?: string;
  artist?: string;
  album?: string;
  coverDataUrl?: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }
  return btoa(chunks.join(""));
}

export function titleFromAudioUrl(audioUrl: string): string {
  try {
    const pathname = new URL(audioUrl, "http://local.invalid").pathname;
    const base = decodeURIComponent(pathname.split("/").pop() ?? "untitled");
    return base.replace(/\.[^.]+$/, "") || "untitled";
  } catch {
    return "untitled";
  }
}

function pickCover(images: AttachedImage[] | undefined): AttachedImage | undefined {
  if (!images?.length) {
    return undefined;
  }
  return (
    images.find((image) => image.kind === "coverFront") ?? images[0]
  );
}

export function tagsFromMediabunny(tags: MetadataTags): AudioTags {
  const picture = pickCover(tags.images);
  return {
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    coverDataUrl: picture
      ? `data:${picture.mimeType};base64,${bytesToBase64(picture.data)}`
      : undefined,
  };
}
