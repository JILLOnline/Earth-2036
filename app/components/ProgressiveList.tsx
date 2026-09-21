"use client";

import { Children, type ReactNode, useMemo, useRef, useState } from "react";

const FIRST_BATCH = 10;
const SECOND_BATCH = 50;

export default function ProgressiveList({
  children,
  className = "",
  firstBatch = FIRST_BATCH,
  secondBatch = SECOND_BATCH,
}: {
  children: ReactNode;
  className?: string;
  firstBatch?: number;
  secondBatch?: number;
}) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const [visibleLimit, setVisibleLimit] = useState(firstBatch);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const visible = items.slice(0, visibleLimit);
  const hasMore = visible.length < items.length;
  const needsControl = items.length > firstBatch;
  const nextLimit = visibleLimit <= firstBatch
    ? Math.min(secondBatch, items.length)
    : items.length;

  function handleControl() {
    if (hasMore) {
      setVisibleLimit(nextLimit);
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={rootRef} className="progressiveList">
      <div className={className}>{visible}</div>
      {needsControl && (
        <div className="universeLoadRail">
          <button type="button" className="universeLoadButton" onClick={handleControl}>
            {hasMore ? "SHOW MORE" : "BACK TO TOP"}
          </button>
          <span className="universeLoadCount">
            {hasMore ? `SHOWING ${visible.length}–${items.length}` : "SHOWING ALL"}
          </span>
        </div>
      )}
    </div>
  );
}
