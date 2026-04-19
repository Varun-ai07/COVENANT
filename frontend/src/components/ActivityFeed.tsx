"use client";

import { useActivityFeed, getEventColor, formatEventDescription } from "@/hooks/useActivityFeed";
import { useVirtualizer } from "@tanstack/react-virtual";

export function ActivityFeed({ maxItems = 100 }: { maxItems?: number }) {
  const { events } = useActivityFeed();

  if (events.length === 0) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Live Activity
        </h3>
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto mb-4 bg-white/5 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-slate-500">Watching for events...</p>
          <p className="text-slate-600 text-sm mt-1">
            Actions like registrations, task creation, and completions will appear here in real-time.
          </p>
        </div>
      </div>
    );
  }

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.min(events.length, maxItems),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Live Activity
        <span className="text-sm text-slate-500 ml-1">({events.length} events)</span>
      </h3>
      <div ref={parentRef} className="space-y-2 max-h-96 overflow-y-auto relative">
        <div
          style={{
            height: `${totalHeight}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const event = events[virtualRow.index];
            return (
              <div
                key={event.id}
                className="absolute left-0 w-full"
                style={{
                  top: 0,
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="flex items-start gap-3 p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors animate-fade-in"
                  style={{
                    animationDelay: `${virtualRow.index * 50}ms`,
                  }}
                >
                  <span
                    className={`px-2 py-1 text-xs font-mono font-bold rounded-md ${getEventColor(event.type)}`}
                  >
                    {event.type.replace("_", " ").toUpperCase().slice(0, 8)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-sm">{formatEventDescription(event)}</p>
                    <p className="text-slate-600 text-xs mt-1">{event.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {paddingTop > 0 && (
            <div
              className="absolute left-0 w-full"
              style={{
                height: `${paddingTop}px`,
              }}
            />
          )}
          {paddingBottom > 0 && (
            <div
              className="absolute left-0 w-full"
              style={{
                height: `${paddingBottom}px`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}