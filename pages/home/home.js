const { getRecords, getSettings, saveSettings, addWindowHistory } = require('../../utils/storage');
const { getRecommendation, calculateRecordMetrics, buildCoachingFeedback } = require('../../utils/cbti');
const { minutesToDuration, addDays } = require('../../utils/time');

function toPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function buildWindowOptions() {
  const options = [];
  for (let min = 330; min <= 540; min += 15) {
    options.push({
      value: min,
      label: minutesToDuration(min)
    });
  }
  return options;
}

Page({
  data: {
    fixedWakeTime: '07:00',
    recordCount: 0,
    latestDate: '-',
    latestSleep: '-',
    latestEfficiency: '-',
    timeRangeText: '首周仅记录',
    isRecordOnly: true,
    suggestedBedtime: '-',
    suggestedWakeTime: '-',
    sleepWindow: '-',
    nextSleepWindow: '',
    cycleProgress: '0/7',
    canApplyWindow: false,
    windowOptions: buildWindowOptions(),
    selectedWindowIndex: 7,
    hasCustomWindow: false,
    avgSleep: '-',
    avgEfficiency: '-',
    reason: '',
    pendingSummaryHint: '',
    habitTips: [],
    coachingTips: [],
    encouragementText: ''
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const records = getRecords();
    const settings = getSettings();
    const recommendation = getRecommendation(records, settings);
    const coaching = buildCoachingFeedback(records);
    this._settings = settings;
    this._recommendation = recommendation;

    let latestDate = '-';
    let latestSleep = '-';
    let latestEfficiency = '-';

    if (records.length > 0) {
      const latest = records[0];
      const metrics = calculateRecordMetrics(latest);
      latestDate = latest.date;
      latestSleep = minutesToDuration(metrics.totalSleepMin);
      latestEfficiency = toPercent(metrics.sleepEfficiency);
    }

    const selectedWindowIndex = this.data.windowOptions.findIndex((item) => item.value === settings.activeWindowMin);

    this.setData({
      fixedWakeTime: settings.fixedWakeTime,
      recordCount: records.length,
      latestDate,
      latestSleep,
      latestEfficiency,
      isRecordOnly: recommendation.suggestedBedtime === '-',
      timeRangeText: recommendation.suggestedBedtime === '-' ? '首周仅记录' : `${recommendation.suggestedBedtime} - ${recommendation.wakeTime}`,
      suggestedBedtime: recommendation.suggestedBedtime,
      suggestedWakeTime: recommendation.wakeTime,
      sleepWindow: recommendation.sleepWindowMin > 0 ? minutesToDuration(recommendation.sleepWindowMin) : '-',
      nextSleepWindow: recommendation.canApplyWindow && recommendation.candidateWindowMin && recommendation.candidateWindowMin !== recommendation.sleepWindowMin
        ? minutesToDuration(recommendation.candidateWindowMin)
        : '',
      cycleProgress: `${recommendation.cycleDays || 0}/7`,
      canApplyWindow: !!recommendation.canApplyWindow,
      hasCustomWindow: !!settings.hasCustomWindow,
      selectedWindowIndex: selectedWindowIndex >= 0 ? selectedWindowIndex : 7,
      avgSleep: recommendation.avgSleepMin ? minutesToDuration(recommendation.avgSleepMin) : '-',
      avgEfficiency: recommendation.avgEfficiency ? toPercent(recommendation.avgEfficiency) : '-',
      reason: recommendation.reason,
      pendingSummaryHint: recommendation.pendingSummaryHint || '',
      habitTips: recommendation.habitTips,
      coachingTips: coaching.instantTips || [],
      encouragementText: coaching.encouragement || ''
    });
  },

  onWakeTimeChange(e) {
    const fixedWakeTime = e.detail.value;
    saveSettings({ fixedWakeTime });
    this.loadData();
  },

  onWindowOptionChange(e) {
    const index = Number(e.detail.value);
    const option = this.data.windowOptions[index];
    if (!option) {
      return;
    }

    saveSettings({
      activeWindowMin: option.value,
      hasCustomWindow: true
    });

    wx.showToast({
      title: '已应用手动窗口',
      icon: 'success'
    });
    this.loadData();
  },

  onApplyWindow() {
    const recommendation = this._recommendation;
    const settings = this._settings;
    if (!recommendation || !settings || !recommendation.canApplyWindow) {
      wx.showToast({
        title: '当前还未到生效条件',
        icon: 'none'
      });
      return;
    }

    const nextWindow = recommendation.candidateWindowMin;
    const currentWindow = settings.activeWindowMin;
    const analysisEndDate = recommendation.analysisEndDate || '';
    const nextCycleStart = analysisEndDate ? addDays(analysisEndDate, 1) : '';

    addWindowHistory({
      appliedAt: Date.now(),
      fromWindowMin: currentWindow,
      toWindowMin: nextWindow,
      fixedWakeTime: settings.fixedWakeTime,
      basedOnStartDate: recommendation.analysisStartDate,
      basedOnEndDate: analysisEndDate,
      avgSleepMin: recommendation.avgSleepMin,
      avgEfficiency: recommendation.avgEfficiency
    });

    saveSettings({
      activeWindowMin: nextWindow,
      cycleStartDate: nextCycleStart,
      hasCustomWindow: true
    });

    wx.showToast({
      title: nextWindow === currentWindow ? '窗口不变，已进入下一周期' : '已生效，进入下一周期',
      icon: 'success'
    });

    this.loadData();
  },

  goDiary() {
    wx.navigateTo({ url: '/pages/diary/diary' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goTemplates() {
    wx.navigateTo({ url: '/pages/templates/templates' });
  },

  goGuide() {
    wx.navigateTo({ url: '/pages/guide/guide' });
  }
});
