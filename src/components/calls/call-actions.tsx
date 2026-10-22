"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Select } from "@/components/ui/field";
import { bookCall, startCall } from "@/lib/calls/actions";
import { routes } from "@/lib/routes";

/**
 * Coachens knappar i tråden: ringa direkt eller boka en tid. Samtalet går i
 * coachens mötesrum; utan ett sådant leder knappen till Inställningar.
 */
export function CallActions({
  adeptId,
  meetingUrl,
  today,
}: {
  adeptId: string;
  meetingUrl: string | null;
  today: string;
}) {
  const router = useRouter();
  const ids = { date: useId(), time: useId(), length: useId(), topic: useId() };
  const [booking, setBooking] = useState(false);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("18:00");

  /** Förvalet: nästa hela timme i dag, eller i morgon kl. 18 efter kl. 21. */
  const openBooking = () => {
    const hour = Number(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Stockholm",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
    if (hour >= 21) {
      const next = new Date(`${today}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      setDate(next.toISOString().slice(0, 10));
      setTime("18:00");
    } else {
      setDate(today);
      setTime(`${String(hour + 1).padStart(2, "0")}:00`);
    }
    setBooking(true);
  };
  const [duration, setDuration] = useState("30");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [doing, setDoing] = useState<"call" | "book" | null>(null);

  if (!meetingUrl) {
    return (
      <p className="text-[0.8125rem] text-text-muted">
        <Video aria-hidden className="mr-1.5 inline size-4 align-[-3px]" />
        Vill du ringa på video?{" "}
        <Link
          href={`${routes.settings}#videosamtal`}
          className="text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
        >
          Lägg in ditt mötesrum
        </Link>{" "}
        – länken till Meet, Zoom eller Teams.
      </p>
    );
  }

  const call = () => {
    // Rummet öppnas direkt i klicket, annars stoppar webbläsaren fönstret.
    window.open(meetingUrl, "_blank", "noopener,noreferrer");
    setError(null);
    setDoing("call");
    start(async () => {
      const result = await startCall(adeptId);
      if (!result.ok) setError(result.error);
      else router.refresh();
      setDoing(null);
    });
  };

  const book = () => {
    setError(null);
    setDoing("book");
    start(async () => {
      const result = await bookCall({
        adeptId,
        date,
        time,
        duration: Number(duration),
        topic,
      });
      if (!result.ok) setError(result.error);
      else {
        setBooking(false);
        setTopic("");
        router.refresh();
      }
      setDoing(null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={pending} onClick={call}>
          <Video aria-hidden className="size-4" />
          {doing === "call" ? "Ringer …" : "Ring videosamtal"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-expanded={booking}
          onClick={() => (booking ? setBooking(false) : openBooking())}
        >
          <CalendarPlus aria-hidden className="size-4" />
          Boka samtal
        </Button>
      </div>

      {booking && (
        <form
          className="grid gap-3 rounded-md border border-line bg-surface-2 p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            book();
          }}
        >
          <Field label="Dag" htmlFor={ids.date}>
            <DatePicker
              id={ids.date}
              value={date}
              onChange={setDate}
              min={today}
            />
          </Field>
          <Field label="Klockan" htmlFor={ids.time} hint="Svensk tid.">
            <Input
              id={ids.time}
              type="time"
              value={time}
              step={300}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label="Längd" htmlFor={ids.length}>
            <Select
              id={ids.length}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ämne" htmlFor={ids.topic} optional>
            <Input
              id={ids.topic}
              value={topic}
              maxLength={200}
              placeholder="Genomgång av blocket"
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={pending}
            >
              {doing === "book" ? "Bokar …" : "Boka och skicka"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setBooking(false)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
