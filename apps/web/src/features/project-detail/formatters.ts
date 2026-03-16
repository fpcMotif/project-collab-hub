const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const formatDate = (value?: number | null) => {
  if (!value) {
    return "—";
  }

  return dateFormatter.format(value);
};

export const formatDateTime = (value?: number | null) => {
  if (!value) {
    return "—";
  }

  return dateTimeFormatter.format(value);
};
