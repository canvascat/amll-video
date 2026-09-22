import { useState, type FC } from "react";
import { Img } from "remotion";

export const BlurredCoverBackground: FC<{
  coverUrl: string;
}> = ({ coverUrl }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showCover = Boolean(coverUrl) && failedSrc !== coverUrl;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#111",
      }}
    >
      {showCover ? (
        <Img
          name="Blurred cover"
          src={coverUrl}
          onError={() => setFailedSrc(coverUrl)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            scale: 1.5,
            filter: "blur(45px) saturate(1.2)",
          }}
        />
      ) : null}
      <div
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          backgroundColor: "rgb(0 0 0 / 0.5)",
        }}
      />
    </div>
  );
};
