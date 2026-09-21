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

  function handleShowMore() {
    if (!hasMore) return;
    setVisibleLimit(nextLimit);
  }

  return (
    <div className="progressiveList">
      <div className={className}>{visible}</div>
      {needsControl && (
        <div className="universeLoadRail">
          {hasMore ? (
            <button type="button" className="universeLoadButton" onClick={handleShowMore}>SHOW MORE</button>
          ) : (
            <a className="universeLoadButton" href="#earth-top">BACK TO TOP</a>
          )}
          <span className="universeLoadCount">
            {hasMore ? `SHOWING ${visible.length}–${items.length}` : "SHOWING ALL"}
          </span>
        </div>
      )}
    </div>
  );
}
