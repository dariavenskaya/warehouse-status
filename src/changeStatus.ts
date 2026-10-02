import { Laptop, Status } from "./types";

const STATUS_LABEL: Record<Status, string> = {
  in_stock: "На складе",
  reserved: "Бронь",
  sold: "Продан",
  written_off: "Списан",
};

const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  in_stock: ["reserved", "sold", "written_off"],
  reserved: ["in_stock", "sold"],
  sold: ["in_stock"],
  written_off: [],
};

/** Inclusive: a return at soldAt + 14 days is still allowed. */
const RETURN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && Object.hasOwn(STATUS_LABEL, value);
}

function formatUtc(date: Date): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${formatted} UTC`;
}

function assertSoldReturn(soldAt: Date | undefined, at: Date): void {
  if (!soldAt) {
    throw new Error(
      "Нельзя вернуть ноутбук на склад: дата продажи не указана."
    );
  }

  if (Number.isNaN(soldAt.getTime())) {
    throw new Error(
      "Нельзя вернуть ноутбук на склад: дата продажи некорректна."
    );
  }

  const elapsedMs = at.getTime() - soldAt.getTime();

  if (elapsedMs < 0) {
    throw new Error("Возврат не может быть раньше даты продажи.");
  }

  if (elapsedMs > RETURN_WINDOW_MS) {
    throw new Error(
      `Возврат на склад возможен не позднее 14 дней после продажи (${formatUtc(
        soldAt
      )}).`
    );
  }
}

/**
 * Changes laptop warehouse status if the transition is allowed.
 * Returns a new laptop object (does not mutate the input).
 * Every successful transition is appended to history.
 * A sold laptop can return to stock only within 14 days of soldAt.
 *
 * @param laptop - current laptop state
 * @param nextStatus - status to transition to
 * @param at - moment of the change; defaults to now
 */
export function changeStatus(
  laptop: Laptop,
  nextStatus: Status,
  at: Date = new Date()
): Laptop {
  const { status: currentStatus } = laptop;

  if (!isStatus(currentStatus)) {
    throw new Error(`Неизвестный текущий статус «${String(currentStatus)}».`);
  }

  if (!isStatus(nextStatus)) {
    throw new Error(`Неизвестный статус «${String(nextStatus)}».`);
  }

  if (currentStatus === nextStatus) {
    throw new Error(
      `Статус уже «${STATUS_LABEL[currentStatus]}». Переход не требуется.`
    );
  }

  if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    if (currentStatus === "written_off") {
      throw new Error(
        `Статус «${STATUS_LABEL.written_off}» окончательный. Дальнейшие переходы невозможны.`
      );
    }

    throw new Error(
      `Переход из «${STATUS_LABEL[currentStatus]}» в «${STATUS_LABEL[nextStatus]}» невозможен.`
    );
  }

  if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
    throw new Error("Некорректная дата перехода.");
  }

  if (currentStatus === "sold") {
    assertSoldReturn(laptop.soldAt, at);
  }

  const nextLaptop: Laptop = {
    ...laptop,
    status: nextStatus,
    history: [
      ...laptop.history,
      {
        from: currentStatus,
        to: nextStatus,
        at,
      },
    ],
  };

  if (nextStatus === "sold") {
    nextLaptop.soldAt = at;
  }

  return nextLaptop;
}
