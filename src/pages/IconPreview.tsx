import React from "react";

export default function IconPreview() {
  const colors = {
    bg: "#FDF5F0",
    circle: "#E8734A",
    white: "#FFFFFF",
    flame: "#FFC107",
    dark: "#3D2C2C",
  };

  const IconSVG = ({ size }: { size: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ borderRadius: "20%", overflow: "hidden" }}
    >
      {/* Cream background */}
      <rect width="512" height="512" fill={colors.bg} rx="100" />

      {/* Coral circle */}
      <circle cx="256" cy="260" r="180" fill={colors.circle} />

      {/* Head */}
      <circle cx="220" cy="180" r="30" fill={colors.white} />

      {/* Body / torso - angled for situp */}
      <path
        d="M218,210 L290,175 L296,185 L224,220 Z"
        fill={colors.white}
      />

      {/* Front arm reaching forward */}
      <path
        d="M290,175 L350,155 L355,168 L296,185 Z"
        fill={colors.white}
      />

      {/* Other arm */}
      <path
        d="M290,175 L310,205 L300,210 L280,185 Z"
        fill={colors.white}
      />

      {/* Thigh (bent up) */}
      <path
        d="M224,220 L190,290 L200,296 L235,226 Z"
        fill={colors.white}
      />

      {/* Shin */}
      <path
        d="M190,290 L165,360 L178,365 L200,296 Z"
        fill={colors.white}
      />

      {/* Other thigh */}
      <path
        d="M235,226 L290,310 L300,300 L245,226 Z"
        fill={colors.white}
      />

      {/* Other shin */}
      <path
        d="M290,310 L310,370 L320,360 L300,300 Z"
        fill={colors.white}
      />

      {/* Fire accent */}
      <path
        d="M370,380 C370,380 360,345 370,325 C380,350 395,330 385,305 C400,340 415,365 400,390 C395,400 375,400 370,380 Z"
        fill={colors.flame}
      />
    </svg>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0F0F1A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          color: "#FFFFFF",
          fontSize: "28px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        🎨 App Icon Preview
      </h1>
      <p style={{ color: "#9CA3AF", marginBottom: "40px", fontSize: "14px" }}>
        Situp Challenge App — What users see on their home screen
      </p>

      {/* Large preview */}
      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <p
          style={{ color: "#6B7280", fontSize: "12px", marginBottom: "12px" }}
        >
          256px — Home Screen
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "20px",
            backgroundColor: "#1F2937",
            borderRadius: "24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          <IconSVG size={256} />
        </div>
      </div>

      {/* Medium preview */}
      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <p
          style={{ color: "#6B7280", fontSize: "12px", marginBottom: "12px" }}
        >
          128px — App Drawer
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "16px",
            backgroundColor: "#1F2937",
            borderRadius: "20px",
          }}
        >
          <IconSVG size={128} />
        </div>
      </div>

      {/* Small preview */}
      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <p
          style={{ color: "#6B7280", fontSize: "12px", marginBottom: "12px" }}
        >
          64px — Notification
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "12px",
            backgroundColor: "#1F2937",
            borderRadius: "16px",
          }}
        >
          <IconSVG size={64} />
        </div>
      </div>

      {/* Color palette */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: "10px",
        }}
      >
        {[
          { color: colors.bg, name: "Background", hex: "#FDF5F0" },
          { color: colors.circle, name: "Circle", hex: "#E8734A" },
          { color: colors.white, name: "Person", hex: "#FFFFFF" },
          { color: colors.flame, name: "Flame", hex: "#FFC107" },
        ].map((c) => (
          <div key={c.hex} style={{ textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: c.color,
                border: "2px solid #374151",
                marginBottom: "6px",
              }}
            />
            <p style={{ color: "#9CA3AF", fontSize: "10px" }}>{c.name}</p>
            <p style={{ color: "#6B7280", fontSize: "10px", fontFamily: "monospace" }}>
              {c.hex}
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <a
          href="/"
          style={{
            color: "#E8734A",
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          ← Back to App
        </a>
      </div>
    </div>
  );
}
