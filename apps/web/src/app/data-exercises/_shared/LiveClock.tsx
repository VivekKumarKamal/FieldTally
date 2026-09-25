"use client";

import { useEffect, useState } from "react";

export default function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="text-center">
      <div className="font-mono text-5xl sm:text-6xl font-black tracking-wider text-indigo-700 drop-shadow-sm tabular-nums">
        {time}
      </div>
      <div className="text-lg font-semibold text-indigo-400 mt-1">{date}</div>
    </div>
  );
}
