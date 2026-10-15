import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CapacityGrid } from "./CapacityGrid";
import { allocationState, shiftDate } from "./capacity";

const sample = {
  weeks: ["2026-01-05", "2026-01-12"],
  people: [{ id: 4, name: "Dee Okafor", weeklyHours: 40, allocated: [45, 40] }],
};
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });

beforeEach(() => {
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  // jsdom does not implement the native dialog's browser interaction.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("capacity editing", () => {
  it("keeps failed edits and updates every week only after a confirmed retry", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(sample))
      .mockResolvedValueOnce(new Response("Save unavailable", { status: 503 }))
      .mockResolvedValueOnce(json({ id: 4, weeklyHours: 48 }));
    vi.stubGlobal("fetch", fetch);
    render(<CapacityGrid from="2026-01-05" to="2026-01-18" />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit capacity for Dee Okafor, 40 hours per week",
      }),
    );
    fireEvent.change(screen.getByLabelText("Hours per week"), {
      target: { value: "48" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save capacity" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Save unavailable",
    );
    expect(screen.getByLabelText("Hours per week")).toHaveProperty(
      "value",
      "48",
    );
    expect(screen.getByText("5 h over")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save capacity" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("3 h available")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", {
        name: "Edit capacity for Dee Okafor, 48 hours per week",
      }),
    );
    expect(screen.getByText("8 h available")).toBeTruthy();
    expect(
      screen.getByText("1 people · 2 weeks · 0 over capacity"),
    ).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
      weeklyHours: 48,
    });
  });

  it("does not let an older range response overwrite the latest range", async () => {
    let resolveOld!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveOld = resolve;
            }),
        )
        .mockResolvedValueOnce(
          json({ ...sample, weeks: ["2026-01-12", "2026-01-19"] }),
        ),
    );
    render(<CapacityGrid from="2026-01-05" to="2026-01-18" />);
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    await screen.findByRole("columnheader", { name: /19 Jan.*25 Jan/ });
    await act(async () => resolveOld(json(sample)));
    expect(
      screen.queryByRole("columnheader", { name: /5 Jan.*11 Jan/ }),
    ).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: /19 Jan.*25 Jan/ }),
    ).toBeTruthy();
  });

  it("shows fetch failure and lets the manager retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Network unavailable"))
        .mockResolvedValueOnce(json(sample)),
    );
    render(<CapacityGrid from="2026-01-05" to="2026-01-18" />);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Network unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Dee Okafor")).toBeTruthy();
  });

  it("removes a person from the over-capacity filter after increasing their limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(sample))
        .mockResolvedValueOnce(json({ id: 4, weeklyHours: 50 })),
    );
    render(<CapacityGrid from="2026-01-05" to="2026-01-18" />);
    await screen.findByText("Dee Okafor");
    fireEvent.click(screen.getByLabelText("Over capacity only"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit capacity for Dee Okafor, 40 hours per week",
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Hours per week"), {
      target: { value: "50" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save capacity" }));
    expect(await screen.findByText("No people to show")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Search people"));
  });
});

it("handles zero capacity, equality and calendar boundaries", () => {
  expect(allocationState(20, 0)).toBe("over");
  expect(allocationState(0, 0)).toBe("available");
  expect(allocationState(40, 40)).toBe("full");
  expect(shiftDate("2025-12-29", 7)).toBe("2026-01-05");
  expect(shiftDate("2026-03-23", 7)).toBe("2026-03-30");
});
