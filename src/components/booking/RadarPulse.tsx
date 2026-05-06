export default function RadarPulse({ size = 220 }: { size?: number }) {
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="radar-ring" />
      <div className="radar-ring delay-1" />
      <div className="radar-ring delay-2" />
      <div className="relative w-16 h-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-2xl shadow-elegant">
        🛠️
      </div>
    </div>
  );
}