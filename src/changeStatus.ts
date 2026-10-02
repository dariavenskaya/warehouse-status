import { Laptop, Status } from "./types";

const STATUS_LABEL: Record<Status, string> = {
  in_stock: "На складе",
  reserved: "Бронь",
  sold: "Продан",
  written_off: "Списан",
};

/**
 * Changes laptop warehouse status if the transition is allowed.
 * Returns a new laptop object (does not mutate the input).
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

  if (currentStatus === nextStatus) {
    throw new Error(
      `Статус уже «${STATUS_LABEL[currentStatus]}». Переход не требуется.`
    );
  }

  return {
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
}
