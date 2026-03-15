const { upsertRecord, getRecordByDate, getSettings, getRecords, deleteRecord } = require('../../utils/storage');
const { calculateRecordMetrics } = require('../../utils/cbti');
const { getTodayDateText, minutesToDuration } = require('../../utils/time');

function createDefaultForm(seed) {
  const preset = seed || {};
  return {
    date: getTodayDateText(),
    inBedTime: Object.prototype.hasOwnProperty.call(preset, 'inBedTime') ? preset.inBedTime : '',
    outBedTime: Object.prototype.hasOwnProperty.call(preset, 'outBedTime') ? preset.outBedTime : '',
    sleepLatencyMin: 0,
    wakeAfterSleepOnsetMin: 0,
    earlyWakeMin: 0,
    outOfBedAwakeMin: 0,
    napMin: 0,
    caffeineAfter2pm: !!preset.caffeineAfter2pm,
    alcoholTonight: !!preset.alcoholTonight,
    screenWithin1h: !!preset.screenWithin1h,
    intenseEveningExercise: !!preset.intenseEveningExercise,
    daytimeExercise: !!preset.daytimeExercise,
    morningSunlight20min: !!preset.morningSunlight20min,
    relaxationPractice: !!preset.relaxationPractice,
    screenFree30min: !!preset.screenFree30min,
    bedroomComfort: !!preset.bedroomComfort,
    note: Object.prototype.hasOwnProperty.call(preset, 'note') ? preset.note : ''
  };
}

function toSafeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
}

function normalizeRecord(record) {
  const normalizedRecord = {
    ...record
  };

  // Backward compatibility for old records.
  if (typeof normalizedRecord.daytimeExercise !== 'boolean' && typeof normalizedRecord.exerciseDay === 'boolean') {
    normalizedRecord.daytimeExercise = normalizedRecord.exerciseDay;
  }

  return normalizedRecord;
}

function findPreviousRecord(records, targetDate) {
  const candidates = (records || [])
    .map(normalizeRecord)
    .filter((item) => item && item.date && item.date < targetDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return candidates[0] || null;
}

function buildDefaultFormForDate(dateText, records, settings) {
  const previousRecord = findPreviousRecord(records, dateText) || {};
  return createDefaultForm({
    date: dateText,
    outBedTime: (settings && settings.fixedWakeTime) || '07:00',
    inBedTime: previousRecord.inBedTime || '',
    caffeineAfter2pm: previousRecord.caffeineAfter2pm,
    alcoholTonight: previousRecord.alcoholTonight,
    screenWithin1h: previousRecord.screenWithin1h,
    intenseEveningExercise: previousRecord.intenseEveningExercise,
    daytimeExercise: previousRecord.daytimeExercise,
    morningSunlight20min: previousRecord.morningSunlight20min,
    relaxationPractice: previousRecord.relaxationPractice,
    screenFree30min: previousRecord.screenFree30min,
    bedroomComfort: previousRecord.bedroomComfort,
    note: ''
  });
}

Page({
  data: {
    launchMode: 'record',
    isEdit: false,
    originalDate: '',
    form: createDefaultForm(),
    previewSleep: '-',
    previewEfficiency: '-',
    noteFocus: false,
    noteKeyboardHeight: 0
  },

  onLoad(options) {
    const settings = getSettings();
    const records = getRecords();
    this._settings = settings;
    this._records = records;
    const launchMode = options && options.date ? 'history-edit' : 'record';

    const targetDate = options && options.date ? options.date : getTodayDateText();
    const defaultForm = buildDefaultFormForDate(targetDate, records, settings);
    const existingRecord = getRecordByDate(targetDate);

    if (existingRecord) {
      this.setData({
        launchMode,
        isEdit: true,
        originalDate: targetDate,
        form: {
          ...defaultForm,
          ...normalizeRecord(existingRecord),
          date: targetDate
        }
      });
    } else {
      this.setData({
        launchMode,
        isEdit: false,
        originalDate: '',
        form: {
          ...defaultForm,
          date: targetDate
        }
      });
    }

    this.updatePreview();
  },

  updatePreview() {
    const metrics = calculateRecordMetrics(this.data.form);
    this.setData({
      previewSleep: minutesToDuration(metrics.totalSleepMin),
      previewEfficiency: `${Math.round(metrics.sleepEfficiency * 100)}%`
    });
  },

  onDateChange(e) {
    const nextDate = e.detail.value;
    const currentDate = this.data.form.date;

    if (!nextDate || nextDate === currentDate) {
      return;
    }

    const records = this._records || getRecords();
    const settings = this._settings || getSettings();
    const existingRecord = getRecordByDate(nextDate);
    const isHistoryEdit = this.data.launchMode === 'history-edit';

    if (existingRecord) {
      if (isHistoryEdit && this.data.originalDate === nextDate) {
        this.setData({
          launchMode: 'history-edit',
          isEdit: true,
          originalDate: nextDate,
          form: {
            ...buildDefaultFormForDate(nextDate, records, settings),
            ...normalizeRecord(existingRecord),
            date: nextDate
          }
        });
        this.updatePreview();
        return;
      }

      wx.showModal({
        title: '该日期已有记录',
        content: '请进入历史记录中编辑，或先删除该日期记录后再重新填写。',
        confirmText: '查看历史',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/history/history' });
          }
        }
      });
      return;
    }

    if (isHistoryEdit) {
      this.setData({
        launchMode: 'history-edit',
        isEdit: true,
        originalDate: this.data.originalDate,
        'form.date': nextDate
      });
    } else {
      this.setData({
        launchMode: 'record',
        isEdit: false,
        originalDate: '',
        form: {
          ...buildDefaultFormForDate(nextDate, records, settings),
          date: nextDate
        }
      });
    }
    this.updatePreview();
  },

  onTimeChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
    this.updatePreview();
  },

  onNumberInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: toSafeNumber(e.detail.value) });
    this.updatePreview();
  },

  onSwitchChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: !!e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value });
  },

  onNoteFocus() {
    this.setData({ noteFocus: true });
  },

  onNoteBlur() {
    this.setData({
      noteFocus: false,
      noteKeyboardHeight: 0
    });
  },

  onNoteKeyboardHeightChange(e) {
    const height = Number(e.detail && e.detail.height) || 0;
    this.setData({ noteKeyboardHeight: height });
  },

  onSubmit() {
    const form = {
      ...this.data.form,
      sleepLatencyMin: toSafeNumber(this.data.form.sleepLatencyMin),
      wakeAfterSleepOnsetMin: toSafeNumber(this.data.form.wakeAfterSleepOnsetMin),
      earlyWakeMin: toSafeNumber(this.data.form.earlyWakeMin),
      outOfBedAwakeMin: toSafeNumber(this.data.form.outOfBedAwakeMin),
      napMin: toSafeNumber(this.data.form.napMin)
    };

    if (!form.inBedTime || !form.outBedTime) {
      wx.showToast({
        title: '请先填写上床和起床时间',
        icon: 'none'
      });
      return;
    }

    if (this.data.launchMode === 'history-edit' && this.data.isEdit && this.data.originalDate && this.data.originalDate !== form.date) {
      const targetRecord = getRecordByDate(form.date);
      if (targetRecord) {
        wx.showToast({
          title: '该日期已有记录',
          icon: 'none'
        });
        return;
      }

      deleteRecord(this.data.originalDate);
    }

    upsertRecord(form);

    wx.showToast({
      title: '已保存',
      icon: 'success'
    });

    setTimeout(() => {
      wx.navigateBack({
        fail: () => {
          wx.redirectTo({ url: '/pages/home/home' });
        }
      });
    }, 500);
  }
});
