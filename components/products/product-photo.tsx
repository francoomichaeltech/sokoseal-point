"use client";

import { ImageIcon } from "lucide-react";
import { usePhotoUrl } from "@/lib/catalogue/use-photo-url";

type ProductPhotoProps = {
  source?: string | Blob;
  alt: string;
  className?: string;
};

export function ProductPhoto({ source, alt, className = "" }: ProductPhotoProps) {
  const url = usePhotoUrl(source);
  const imageProps = { src: url };

  return (
    <div className={`overflow-hidden rounded-control bg-canvas ${className}`}>
      {url ? (
        // Local object URLs can't go through next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img {...imageProps} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted">
          <ImageIcon aria-hidden size={20} />
        </div>
      )}
    </div>
  );
}