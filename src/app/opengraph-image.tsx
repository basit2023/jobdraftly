import { ImageResponse } from "next/og";

export const alt = "JobDraftly — Jobs in Pakistan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#f8f7f4", color: "#14171f", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: "80px", width: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", gap: 16 }}>
        <div style={{ alignItems: "center", background: "#0b6e4f", borderRadius: 10, color: "white", display: "flex", fontSize: 34, fontWeight: 700, height: 60, justifyContent: "center", width: 60 }}>J</div>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 700, letterSpacing: -1 }}>JobDraftly</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, maxWidth: 960 }}>Find your next job in Pakistan</div>
        <div style={{ color: "#3d4452", display: "flex", fontSize: 32, marginTop: 24 }}>Search openings across the country and apply directly with the employer.</div>
      </div>
    </div>,
    size,
  );
}
