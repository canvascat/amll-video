import { Squircle } from "corner-smoothing";
import { forwardRef, useLayoutEffect, useRef, useState, type HTMLProps } from "react";
import { Img } from "remotion";

export type CoverProps = {
  coverUrl?: string;
} & HTMLProps<HTMLDivElement>;

export const Cover = forwardRef<HTMLDivElement, CoverProps>(
  ({ coverUrl, style, ...rest }, ref) => {
    const frameRef = useRef<HTMLDivElement>(null);
    const [cornerRadius, setCornerRadius] = useState(20);
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const showCover = Boolean(coverUrl) && failedSrc !== coverUrl;

    useLayoutEffect(() => {
      const frameEl = frameRef.current;
      if (!frameEl) {
        return;
      }

      const onResize = () => {
        const size = Math.min(frameEl.clientWidth, frameEl.clientHeight);
        setCornerRadius(Math.max(size * 0.02, window.innerHeight * 0.007));
      };
      const observer = new ResizeObserver(onResize);
      onResize();
      observer.observe(frameEl);
      return () => observer.disconnect();
    }, []);

    return (
      <div
        style={{
          aspectRatio: "1 / 1",
          width: "100%",
          height: "100%",
          filter: "drop-shadow(rgba(0, 0, 0, 0.19) 0 1em 1.2em)",
          ...style,
        }}
        ref={(node) => {
          frameRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        {...rest}
      >
        <Squircle
          cornerRadius={cornerRadius}
          cornerSmoothing={0.7}
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            backgroundColor: "#111",
          }}
        >
          {showCover && coverUrl ? (
            <Img
              name="Cover"
              src={coverUrl}
              onError={() => setFailedSrc(coverUrl)}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
              }}
            />
          ) : null}
        </Squircle>
      </div>
    );
  },
);
