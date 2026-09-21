"use client";

import { Children, type ReactNode, useMemo, useState } from "react";

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
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  return (
    <div className="progressiveList">
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
