import type { FC } from "react";
import { Interactive } from "remotion";
import { cn } from "../lib/utils";

export const MusicInfo: FC<{
  songName: string;
  artistName: string;
  albumName?: string;
  className?: string;
}> = ({ songName, artistName, albumName = "", className }) => {
  const artistLine = [artistName, albumName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" - ");
  return (
    <div
      className={cn(
        "min-w-0 text-white text-[length:max(2vh,1em)] leading-[1.25em]",
        className,
      )}
    >
      <Interactive.Div
        name="Song name"
        className="min-w-0 truncate font-medium tracking-[0.4px] opacity-90"
      >
        {songName}
      </Interactive.Div>
      <Interactive.Div
        name="Artist"
        className="truncate font-normal tracking-[0.4px] opacity-45"
      >
        {artistLine}
      </Interactive.Div>
    </div>
  );
};
