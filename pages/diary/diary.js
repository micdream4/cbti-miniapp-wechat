const { upsertRecord, getRecordByDate } = require('../../utils/storage');
const { calculateRecordMetrics } = require('../../utils/cbti');
const { getTodayDateText, minutesToDuration } = require('../../utils/time');

function createDefaultForm() {
  return {
    date: getTodayDateText(),
    inBedTime: '23:30',
    outBedTime: '07:00',
    sleepLatencyMin: 30,
    wakeAfterSleepOnsetMin: 30,
    earlyWakeMin: 0,
    napMin: 0,
    caffeineAfter2pm: false,
    alcoholTonight: false,
    screenWithin1h: true,
    intenseEveningExercise: false,
    daytimeExercise: false,
    morningSunlight20min: false,
    relaxationPractice: false,
    screenFree30min: false,
    bedroomComfort: false,
    note: ''
  };
}

function toSafeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
}

Page({
  data: {
    isEdit: false,
    form: createDefaultForm(),
    previewSleep: '-',
    previewEfficiency: '-'
  },

  onLoad(options) {
    if (options && options.date) {
      const record = getRecordByDate(options.date);
      if (record) {
        const normalizedRecord = {
          ...record
        };

        // Backward compatibility for old records.
        if (typeof normalizedRecord.daytimeExercise !== 'boolean' && typeof normalizedRecord.exerciseDay === 'boolean') {
          normalizedRecord.daytimeExercise = normalizedRecord.exerciseDay;
        }

        this.setData({
          isEdit: true,
          form: {
            ...createDefaultForm(),
            ...normalizedRecord
          }
        });
      }
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
    this.setData({ 'form.date': e.detail.value });
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

  onSubmit() {
    const form = {
      ...this.data.form,
      sleepLatencyMin: toSafeNumber(this.data.form.sleepLatencyMin),
      wakeAfterSleepOnsetMin: toSafeNumber(this.data.form.wakeAfterSleepOnsetMin),
      earlyWakeMin: toSafeNumber(this.data.form.earlyWakeMin),
      napMin: toSafeNumber(this.data.form.napMin)
    };

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
