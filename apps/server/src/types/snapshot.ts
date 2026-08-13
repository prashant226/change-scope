/**
 * Generic, page-agnostic snapshot schema.
 *
 * IMPORTANT: nothing in this file (or anything that produces it) may reference
 * ShopKart, "price", "product", or any other page-specific concept. The schema
 * must emerge from whatever page is captured — see MASTER BUILD PROMPT §3/§43/§44.
 */

export interface ElementVisual {
  display?: string;
  visibility?: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  width?: number;
  height?: number;
}

export interface ElementBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementValue {
  kind: "text" | "number" | "date" | "boolean" | "unknown";
  raw: string;
  normalized?: string | number | boolean;
}

export interface SnapshotElement {
  /** Stable identity derived from role + hierarchy + nearby text — NOT a raw DOM index. */
  id: string;
  tag: string;
  role?: string;
  text?: {
    raw: string;
    normalized: string;
  };
  value?: ElementValue;
  attributes?: {
    href?: string;
    ariaLabel?: string;
    alt?: string;
    src?: string;
    [key: string]: string | undefined;
  };
  state?: {
    visible: boolean;
    enabled: boolean;
  };
  visual?: ElementVisual;
  bbox?: ElementBBox;
  /** Hash of the element's stable identity signals — used for matching across snapshots. */
  fingerprint: string;
}

export interface SnapshotSection {
  id: string;
  heading?: string;
  position: number;
  elements: SnapshotElement[];
}

export interface SnapshotMetadata {
  url: string;
  finalUrl: string;
  title: string;
  capturedAt: string;
  status: "complete" | "partial";
}

export interface SnapshotMedia {
  images: Array<{
    id: string;
    src: string;
    alt?: string;
    fingerprint: string;
  }>;
}

export interface SnapshotFunctional {
  buttons: SnapshotElement[];
  links: SnapshotElement[];
  states: Array<{ label: string; value: string }>;
}

export interface PageSnapshot {
  metadata: SnapshotMetadata;
  sections: SnapshotSection[];
  functional: SnapshotFunctional;
  media: SnapshotMedia;
  /** Lightweight structural stats surfaced to the user on first run (§5). */
  stats: {
    sectionCount: number;
    contentElementCount: number;
    interactiveElementCount: number;
    imageCount: number;
  };
}
