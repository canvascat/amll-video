import { useState, type FC } from "react";
import { Img } from "remotion";
import { cn } from "../lib/utils";

export const BlurredCoverBackground: FC<{
  coverUrl: string;
  className?: string;
}> = ({ coverUrl, className }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showCover = Boolean(coverUrl) && failedSrc !== coverUrl;

  return (
    <div className={cn("relative size-full overflow-hidden bg-[#111]", className)}>
      {showCover ? (
        <Img
          name="Blurred cover"
          src={coverUrl}
          onError={() => setFailedSrc(coverUrl)}
          className="absolute inset-0 size-full scale-150 object-cover object-center blur-[45px] saturate-[1.2]"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-black/50" />
    </div>
  );
};
