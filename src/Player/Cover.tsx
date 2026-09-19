import { Squircle } from "corner-smoothing";
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLProps,
} from "react";

export type CoverProps = {
  coverUrl?: string;
} & HTMLProps<HTMLDivElement>;

export const Cover = forwardRef<HTMLDivElement, CoverProps>(
  ({ coverUrl, className, ...rest }, ref) => {
    const frameRef = useRef<HTMLDivElement>(null);
    const [cornerRadius, setCornerRadius] = useState(20);

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
        className={`aspect-square size-full drop-shadow-[rgba(0,0,0,0.19)_0_1em_1.2em] ${className ?? ""}`}
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
          className="size-full bg-[#111] bg-cover bg-center"
        >
          <div
            className="size-full bg-[#111] bg-cover bg-center"
            style={{
              backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            }}
          />
        </Squircle>
      </div>
    );
  },
);
