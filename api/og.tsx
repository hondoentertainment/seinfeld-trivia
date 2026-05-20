import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const correct = searchParams.get("s") ?? "?";
  const total = searchParams.get("t") ?? "?";
  const date = searchParams.get("d") ?? "UTC daily";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(145deg, #1a1224 0%, #2a1a38 45%, #1f6f78 100%)",
          color: "#f7f2e9",
          fontFamily: "Georgia, serif",
          padding: 48,
        }}
      >
        <div style={{ fontSize: 36, opacity: 0.85, marginBottom: 12 }}>Yada yada trivia</div>
        <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1 }}>
          {correct}/{total}
        </div>
        <div style={{ fontSize: 32, marginTop: 20, opacity: 0.9 }}>Seinfeld daily · {date}</div>
        <div style={{ fontSize: 22, marginTop: 28, opacity: 0.75 }}>Same UTC deck for everyone</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
