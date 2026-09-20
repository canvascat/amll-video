import type { FC } from "react";
import { Interactive } from "remotion";

export const MusicInfo: FC<{
  songName: string;
  artistName: string;
  albumName?: string;
  className?: string;
}> = ({ songName, artistName, albumName = "", className }) => {
  const artistLine = [artistName, albumName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={className} style={{ minWidth: 0 }}>
      <Interactive.Div
        name="Song name"
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "white",
          fontSize: "max(2vh, 1em)",
          lineHeight: "1.25em",
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
          color: "white",
          fontSize: "max(2vh, 1em)",
          lineHeight: "1.25em",
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
