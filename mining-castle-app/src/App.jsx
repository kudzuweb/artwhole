import { useState } from "react";
import HelloKittyPhysics from "./HelloKittyPhysics";
import MiningCastle from "./MiningCastle";

const pieces = [
  { id: "physics", label: "Hello Kitty Physics", component: HelloKittyPhysics },
  { id: "mining", label: "Mining Castle", component: MiningCastle },
];

export default function App() {
  const [active, setActive] = useState(null);

  if (active) {
    const Piece = pieces.find(p => p.id === active).component;
    return (
      <>
        <Piece />
        <button
          onClick={() => setActive(null)}
          style={{
            position: "fixed", top: 12, right: 12, zIndex: 999,
            background: "rgba(0,0,0,0.5)", color: "#fff",
            border: "none", borderRadius: 6, padding: "6px 14px",
            fontFamily: "monospace", fontSize: 13, cursor: "pointer",
          }}
        >
          ← back
        </button>
      </>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
      background: "#FFF0F5", fontFamily: "monospace",
    }}>
      <h1 style={{ fontSize: 20, color: "#8B6B7B" }}>hello kitty pieces</h1>
      {pieces.map(p => (
        <button
          key={p.id}
          onClick={() => setActive(p.id)}
          style={{
            padding: "12px 28px", fontSize: 15, fontFamily: "monospace",
            background: "#fff", border: "2px solid #FFB6C1",
            borderRadius: 8, cursor: "pointer", color: "#8B6B7B",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
