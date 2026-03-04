const { getRecords, deleteRecord } = require('../../utils/storage');
const { calculateRecordMetrics } = require('../../utils/cbti');
const { minutesToDuration } = require('../../utils/time');

Page({
  data: {
    records: []
  },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    const records = getRecords();
    const list = records.map((item) => {
      const metrics = calculateRecordMetrics(item);
      return {
        ...item,
        sleepText: minutesToDuration(metrics.totalSleepMin),
        efficiencyText: `${Math.round(metrics.sleepEfficiency * 100)}%`,
        inBedText: minutesToDuration(metrics.timeInBedMin)
      };
    });
    this.setData({ records: list });
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
