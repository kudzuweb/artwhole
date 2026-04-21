import { useEffect, useRef } from "react";
import outlineUrl from "./assets/outline.png";

const BG = "#E8DDD3";

export default function ZenGarden() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const outlineImg = new Image();
    let raf;

    function render() {
      const W = canvas.width = window.innerWidth;
      const H = canvas.height = window.innerHeight;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      if (outlineImg.complete && outlineImg.naturalWidth) {
        const scale = Math.min((W * 0.9) / outlineImg.width, (H * 0.9) / outlineImg.height);
        const dw = outlineImg.width * scale;
        const dh = outlineImg.height * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(outlineImg, dx, dy, dw, dh);
      }

      raf = requestAnimationFrame(render);
    }

    outlineImg.onload = () => {};
    outlineImg.src = outlineUrl;
    raf = requestAnimationFrame(render);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        position: "fixed",
        top: 0, left: 0,
        width: "100vw",
        height: "100vh",
        background: BG,
      }}
    />
  );
}
