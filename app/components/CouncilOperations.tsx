"use client";

import { useEffect, useState } from "react";

type CouncilShift = {
  id: string;
  label: string;
  window: string;
  startHour: number;
  endHour: number;
  mode: string;
};

type CouncilWorker = {
  id: string;
  name: string;
  scheduleMinute: number;
  role: string;
  summary: string;
};

function minute(value: number) {
  return `:${String(value).padStart(2, "0")}`;
}

function easternHour() {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date()).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

function resolveShift(shifts: CouncilShift[]) {
  const hour = easternHour();
  return shifts.find((shift) => hour >= shift.startHour && hour < shift.endHour) ?? null;
}

export default function CouncilOperations({
  shifts,
  workers,
  cycleBoundaryMinute,
}: {
  shifts: CouncilShift[];
  workers: CouncilWorker[];
  cycleBoundaryMinute: number;
}) {
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setActiveShiftId(resolveShift(shifts)?.id ?? null);
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [shifts]);

  const activeShift = shifts.find((shift) => shift.id === activeShiftId) ?? null;

  return (
    <div className="councilOps">
      <div className="councilShiftRail" aria-label="Earth Council operating shifts">
        {shifts.map((shift) => (
          <article key={shift.id} data-active={shift.id === activeShiftId ? "true" : "false"}>
            <span>{shift.label}</span>
            <b>{shift.window}</b>
            <small>{shift.mode}</small>
            {shift.id === activeShiftId && <em>NOW</em>}
          </article>
        ))}
      </div>

      <div className="councilCadence" aria-label="Earth Council hourly task cadence">
        <article className="councilBoundary">
          <span>CYCLE</span>
          <b>{minute(cycleBoundaryMinute)}</b>
          <small>DETERMINISTIC BOUNDARY</small>
        </article>
        {workers.map((worker) => (
          <article key={worker.id}>
            <span>{worker.role}</span>
            <b>{minute(worker.scheduleMinute)}</b>
            <strong>{worker.name}</strong>
            <small>{worker.summary}</small>
          </article>
        ))}
      </div>

      <div className="councilOpsNote">
        <span>5 SCHEDULED WORKERS · HOURLY</span>
        <b>{activeShift ? `${activeShift.label} ACTIVE` : "SHIFT SYNCING"}</b>
        <small>Shift changes mission, not task availability. Alpha/Beta still own the six required independent lanes; Deep Runner remains auxiliary research.</small>
      </div>
    </div>
  );
}
