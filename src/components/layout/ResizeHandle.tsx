interface ResizeHandleProps {
  value: number;
  onChange: (value: number) => void;
  reverse?: boolean;
}

export function ResizeHandle({ value, onChange, reverse = false }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="w-1 shrink-0 cursor-col-resize bg-[#1c314c] hover:bg-blue-500"
      onMouseDown={(event) => {
        event.preventDefault();
        const origin = value;
        const startX = event.clientX;
        const handleMove = (move: MouseEvent) => {
          const delta = move.clientX - startX;
          onChange(origin + (reverse ? -delta : delta));
        };
        const handleUp = () => {
          window.removeEventListener("mousemove", handleMove);
          window.removeEventListener("mouseup", handleUp);
        };
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
      }}
    />
  );
}
