import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SiteContent } from "./content-types";
import {
  ACTIVITY_SECTIONS,
  type ActivityAction,
  type ActivityEvent,
  type ActivitySection,
} from "./activity-types";

export function activityEvent(
  actor: string,
  action: ActivityAction,
  section: ActivitySection,
  label: string,
  extra: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    entityId: "",
    fields: [],
    ...extra,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor,
    action,
    section,
    label,
  };
}
function fieldsChanged(
  before: Record<string, any>,
  after: Record<string, any>,
  prefix = "",
): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .flatMap((key) => {
      if (key === "createdAt" || key === "updatedAt") return [];
      if (isDeepStrictEqual(before[key], after[key])) return [];
      const field = prefix + key;
      if (
        before[key] &&
        after[key] &&
        typeof before[key] === "object" &&
        typeof after[key] === "object" &&
        !Array.isArray(before[key]) &&
        !Array.isArray(after[key])
      )
        return fieldsChanged(before[key], after[key], field + ".");
      return [field];
    });
}
export function contentActivity(
  before: SiteContent,
  after: SiteContent,
  actor: string,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const compare = (
    section: ActivitySection,
    oldRows: any[],
    newRows: any[],
    key = "id",
    parent = "",
    parentId = "",
  ) => {
    const previous = new Map(oldRows.map((row) => [row[key], row]));
    const current = new Map(newRows.map((row) => [row[key], row]));
    const label = (row: any, index: number) =>
      parent
        ? `${parent} — ${row.caption || `Photo ${index + 1}`}`
        : row.name || row.title || row.label || row.code || "Landing image";
    const entityId = (row: any) =>
      section === "galleryPhotos" ? `${parentId}/${row[key]}` : row[key];
    const displayLabel = label;
    newRows.forEach((row, index) => {
      const old = previous.get(row[key]);
      if (!old)
        events.push(
          activityEvent(actor, "created", section, displayLabel(row, index), {
            entityId: entityId(row),
            revision: after.revision,
          }),
        );
      else {
        const fields = fieldsChanged(old, row);
        if (fields.length)
          events.push(
            activityEvent(actor, "updated", section, displayLabel(row, index), {
              entityId: entityId(row),
              fields,
              revision: after.revision,
            }),
          );
      }
    });
    oldRows.forEach((row, index) => {
      if (!current.has(row[key]))
        events.push(
          activityEvent(actor, "deleted", section, displayLabel(row, index), {
            entityId: entityId(row),
            revision: after.revision,
          }),
        );
    });
    const oldOrder = oldRows
      .filter((row) => current.has(row[key]))
      .map((row) => row[key]);
    const newOrder = newRows
      .filter((row) => previous.has(row[key]))
      .map((row) => row[key]);
    if (!isDeepStrictEqual(oldOrder, newOrder))
      events.push(
        activityEvent(
          actor,
          "reordered",
          section,
          parent || ACTIVITY_SECTIONS[section],
          { revision: after.revision, fields: ["order"] },
        ),
      );
  };
  for (const section of [
    "landingImages",
    "products",
    "dealers",
    "colours",
    "shadeCards",
    "galleryProjects",
    "galleryAds",
  ] as const)
    compare(
      section,
      before[section],
      after[section],
      section === "colours" ? "code" : "id",
    );
  const projects = new Map(
    before.galleryProjects.map((project) => [project.id, project]),
  );
  for (const project of after.galleryProjects) {
    compare(
      "galleryPhotos",
      projects.get(project.id)?.photos || [],
      project.photos,
      "id",
      project.title,
      project.id,
    );
    projects.delete(project.id);
  }
  for (const project of projects.values())
    compare(
      "galleryPhotos",
      project.photos,
      [],
      "id",
      project.title,
      project.id,
    );
  events.push(
    activityEvent(
      actor,
      "published",
      "website",
      events.length
        ? `Saved ${events.length} content changes`
        : "Saved without content changes",
      { revision: after.revision },
    ),
  );
  return events;
}
