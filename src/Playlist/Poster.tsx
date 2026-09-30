import { Img } from "remotion";
import { playerFontFamily } from "../Player/font";
import type { LyricPiece } from "./lattice/lyrics";

export const PLAYLIST_LYRIC_CHROME = { top: 118, right: 24, bottom: 36, left: 24 };

const collapsedShade =
  "linear-gradient(180deg, rgb(0 0 0 / 5%) 34%, rgb(0 0 0 / 24%) 56%, rgb(0 0 0 / 92%) 100%)";
const expandedShade =
  "linear-gradient(0deg, rgb(0 0 0 / 86%) 0%, rgb(0 0 0 / 62%) 14%, rgb(0 0 0 / 26%) 30%, rgb(0 0 0 / 0%) 46%), linear-gradient(90deg, rgb(0 0 0 / 88%), rgb(0 0 0 / 50%) 52%, rgb(0 0 0 / 8%))";

export const PlaylistPoster: React.FC<{
  coverUrl: string;
  title: string;
  artist: string;
  queueIndex: number;
  current: boolean;
  expanded: boolean;
  lyrics: LyricPiece[];
  showLyrics: boolean;
}> = ({ coverUrl, title, artist, queueIndex, current, expanded, lyrics, showLyrics }) => {
  const index = String(queueIndex + 1).padStart(2, "0");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: "#111",
        color: "white",
        fontFamily: playerFontFamily,
      }}
    >
      {coverUrl ? (
        <Img
          src={coverUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: expanded ? expandedShade : collapsedShade,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          padding: "5px 8px",
          background: current ? "rgb(0 0 0 / 78%)" : "rgb(0 0 0 / 62%)",
          color: "white",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
        }}
      >
        {current ? `正在播放 · ${index}` : index}
      </div>
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: showLyrics ? 48 : undefined,
          bottom: showLyrics ? undefined : 17,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: showLyrics ? 22 : 16 }}>{title}</div>
        <div style={{ opacity: 0.8, fontSize: showLyrics ? 14 : 13 }}>{artist}</div>
      </div>
      {showLyrics ? (
        <div
          style={{
            position: "absolute",
            left: PLAYLIST_LYRIC_CHROME.left,
            right: PLAYLIST_LYRIC_CHROME.right,
            top: PLAYLIST_LYRIC_CHROME.top,
            bottom: PLAYLIST_LYRIC_CHROME.bottom,
            overflow: "hidden",
          }}
        >
          {lyrics.map((piece, pieceIndex) => {
            const current = piece.role === "current" && !piece.leaving;
            const previous = lyrics[pieceIndex - 1];
            if (previous?.lineKey === piece.lineKey) return null;
            const block = lyrics.filter((item) => item.lineKey === piece.lineKey);
            return (
              <div
                key={piece.lineKey}
                style={{
                  position: "absolute",
                  left: 0,
                  top: piece.blockY,
                  opacity: piece.opacity,
                  filter: piece.blur > 0.05 ? `blur(${piece.blur}px)` : undefined,
                  transform: `scale(${piece.scale})`,
                  transformOrigin: "0 0",
                  zIndex: current ? 4 : piece.role === "next" ? 2 : 1,
                }}
              >
                {block.map((item, itemIndex) => (
                  <div
                    key={`${item.y}-${item.x}-${itemIndex}`}
                    style={{
                      position: "absolute",
                      left: item.x,
                      top: item.y,
                      width: item.width,
                      height: item.height,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      color: "white",
                      fontWeight: item.translation ? 500 : 600,
                      fontSize: item.fontSize,
                      lineHeight: `${item.height}px`,
                      opacity: item.translation ? 0.5 : 1,
                    }}
                  >
                    {current && !item.translation ? (
                      <>
                        <span style={{ color: "rgb(255 255 255 / 35%)" }}>{item.text}</span>
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: `${item.fill * 100}%`,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            color: "white",
                          }}
                        >
                          {item.text}
                        </span>
                      </>
                    ) : (
                      <span style={{ whiteSpace: "nowrap" }}>{item.text}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
