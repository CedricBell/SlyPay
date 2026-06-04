"use client";

import Image from "next/image";
import { useState } from "react";
import { CardThumbnail, type CardThumbnailSize } from "@/components/CardThumbnail";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  issuer: string;
  imageUrl?: string | null;
  colorHex?: string | null;
  size?: CardThumbnailSize;
  className?: string;
  /** Full-width hero style (add-card preview). */
  variant?: "inline" | "hero";
};

export function CatalogCardArt({
  name,
  issuer,
  imageUrl,
  colorHex,
  size = "lg",
  className,
  variant = "inline",
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(imageUrl?.trim()) && !imgFailed;

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "relative mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border border-border/80 bg-muted/20 shadow-lg",
          className,
        )}
      >
        <div className="aspect-[1.586/1] w-full">
          {showImage ? (
            <Image
              src={imageUrl!}
              alt={`${issuer} ${name}`}
              fill
              unoptimized
              className="object-contain p-3"
              sizes="(max-width: 768px) 100vw, 340px"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <CardThumbnail
                name={name}
                issuer={issuer}
                colorHex={colorHex}
                size="lg"
                className="shadow-xl"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showImage) {
    return (
      <Image
        src={imageUrl!}
        alt={`${issuer} ${name}`}
        width={172}
        height={108}
        unoptimized
        className={cn(
          "rounded-xl border border-border object-contain shadow-md",
          size === "lg" ? "h-[108px] w-[172px]" : "h-10 w-16",
          className,
        )}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <CardThumbnail
      name={name}
      issuer={issuer}
      colorHex={colorHex}
      size={size}
      className={className}
    />
  );
}
