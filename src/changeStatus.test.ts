import { describe, expect, it } from "@jest/globals";
import { changeStatus } from "./changeStatus";
import { Laptop, Status } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const LABEL: Record<Status, string> = {
  in_stock: "На складе",
  reserved: "Бронь",
  sold: "Продан",
  written_off: "Списан",
};

const SOLD_AT = new Date("2026-01-01T12:00:00.000Z");

function laptop(overrides: Partial<Laptop> = {}): Laptop {
  return {
    id: "laptop-1",
    status: "in_stock",
    history: [],
    ...overrides,
  };
}

function expectRejected(
  source: Laptop,
  nextStatus: Status,
  at: Date,
  message: string
): void {
  const status = source.status;
  const soldAt = source.soldAt;
  const history = source.history;

  expect(() => changeStatus(source, nextStatus, at)).toThrow(
    new Error(message)
  );

  expect(source.status).toBe(status);
  expect(source.soldAt).toBe(soldAt);
  expect(source.history).toBe(history);
}

describe("changeStatus", () => {
  describe("allowed transitions", () => {
    const transitions: Array<{ from: Status; to: Status }> = [
      { from: "in_stock", to: "reserved" },
      { from: "in_stock", to: "sold" },
      { from: "in_stock", to: "written_off" },
      { from: "reserved", to: "in_stock" },
      { from: "reserved", to: "sold" },
      { from: "sold", to: "in_stock" },
    ];

    it.each(transitions)(
      "moves $from to $to and records history",
      ({ from, to }) => {
        const at = new Date("2026-06-10T12:00:00.000Z");
        const soldAt =
          from === "sold" ? new Date(at.getTime() - 3 * DAY_MS) : undefined;
        const source = laptop({
          status: from,
          soldAt,
        });

        const result = changeStatus(source, to, at);

        expect(result).not.toBe(source);
        expect(result.id).toBe(source.id);
        expect(result.status).toBe(to);
        expect(result.history).toEqual([{ from, to, at }]);
        expect(result.history).not.toBe(source.history);
        expect(result.soldAt).toBe(to === "sold" ? at : soldAt);
        expect(source.status).toBe(from);
        expect(source.soldAt).toBe(soldAt);
        expect(source.history).toEqual([]);
      }
    );

    it("uses the current time when the moment is omitted", () => {
      const before = Date.now();
      const result = changeStatus(laptop(), "reserved");
      const after = Date.now();
      const at = result.history[0]?.at;

      expect(result.status).toBe("reserved");
      expect(at).toBeInstanceOf(Date);
      expect(at.getTime()).toBeGreaterThanOrEqual(before);
      expect(at.getTime()).toBeLessThanOrEqual(after);
      expect(result.history).toEqual([
        { from: "in_stock", to: "reserved", at },
      ]);
    });
  });

  describe("history", () => {
    it("appends every transition and keeps the previous entries", () => {
      const reservedAt = new Date("2026-04-01T10:00:00.000Z");
      const soldAt = new Date("2026-04-02T10:00:00.000Z");
      const returnedAt = new Date("2026-04-06T10:00:00.000Z");
      const writtenOffAt = new Date("2026-04-07T10:00:00.000Z");

      const reserved = changeStatus(laptop(), "reserved", reservedAt);
      const sold = changeStatus(reserved, "sold", soldAt);
      const returned = changeStatus(sold, "in_stock", returnedAt);
      const writtenOff = changeStatus(returned, "written_off", writtenOffAt);

      expect(sold.soldAt).toBe(soldAt);
      expect(returned.soldAt).toBe(soldAt);
      expect(writtenOff.status).toBe("written_off");
      expect(writtenOff.history).toEqual([
        { from: "in_stock", to: "reserved", at: reservedAt },
        { from: "reserved", to: "sold", at: soldAt },
        { from: "sold", to: "in_stock", at: returnedAt },
        { from: "in_stock", to: "written_off", at: writtenOffAt },
      ]);
      expect(reserved.history).toHaveLength(1);
      expect(sold.history).toHaveLength(2);
      expect(writtenOff.history[0]).toBe(reserved.history[0]);
    });
  });

  describe("forbidden transitions", () => {
    const forbidden: Array<{ from: Status; to: Status }> = [
      { from: "reserved", to: "written_off" },
      { from: "sold", to: "reserved" },
      { from: "sold", to: "written_off" },
    ];

    it.each(forbidden)(
      "rejects $from → $to and does not write history",
      ({ from, to }) => {
        const source = laptop({
          status: from,
          soldAt: from === "sold" ? SOLD_AT : undefined,
          history: [
            {
              from: "in_stock",
              to: from,
              at: new Date("2025-12-01T00:00:00.000Z"),
            },
          ],
        });

        expectRejected(
          source,
          to,
          new Date(SOLD_AT.getTime() + DAY_MS),
          `Переход из «${LABEL[from]}» в «${LABEL[to]}» невозможен.`
        );
      }
    );

    it.each(["in_stock", "reserved", "sold"] as const)(
      "rejects staying in %s",
      (status) => {
        const source = laptop({
          status,
          soldAt: status === "sold" ? SOLD_AT : undefined,
          history: [
            {
              from: "in_stock",
              to: status,
              at: SOLD_AT,
            },
          ],
        });

        expectRejected(
          source,
          status,
          new Date("2026-02-01T12:00:00.000Z"),
          `Статус уже «${LABEL[status]}». Переход не требуется.`
        );
      }
    );

    it.each(["in_stock", "reserved", "sold", "written_off"] as const)(
      "rejects leaving written_off for %s",
      (nextStatus) => {
        const source = laptop({
          status: "written_off",
          history: [
            {
              from: "in_stock",
              to: "written_off",
              at: SOLD_AT,
            },
          ],
        });

        expectRejected(
          source,
          nextStatus,
          new Date("2026-03-01T12:00:00.000Z"),
          nextStatus === "written_off"
            ? `Статус уже «${LABEL.written_off}». Переход не требуется.`
            : `Статус «${LABEL.written_off}» окончательный. Дальнейшие переходы невозможны.`
        );
      }
    );
  });

  describe("return window", () => {
    it("accepts a return exactly 14 days after the sale", () => {
      const at = new Date(SOLD_AT.getTime() + 14 * DAY_MS);
      const source = laptop({ status: "sold", soldAt: SOLD_AT });

      const result = changeStatus(source, "in_stock", at);

      expect(result.status).toBe("in_stock");
      expect(result.soldAt).toBe(SOLD_AT);
      expect(result.history).toEqual([{ from: "sold", to: "in_stock", at }]);
      expect(source.status).toBe("sold");
      expect(source.soldAt).toBe(SOLD_AT);
      expect(source.history).toEqual([]);
    });

    it("accepts a return at the sale moment", () => {
      const source = laptop({ status: "sold", soldAt: SOLD_AT });
      const result = changeStatus(source, "in_stock", SOLD_AT);

      expect(result.status).toBe("in_stock");
      expect(result.history).toEqual([
        { from: "sold", to: "in_stock", at: SOLD_AT },
      ]);
    });

    it("rejects a return 1 millisecond after 14 days", () => {
      const source = laptop({
        status: "sold",
        soldAt: SOLD_AT,
        history: [{ from: "in_stock", to: "sold", at: SOLD_AT }],
      });

      expectRejected(
        source,
        "in_stock",
        new Date(SOLD_AT.getTime() + 14 * DAY_MS + 1),
        "Возврат на склад возможен не позднее 14 дней после продажи (01.01.2026, 12:00 UTC)."
      );
    });

    it("rejects a return earlier than the sale", () => {
      const source = laptop({ status: "sold", soldAt: SOLD_AT });

      expectRejected(
        source,
        "in_stock",
        new Date(SOLD_AT.getTime() - 1),
        "Возврат не может быть раньше даты продажи."
      );
    });

    it("rejects a return when the sale date is missing", () => {
      const source = laptop({ status: "sold" });

      expectRejected(
        source,
        "in_stock",
        new Date(SOLD_AT.getTime() + DAY_MS),
        "Нельзя вернуть ноутбук на склад: дата продажи не указана."
      );
    });

    it("rejects a return when the sale date is invalid", () => {
      const source = laptop({
        status: "sold",
        soldAt: new Date(Number.NaN),
      });

      expectRejected(
        source,
        "in_stock",
        SOLD_AT,
        "Нельзя вернуть ноутбук на склад: дата продажи некорректна."
      );
    });
  });

  describe("edge cases", () => {
    it("rejects an unknown current status", () => {
      const source = laptop({ status: "archived" as Status });

      expectRejected(
        source,
        "in_stock",
        SOLD_AT,
        "Неизвестный текущий статус «archived»."
      );
    });

    it("rejects an unknown next status", () => {
      const source = laptop();

      expectRejected(
        source,
        "lost" as Status,
        SOLD_AT,
        "Неизвестный статус «lost»."
      );
    });

    it("rejects an invalid transition date and does not write history", () => {
      const source = laptop({
        history: [{ from: "reserved", to: "in_stock", at: SOLD_AT }],
      });

      expectRejected(
        source,
        "sold",
        new Date(Number.NaN),
        "Некорректная дата перехода."
      );
    });

    it("rejects a non-date timestamp", () => {
      const source = laptop();

      expectRejected(
        source,
        "reserved",
        null as unknown as Date,
        "Некорректная дата перехода."
      );
    });

    it("reports an illegal transition even if the date is invalid", () => {
      const source = laptop({ status: "reserved" });

      expectRejected(
        source,
        "written_off",
        new Date(Number.NaN),
        "Переход из «Бронь» в «Списан» невозможен."
      );
    });

    it("sets soldAt when status is sold (and stays in place on every other transition)", () => {
      const soldAt = new Date("2026-05-01T08:00:00.000Z");
      const source = laptop({ status: "sold", soldAt });

      const result = changeStatus(
        source,
        "in_stock",
        new Date("2026-05-02T08:00:00.000Z")
      );

      expect(result.status).toBe("in_stock");
      expect(result.soldAt).toBe(soldAt);
    });

    it("replace soldAt after return and then sold again", () => {
      const soldAt = new Date("2026-05-01T08:00:00.000Z");
      const source = laptop({ status: "sold", soldAt });

      const secondSaleAt = new Date("2026-05-02T08:00:00.000Z");

      const result = changeStatus(
        source,
        "in_stock",
        new Date("2026-05-02T08:00:00.000Z")
      );

      const result2 = changeStatus(result, "sold", secondSaleAt);

      expect(result.status).toBe("in_stock");
      expect(result.soldAt).toBe(soldAt);
      expect(result2.status).toBe("sold");
      expect(result2.soldAt).toBe(secondSaleAt);
    });
  });
});
