/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

import type * as approvalGates from "../approvalGates.js";
import type * as auditEvents from "../auditEvents.js";
import type * as board from "../board.js";
import type * as comments from "../comments.js";
import type * as departmentTracks from "../departmentTracks.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as projects from "../projects.js";
import type * as projectTemplates from "../projectTemplates.js";
import type * as workItems from "../workItems.js";

declare const fullApi: ApiFromModules<{
  approvalGates: typeof approvalGates;
  auditEvents: typeof auditEvents;
  board: typeof board;
  comments: typeof comments;
  departmentTracks: typeof departmentTracks;
  http: typeof http;
  notifications: typeof notifications;
  projectTemplates: typeof projectTemplates;
  projects: typeof projects;
  workItems: typeof workItems;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
