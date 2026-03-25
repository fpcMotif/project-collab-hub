import { describe, expect, it, mock } from "bun:test";

import { Effect, Layer } from "effect";

import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  FeishuBaseService,
  FeishuBaseServiceLive,
} from "./feishu-base-service.js";

const baseParams = {
  appToken: "app",
  fields: { name: "x" },
  tableId: "tbl",
} as const;

const createTestLayer = ({
  create = mock().mockResolvedValue({
    code: 0,
    data: { record: { fields: { name: "x" }, record_id: "rec-1" } },
  }),
  get = mock().mockResolvedValue({
    code: 0,
    data: { record: { fields: {}, record_id: "rec-1" } },
  }),
  list = mock().mockResolvedValue({
    code: 0,
    data: {
      has_more: false,
      items: [{ fields: { a: 1 }, record_id: "r1" }],
      total: 1,
    },
  }),
  batchCreate = mock().mockResolvedValue({
    code: 0,
    data: {
      records: [{ fields: {}, record_id: "r1" }],
    },
  }),
  update = mock().mockResolvedValue({
    code: 0,
    data: { record: { fields: {}, record_id: "rec-1" } },
  }),
  deleteRecord = mock().mockResolvedValue({ code: 0 }),
}: {
  readonly batchCreate?: ReturnType<typeof mock>;
  readonly create?: ReturnType<typeof mock>;
  readonly deleteRecord?: ReturnType<typeof mock>;
  readonly get?: ReturnType<typeof mock>;
  readonly list?: ReturnType<typeof mock>;
  readonly update?: ReturnType<typeof mock>;
} = {}) =>
  Layer.provide(
    FeishuBaseServiceLive,
    Layer.succeed(FeishuAuthService, {
      client: {
        bitable: {
          v1: {
            appTableRecord: {
              batchCreate,
              create,
              delete: deleteRecord,
              get,
              list,
              update,
            },
          },
        },
      },
      getTenantAccessToken: () => Effect.succeed("token"),
    } as unknown as FeishuAuthService)
  );

const runCreate = (layer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuBaseService.pipe(
      Effect.andThen((s) => s.createRecord(baseParams)),
      Effect.provide(layer)
    )
  );

describe("FeishuBaseService", () => {
  it("createRecord returns parsed record id and fields", async () => {
    const layer = createTestLayer();
    const result = await runCreate(layer);
    expect(result).toEqual({ fields: { name: "x" }, recordId: "rec-1" });
  });

  it("createRecord fails when record_id is missing", async () => {
    const create = mock().mockResolvedValue({
      code: 0,
      data: { record: { fields: {} } },
    });
    const layer = createTestLayer({ create });

    await expect(runCreate(layer)).rejects.toThrow("No record_id in response");
  });

  it("createRecord fails on non-zero Feishu code", async () => {
    const create = mock().mockResolvedValue({
      code: 999,
      msg: "bad",
    });
    const layer = createTestLayer({ create });

    await expect(runCreate(layer)).rejects.toThrow(
      "Failed to create Base record: Feishu API failed with code 999: bad"
    );
  });

  it("listRecords maps items and totals", async () => {
    const layer = createTestLayer();
    const result = await Effect.runPromise(
      FeishuBaseService.pipe(
        Effect.andThen((s) => s.listRecords({ appToken: "a", tableId: "t" })),
        Effect.provide(layer)
      )
    );
    expect(result.total).toBe(1);
    expect(result.records[0]?.recordId).toBe("r1");
    expect(result.hasMore).toBe(false);
  });

  it("batchCreateRecords maps each record", async () => {
    const layer = createTestLayer();
    const result = await Effect.runPromise(
      FeishuBaseService.pipe(
        Effect.andThen((s) =>
          s.batchCreateRecords({
            appToken: "a",
            records: [{ fields: { x: 1 } }],
            tableId: "t",
          })
        ),
        Effect.provide(layer)
      )
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.recordId).toBe("r1");
  });

  it("deleteRecord completes when Feishu returns success", async () => {
    const deleteRecord = mock().mockResolvedValue({ code: 0 });
    const layer = createTestLayer({ deleteRecord });
    await Effect.runPromise(
      FeishuBaseService.pipe(
        Effect.andThen((s) =>
          s.deleteRecord({
            appToken: "a",
            recordId: "r",
            tableId: "t",
          })
        ),
        Effect.provide(layer)
      )
    );
    expect(deleteRecord).toHaveBeenCalled();
  });
});
