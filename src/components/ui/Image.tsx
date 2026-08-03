import React, {
  forwardRef,
  ImgHTMLAttributes,
  SourceHTMLAttributes,
} from "react";

export interface ImageSource
  extends Omit<SourceHTMLAttributes<HTMLSourceElement>, "children"> {
  srcSet: string;
}

export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> {
  /** Required even for decorative images (`alt=""`). */
  alt: string;
  /** Optional responsive/modern formats, rendered before the fallback image. */
  sources?: readonly ImageSource[];
  /** Applied to `<picture>` when `sources` are provided. */
  pictureClassName?: string;
}

/**
 * Browser-native image component.
 *
 * Unlike `next/image`, this renders the source URL directly and never calls
 * `/_next/image`, so it does not consume Vercel Image Optimization or its
 * transformation cache. Width, height, srcSet and sizes are still forwarded
 * to the browser to prevent layout shift and select an appropriate asset.
 */
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    sources,
    pictureClassName,
    alt,
    decoding = "async",
    ...imageProps
  },
  ref
) {
  const image = (
    // This native element is intentional: see the component contract above.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} alt={alt} decoding={decoding} {...imageProps} />
  );

  if (!sources?.length) return image;

  return (
    <picture className={pictureClassName}>
      {sources.map(({ srcSet, ...source }, index) => (
        <source key={`${srcSet}-${index}`} srcSet={srcSet} {...source} />
      ))}
      {image}
    </picture>
  );
});
