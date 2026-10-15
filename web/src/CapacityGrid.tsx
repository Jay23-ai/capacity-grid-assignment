import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { allocationState, dateLabel, hours, shiftDate } from "./capacity";
import type { Capacity, Person } from "./capacity";

type Props = { from: string; to: string };
const PAGE_SIZE = 40;

async function responseJSON<T>(response: Response): Promise<T> {
  if (!response.ok)
    throw new Error(
      (await response.text()).trim() || "The request failed. Please try again.",
    );
  return response.json();
}

function CapacityEditor({
  person,
  onClose,
  onSaved,
}: {
  person: Person;
  onClose: () => void;
  onSaved: (id: number, value: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(String(person.weeklyHours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const weeklyHours = Number(value);
    if (
      !value.trim() ||
      !Number.isFinite(weeklyHours) ||
      weeklyHours < 0 ||
      weeklyHours > 168
    ) {
      setError("Enter weekly hours between 0 and 168.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyHours }),
        signal: AbortSignal.timeout(15000),
      }).then(responseJSON<{ id: number; weeklyHours: number }>);
      onSaved(result.id, result.weeklyHours);
    } catch (error) {
      setError(
        error instanceof Error && error.name === "TimeoutError"
          ? "The save could not be confirmed. Retry to set these hours again."
          : error instanceof Error
            ? error.message
            : "Could not save. Please try again.",
      );
      setSaving(false);
      submitting.current = false;
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="edit-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={save}>
        <p className="eyebrow">EDIT CAPACITY</p>
        <h2 id="edit-title">{person.name}</h2>
        <p className="muted">
          This changes their weekly capacity for every week, including past
          weeks. Assigned hours stay the same.
        </p>
        <label htmlFor="weekly-hours">Hours per week</label>
        <input
          id="weekly-hours"
          type="number"
          min="0"
          max="168"
          step="any"
          required
          autoFocus
          value={value}
          disabled={saving}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby={error ? "save-error" : undefined}
        />
        {error && (
          <p id="save-error" className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save capacity"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function CapacityGrid({ from: initialFrom, to: initialTo }: Props) {
  const [range, setRange] = useState({ from: initialFrom, to: initialTo });
  const [draft, setDraft] = useState(range);
  const [data, setData] = useState<Capacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyOver, setOnlyOver] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Person | null>(null);
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  useLayoutEffect(() => {
    if (!editing && editTrigger.current) {
      const target = editTrigger.current.isConnected
        ? editTrigger.current
        : searchInput.current;
      target?.focus();
      editTrigger.current = null;
    }
  }, [editing]);

  useEffect(() => {
    const controller = new AbortController();
    const version = ++request.current;
    setLoading(true);
    setError("");
    setNotice("");
    fetch(`/api/capacity?${new URLSearchParams(range)}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(responseJSON<Capacity>)
      .then((result) => {
        if (version === request.current && !controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (version === request.current && !controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : "Could not load capacity.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [range, refresh]);

  function navigate(days: number) {
    const next = {
      from: shiftDate(range.from, days),
      to: shiftDate(range.to, days),
    };
    setRange(next);
    setDraft(next);
    setPage(0);
  }
  const people =
    data?.people.filter(
      (person) =>
        person.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
        (!onlyOver ||
          person.allocated.some((value) => value > person.weeklyHours)),
    ) ?? [];
  const pageCount = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = people.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const overCount =
    data?.people.filter((person) =>
      person.allocated.some((value) => value > person.weeklyHours),
    ).length ?? 0;

  return (
    <section aria-label="Team capacity">
      <div className="toolbar">
        <div className="week-navigation">
          <button aria-label="Previous week" onClick={() => navigate(-7)}>
            ←
          </button>
          <button aria-label="Next week" onClick={() => navigate(7)}>
            →
          </button>
        </div>
        <form
          className="date-form"
          onSubmit={(event) => {
            event.preventDefault();
            setRange({ ...draft });
            setPage(0);
          }}
        >
          <label>
            From
            <input
              aria-label="From date"
              type="date"
              required
              min="0001-01-01"
              max={draft.to || "9998-12-31"}
              value={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
            />
          </label>
          <span className="date-divider">—</span>
          <label>
            To
            <input
              aria-label="To date"
              type="date"
              required
              min={draft.from}
              max="9998-12-31"
              value={draft.to}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
            />
          </label>
          <button type="submit">Apply range</button>
        </form>
      </div>
      <p className="range-note">
        Full weeks · Monday–Friday working days · Up to two years
      </p>
      <div className="grid-card">
        <div className="grid-heading">
          <div>
            <h2>Team allocation</h2>
            <p>
              {loading
                ? "Loading selected weeks…"
                : error
                  ? "Capacity unavailable"
                  : `${data?.people.length ?? 0} people · ${data?.weeks.length ?? 0} weeks · ${overCount} over capacity`}
            </p>
          </div>
          <div className="legend">
            <span>
              <i className="dot available" />
              Available
            </span>
            <span>
              <i className="dot full" />
              At capacity
            </span>
            <span>
              <i className="dot over" />
              Over capacity
            </span>
          </div>
        </div>
        <div className="filters">
          <input
            ref={searchInput}
            aria-label="Search people"
            type="search"
            placeholder="Search people…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyOver}
              onChange={(event) => {
                setOnlyOver(event.target.checked);
                setPage(0);
              }}
            />
            Over capacity only
          </label>
        </div>
        {loading ? (
          <div className="loading" role="status">
            <span className="spinner" />
            Loading capacity…
          </div>
        ) : error ? (
          <div className="empty">
            <p role="alert">{error}</p>
            <button onClick={() => setRefresh((value) => value + 1)}>
              Try again
            </button>
          </div>
        ) : data && people.length > 0 ? (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Weekly allocations, scroll horizontally for more weeks"
            >
              <table>
                <caption className="sr-only">
                  Allocated hours against weekly capacity. Edit a person's
                  weekly capacity using the button below their name.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="person-column">
                      Person / weekly capacity
                    </th>
                    {data.weeks.map((week) => (
                      <th scope="col" key={week}>
                        <span>
                          {dateLabel(week)} – {dateLabel(shiftDate(week, 6))}
                        </span>
                        <small>{week.slice(0, 4)}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((person) => (
                    <tr key={person.id}>
                      <th scope="row" className="person-column">
                        <span className="person-name" dir="auto">
                          {person.name}
                        </span>
                        <button
                          className="edit-hours"
                          aria-label={`Edit capacity for ${person.name}, ${hours(person.weeklyHours)} hours per week`}
                          onClick={(event) => {
                            editTrigger.current = event.currentTarget;
                            setEditing(person);
                            setNotice("");
                          }}
                        >
                          {hours(person.weeklyHours)} h / week{" "}
                          <span aria-hidden="true">✎</span>
                        </button>
                      </th>
                      {person.allocated.map((allocated, index) => {
                        const state = allocationState(
                          allocated,
                          person.weeklyHours,
                        );
                        return (
                          <td key={data.weeks[index]}>
                            <div className={`allocation ${state}`}>
                              <div>
                                <strong>{hours(allocated)} h</strong>
                                <span className="capacity-denominator">
                                  {" "}
                                  / {hours(person.weeklyHours)} h
                                </span>
                              </div>
                              <small>
                                {state === "over"
                                  ? `${hours(allocated - person.weeklyHours)} h over`
                                  : state === "full"
                                    ? "At capacity"
                                    : person.weeklyHours === 0
                                      ? "No capacity"
                                      : `${hours(person.weeklyHours - allocated)} h available`}
                              </small>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="pagination">
              <span>
                {currentPage * PAGE_SIZE + 1}–
                {Math.min((currentPage + 1) * PAGE_SIZE, people.length)} of{" "}
                {people.length} people
              </span>
              <div>
                <button
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage + 1} of {pageCount}
                </span>
                <button
                  disabled={currentPage + 1 >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="empty">
            <h3>No people to show</h3>
            <p>
              {data?.people.length
                ? "Try a different name or turn off the over-capacity filter."
                : "There are no people in this team yet."}
            </p>
          </div>
        )}
      </div>
      <p className="save-notice" role="status">
        {notice}
      </p>
      {editing && (
        <CapacityEditor
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={(id, weeklyHours) => {
            setData((current) =>
              current
                ? {
                    ...current,
                    people: current.people.map((person) =>
                      person.id === id ? { ...person, weeklyHours } : person,
                    ),
                  }
                : current,
            );
            setNotice(
              `${editing.name}’s capacity saved: ${hours(weeklyHours)} hours per week.`,
            );
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
