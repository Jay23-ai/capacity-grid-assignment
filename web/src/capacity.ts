export type Person = {
  id: number;
  name: string;
  weeklyHours: number;
  allocated: number[];
};
export type Capacity = { weeks: string[]; people: Person[] };

export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function allocationState(hours: number, capacity: number) {
  return hours > capacity
    ? "over"
    : hours === capacity && capacity > 0
      ? "full"
      : "available";
}

const hourFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export const hours = (value: number) => hourFormat.format(value);
export const dateLabel = (value: string) =>
  dayFormat.format(new Date(`${value}T12:00:00Z`));
