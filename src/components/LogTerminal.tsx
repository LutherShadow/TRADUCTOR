import React, { useEffect, useRef } from "react";

interface LogTerminalProps {
  logs: string[];
  errors: string[];
  status: string;
}

export default function LogTerminal({ logs, errors, status }: LogTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the bottom when logs or errors change and status is 'processing'
    if (status === "processing" && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [logs.length, errors.length, status]);

  return (
    <div
      id="log-terminal-container"
      ref={containerRef}
      className="mt-3 p-3 bg-[#08090a] rounded-lg border border-white/5 max-h-48 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1 scrollbar-thin scrollbar-thumb-slate-800"
    >
      <div id="log-terminal-header" className="text-slate-500 text-[9px] uppercase font-bold tracking-wider mb-2 border-b border-white/5 pb-1">
        CONSOLA DE DEPURACIÓN
      </div>
      {logs.length === 0 && (
        <div id="log-terminal-empty" className="text-slate-500 italic">
          No hay logs de ejecución aún.
        </div>
      )}
      {logs.map((logLine, idx) => (
        <div
          key={idx}
          id={`log-line-${idx}`}
          className="leading-relaxed hover:bg-white/5 p-0.5 rounded transition-all"
        >
          {logLine}
        </div>
      ))}
      {errors.map((errLine, idx) => (
        <div
          key={`err-${idx}`}
          id={`err-line-${idx}`}
          className="text-red-400 font-semibold bg-red-950/20 px-1 py-0.5 rounded"
        >
          [ERROR] {errLine}
        </div>
      ))}
    </div>
  );
}
