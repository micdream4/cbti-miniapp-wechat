const RECORDS_KEY = 'cbti_records_v1';
const SETTINGS_KEY = 'cbti_settings_v1';
const WINDOW_HISTORY_KEY = 'cbti_window_history_v1';

const DEFAULT_SETTINGS = {
  fixedWakeTime: '07:00',
  activeWindowMin: 435,
  cycleStartDate: '',
  hasCustomWindow: false
};

function getRecords() {
  const records = wx.getStorageSync(RECORDS_KEY) || [];
  records.sort((a, b) => (a.date < b.date ? 1 : -1));
  return records;
}

function saveRecords(records) {
  wx.setStorageSync(RECORDS_KEY, records);
}

function upsertRecord(record) {
  if (!record || !record.date) {
    return;
  }
  const current = getRecords();
  const index = current.findIndex((item) => item.date === record.date);
  const nextRecord = {
    ...record,
    updatedAt: Date.now()
  };

  if (index >= 0) {
    current[index] = {
      ...current[index],
      ...nextRecord
    };
  } else {
    current.push({
      ...nextRecord,
      createdAt: Date.now()
    });
  }

  current.sort((a, b) => (a.date < b.date ? 1 : -1));
  saveRecords(current);
}

function deleteRecord(date) {
  const current = getRecords();
  const next = current.filter((item) => item.date !== date);
  saveRecords(next);
}

function getRecordByDate(date) {
  const current = getRecords();
  return current.find((item) => item.date === date) || null;
}

function getSettings() {
  const settings = wx.getStorageSync(SETTINGS_KEY) || {};
  return {
    ...DEFAULT_SETTINGS,
    ...settings
  };
}

function saveSettings(settings) {
  wx.setStorageSync(SETTINGS_KEY, {
    ...getSettings(),
    ...settings
  });
}

function getWindowHistory() {
  const items = wx.getStorageSync(WINDOW_HISTORY_KEY) || [];
  items.sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1));
  return items;
}

function addWindowHistory(item) {
  const current = getWindowHistory();
  current.unshift({
    ...item,
    createdAt: Date.now()
  });
  wx.setStorageSync(WINDOW_HISTORY_KEY, current);
}

module.exports = {
  getRecords,
  upsertRecord,
  deleteRecord,
  getRecordByDate,
  getSettings,
  saveSettings,
  getWindowHistory,
  addWindowHistory
};
