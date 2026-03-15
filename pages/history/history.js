const { getRecords, deleteRecord, getSettings } = require('../../utils/storage');
const { calculateRecordMetrics, buildWeeklySummaries } = require('../../utils/cbti');
const { minutesToDuration } = require('../../utils/time');

Page({
  data: {
    records: [],
    timeline: [],
    hasRecords: false
  },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    const records = getRecords();
    const settings = getSettings();
    const list = records.map((item) => {
      const metrics = calculateRecordMetrics(item);
      return {
        ...item,
        sleepText: minutesToDuration(metrics.totalSleepMin),
        efficiencyText: `${Math.round(metrics.sleepEfficiency * 100)}%`,
        inBedText: minutesToDuration(metrics.timeInBedMin)
      };
    });

    const weeklySummaries = buildWeeklySummaries(records, settings).map((item, index) => {
      const startDate = item.weekRows && item.weekRows.length ? item.weekRows[0].date : '';
      const endDate = item.weekRows && item.weekRows.length ? item.weekRows[item.weekRows.length - 1].date : '';
      return {
        ...item,
        startDate,
        endDate,
        summaryId: `${item.periodText}-${index}`,
        expanded: false
      };
    });

    const summaryByEndDate = {};
    weeklySummaries.forEach((summary) => {
      if (summary.endDate) {
        summaryByEndDate[summary.endDate] = summary;
      }
    });

    const timeline = [];
    list.forEach((record) => {
      const summary = summaryByEndDate[record.date];
      if (summary) {
        timeline.push({
          type: 'summary',
          key: `summary-${summary.summaryId}`,
          ...summary
        });
      }

      timeline.push({
        type: 'record',
        key: `record-${record.date}`,
        ...record
      });
    });

    this.setData({
      records: list,
      timeline,
      hasRecords: list.length > 0
    });
  },

  onToggleWeeklySummary(e) {
    const summaryId = e.currentTarget.dataset.summaryId;
    const next = (this.data.timeline || []).map((item) => {
      if (item.type !== 'summary' || item.summaryId !== summaryId) {
        return item;
      }
      return {
        ...item,
        expanded: !item.expanded
      };
    });
    this.setData({ timeline: next });
  },

  onEdit(e) {
    const date = e.currentTarget.dataset.date;
    wx.navigateTo({
      url: `/pages/diary/diary?date=${encodeURIComponent(date)}`
    });
  },

  onDelete(e) {
    const date = e.currentTarget.dataset.date;
    wx.showModal({
      title: '删除记录',
      content: `确定删除 ${date} 的记录吗？`,
      success: (res) => {
        if (res.confirm) {
          deleteRecord(date);
          this.loadRecords();
        }
      }
    });
  },

  goDiary() {
    wx.navigateTo({ url: '/pages/diary/diary' });
  }
});
