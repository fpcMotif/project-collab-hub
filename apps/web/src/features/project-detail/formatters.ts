const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDate(value?: number | null) {
  if (!value) {
    return "—";
  }

  return dateFormatter.format(value);
}

export function formatDateTime(value?: number | null) {
  if (!value) {
    return "—";
  }

  return dateTimeFormatter.format(value);
}
