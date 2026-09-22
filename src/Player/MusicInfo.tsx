import type { CSSProperties, FC } from "react";
import { Interactive } from "remotion";

export const MusicInfo: FC<{
  songName: string;
  artistName: string;
  albumName?: string;
  style?: CSSProperties;
}> = ({ songName, artistName, albumName = "", style }) => {
  const artistLine = [artistName, albumName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" - ");
  return (
    <div
      style={{
        minWidth: 0,
        color: "white",
        fontSize: "max(2vh, 1em)",
        lineHeight: "1.25em",
        ...style,
      }}
    >
      <Interactive.Div
        name="Song name"
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 500,
          letterSpacing: "0.4px",
          opacity: 0.9,
        }}
      >
        {songName}
      </Interactive.Div>
      <Interactive.Div
        name="Artist"
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 400,
          letterSpacing: "0.4px",
          opacity: 0.45,
        }}
      >
        {artistLine}
      </Interactive.Div>
    </div>
  );
};
