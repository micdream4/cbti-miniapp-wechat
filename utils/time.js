const MINUTES_PER_DAY = 1440;

function toMinutes(timeText) {
  if (!timeText || typeof timeText !== 'string') {
    return 0;
  }
  const [hStr, mStr] = timeText.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return 0;
  }
  return h * 60 + m;
}

function fromMinutes(totalMinutes) {
  let value = totalMinutes % MINUTES_PER_DAY;
  if (value < 0) {
    value += MINUTES_PER_DAY;
  }
  const h = String(Math.floor(value / 60)).padStart(2, '0');
  const m = String(value % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function diffMinutes(startTime, endTime) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  let diff = end - start;
  if (diff <= 0) {
    diff += MINUTES_PER_DAY;
  }
  return diff;
}

function subtractMinutes(timeText, minutes) {
  return fromMinutes(toMinutes(timeText) - minutes);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToQuarter(minutes) {
  return Math.round(minutes / 15) * 15;
}

function minutesToDuration(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) {
    return `${m}分钟`;
  }
  return `${h}小时${m}分钟`;
}

function getTodayDateText() {
  const d = new Date();
  return dateToText(d);
}

function dateToText(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateText(dateText) {
  if (!dateText || typeof dateText !== 'string') {
    return null;
  }
  const [y, m, d] = dateText.split('-').map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(y, m - 1, d);
}

function addDays(dateText, delta) {
  const base = parseDateText(dateText);
  if (!base) {
    return dateText;
  }
  base.setDate(base.getDate() + Number(delta || 0));
  return dateToText(base);
}

module.exports = {
  toMinutes,
  fromMinutes,
  diffMinutes,
  subtractMinutes,
  clamp,
  roundToQuarter,
  minutesToDuration,
  getTodayDateText,
  addDays
};
