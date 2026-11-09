import React, { createContext, useContext, useEffect, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import {
  ACTIVITY_SECTIONS,
  ACTIVITY_TABS,
  type ActivityTab,
  type ActivityPage,
  type ActivitySection,
  type ActivitySummary,
} from "./activity-types";

export const ActivityContext = createContext<ActivitySummary | null>(null);
export function relativeTime(value: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (!Number.isFinite(seconds)) return "Date unavailable";
  if (seconds < 60) return "Just now";
  const [amount, unit] =
    seconds < 3600
      ? [Math.floor(seconds / 60), "minute"]
      : seconds < 86400
        ? [Math.floor(seconds / 3600), "hour"]
        : [Math.floor(seconds / 86400), "day"];
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
}
const ActivityClock = createContext(Date.now());
export function ActivityClockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <ActivityClock.Provider value={now}>{children}</ActivityClock.Provider>
  );
}
export function ActivityTime({ value }: { value: string }) {
  const now = useContext(ActivityClock);
  const exact = new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <time dateTime={value} title={exact}>
      {relativeTime(value, now)}
    </time>
  );
}
export function AdminUpdated({
  section,
  id,
  fallback,
}: {
  section: string;
  id: string;
  fallback?: string;
}) {
  const summary = useContext(ActivityContext);
  const at = summary?.latest[section + ":" + id] || fallback;
  return (
    <small className="adm-updated">
      <Clock3 size={12} aria-hidden="true" />
      {at ? (
        <>
          Updated <ActivityTime value={at} />
        </>
      ) : summary ? (
        "Not tracked yet"
      ) : (
        "Update date unavailable"
      )}
    </small>
  );
}
const ACTIONS = {
  created: "Added",
  updated: "Updated",
  deleted: "Deleted",
  reordered: "Reordered",
  uploaded: "Uploaded",
  published: "Saved website",
  signed_in: "Signed in",
  signed_out: "Signed out",
};
export function ActivityHistory({ refreshKey }: { refreshKey: number }) {
  const [tab, setTab] = useState<ActivityTab>("all");
  const activeTab = ACTIVITY_TABS.find((item) => item.id === tab)!;
  const tabSections: readonly ActivitySection[] | null = activeTab.sections;
  function selectTab(next: ActivityTab) {
    if (next === tab) return;
    setTab(next);
    setSection("");
    setSearch("");
    setAction("");
    setPage(1);
    setData(null);
  }
  const [section, setSection] = useState(""),
    [action, setAction] = useState(""),
    [search, setSearch] = useState("");
  const [page, setPage] = useState(1),
    [data, setData] = useState<ActivityPage | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      tab,
      section,
      action,
      search,
      page: String(page),
    });
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/history?" + query, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || "History could not be loaded.");
        setData(result);
      } catch (failure) {
        if (!controller.signal.aborted) setError((failure as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, section, action, search, page, reload, refreshKey]);
  return (
    <section
      className="adm-panel adm-history"
      aria-labelledby="adm-history-title"
    >
      <div className="adm-panel-toolbar">
        <div>
          <h2 id="adm-history-title">Activity history</h2>
          <small>
            Saved actions and uploads · Visible only to signed-in admins
          </small>
        </div>
        <button
          className="adm-secondary"
          onClick={() => setReload((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh history
        </button>
      </div>
      <div
        className="adm-history-tabs"
        role="tablist"
        aria-label="History categories"
        onKeyDown={(event) => {
          const index = ACTIVITY_TABS.findIndex((item) => item.id === tab);
          const next =
            event.key === "ArrowRight"
              ? (index + 1) % ACTIVITY_TABS.length
              : event.key === "ArrowLeft"
                ? (index - 1 + ACTIVITY_TABS.length) % ACTIVITY_TABS.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? ACTIVITY_TABS.length - 1
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          selectTab(ACTIVITY_TABS[next].id);
          document
            .getElementById("adm-history-tab-" + ACTIVITY_TABS[next].id)
            ?.focus();
        }}
      >
        {ACTIVITY_TABS.map((item) => (
          <button
            key={item.id}
            id={"adm-history-tab-" + item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            aria-controls="adm-history-results"
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id="adm-history-results"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={"adm-history-tab-" + tab}
      >
        <p className="adm-history-scope">
          {tab === "all"
            ? "All recorded activity, including account sign-ins, uploads and website saves."
            : `${activeTab.label} history · Only events for this area are shown.`}
        </p>
        <div
          className={
            "adm-history-filters" +
            (tabSections?.length === 1 ? " adm-history-filters-simple" : "")
          }
        >
          <label>
            Search history
            <input
              type="search"
              aria-label="Search history"
              value={search}
              placeholder="Entry, filename or admin"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          {(!tabSections || tabSections.length > 1) && (
            <label>
              {tab === "all" ? "Section" : "Activity type"}
              <select
                aria-label="Section"
                value={section}
                onChange={(event) => {
                  setSection(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">
                  {tab === "all"
                    ? "All sections"
                    : `All ${activeTab.label.toLowerCase()} activity`}
                </option>
                {Object.entries(ACTIVITY_SECTIONS)
                  .filter(
                    ([value]) =>
                      !tabSections ||
                      tabSections.includes(value as ActivitySection),
                  )
                  .map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Action
            <select
              aria-label="Action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All actions</option>
              {Object.entries(ACTIONS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="adm-history-note">
          {data?.startedAt ? (
            <>
              History tracking started{" "}
              {new Date(data.startedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              .{" "}
            </>
          ) : (
            ""
          )}
          Older actions cannot be reconstructed. Unsaved workspace edits are not
          recorded. The username identifies the shared admin account.
        </p>
        {error && (
          <div className="adm-error" role="alert">
            {error}{" "}
            <button onClick={() => setReload((value) => value + 1)}>
              Retry history
            </button>
          </div>
        )}
        <div role="status" className="adm-history-status">
          {loading
            ? "Loading history…"
            : data
              ? `${data.total} ${data.total === 1 ? "event" : "events"} found`
              : ""}
        </div>
        {!error && data && (
          <>
            <div className="adm-table-scroll" aria-busy={loading}>
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Entry / file</th>
                    <th>Section</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id}>
                      <td data-label="When">
                        <strong>
                          <ActivityTime value={event.at} />
                        </strong>
                        <small>
                          {new Date(event.at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </small>
                      </td>
                      <td data-label="Action">
                        <span
                          className={
                            "adm-history-action adm-history-" + event.action
                          }
                        >
                          {ACTIONS[event.action]}
                        </span>
                      </td>
                      <td data-label="Entry / file">
                        <strong>{event.label}</strong>
                        {event.fields.length > 0 && (
                          <small>Changed: {event.fields.join(", ")}</small>
                        )}
                        {event.revision !== undefined && (
                          <small>Website revision {event.revision}</small>
                        )}
                        {event.fileUrl && (
                          <small className="adm-history-file">
                            {event.fileUrl} ·{" "}
                            {Math.max(1, Math.round((event.bytes || 0) / 1024))}{" "}
                            KB
                          </small>
                        )}
                        {event.action === "uploaded" && (
                          <small>
                            Uploading a file does not publish an entry.
                          </small>
                        )}
                      </td>
                      <td data-label="Section">
                        {ACTIVITY_SECTIONS[event.section as ActivitySection]}
                      </td>
                      <td data-label="Admin">{event.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && data.events.length === 0 && (
              <div className="adm-empty">
                <h3>
                  {tab === "all"
                    ? "No matching activity"
                    : `No matching ${activeTab.label.toLowerCase()} history`}
                </h3>
                <p>
                  Try another filter, or save a content change to start its
                  history.
                </p>
              </div>
            )}
            <div className="adm-history-pages">
              <button
                disabled={loading || data.page <= 1}
                onClick={() => setPage(data.page - 1)}
              >
                Previous page
              </button>
              <span>
                Page {data.page} of {data.pages}
              </span>
              <button
                disabled={loading || data.page >= data.pages}
                onClick={() => setPage(data.page + 1)}
              >
                Next page
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
