const {
  diffMinutes,
  clamp,
  roundToQuarter,
  subtractMinutes,
  minutesToDuration
} = require('./time');

function toSafeNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Math.round(num);
}

function calculateRecordMetrics(record) {
  const timeInBedMin = diffMinutes(record.inBedTime, record.outBedTime);
  const sleepLatencyMin = toSafeNumber(record.sleepLatencyMin);
  const wakeAfterSleepOnsetMin = toSafeNumber(record.wakeAfterSleepOnsetMin);
  const earlyWakeMin = toSafeNumber(record.earlyWakeMin);

  const totalWakeMin = sleepLatencyMin + wakeAfterSleepOnsetMin + earlyWakeMin;
  const totalSleepMin = Math.max(0, timeInBedMin - totalWakeMin);
  const sleepEfficiency = timeInBedMin === 0 ? 0 : totalSleepMin / timeInBedMin;

  return {
    timeInBedMin,
    totalWakeMin,
    totalSleepMin,
    sleepEfficiency
  };
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, cur) => sum + cur, 0) / values.length;
}

function getRecentRecords(records, limit) {
  const copy = [...records];
  copy.sort((a, b) => (a.date < b.date ? 1 : -1));
  return copy.slice(0, limit);
}

function getCycleRecords(records, cycleStartDate) {
  const all = getRecentRecords(records || [], (records || []).length);
  if (!cycleStartDate) {
    return all;
  }
  return all.filter((item) => item.date >= cycleStartDate);
}

function buildHabitTips(records) {
  if (!records.length) {
    return [];
  }
  const caffeineCount = records.filter((r) => !!r.caffeineAfter2pm).length;
  const alcoholCount = records.filter((r) => !!r.alcoholTonight).length;
  const screenCount = records.filter((r) => !!r.screenWithin1h).length;
  const intenseEveningExerciseCount = records.filter((r) => !!r.intenseEveningExercise).length;
  const napAvg = average(records.map((r) => toSafeNumber(r.napMin)));
  const daytimeExerciseCount = records.filter((r) => !!r.daytimeExercise || !!r.exerciseDay).length;
  const sunlightCount = records.filter((r) => !!r.morningSunlight20min).length;

  const tips = [];

  if (caffeineCount >= 2) {
    tips.push('最近一周下午咖啡因摄入较多，建议14:00后停止摄入。');
  }
  if (screenCount >= 4) {
    tips.push('睡前1小时使用电子屏幕偏多，建议改为放松训练或纸质阅读。');
  }
  if (napAvg > 30) {
    tips.push('白天小睡偏长，建议控制在20-30分钟以内。');
  }
  if (alcoholCount >= 2) {
    tips.push('酒精会打碎后半夜睡眠结构，建议暂停作为助眠手段。');
  }
  if (intenseEveningExerciseCount >= 2) {
    tips.push('近一周晚间剧烈运动较多，建议改到白天或傍晚较早时段。');
  }
  if (daytimeExerciseCount >= 4) {
    tips.push('白天规律运动做得很好，继续保持有助于提升夜间睡眠驱动力。');
  }
  if (sunlightCount >= 4) {
    tips.push('晨间户外阳光暴露做得很好，有助于稳定生物钟。');
  }

  if (!tips.length) {
    tips.push('继续保持固定起床时间和稳定作息节律。');
  }

  return tips;
}

function buildCoachingFeedback(records) {
  const recent = getRecentRecords(records || [], 7);
  if (!recent.length) {
    return {
      instantTips: ['先记录第一晚，哪怕不完美也没关系。'],
      encouragement: '你已经开始行动了，这比“等状态好再开始”更重要。'
    };
  }

  const latest = recent[0];
  const latestMetrics = calculateRecordMetrics(latest);
  const instantTips = [];

  if (latest.caffeineAfter2pm) {
    instantTips.push('今天14:00后有咖啡因，明天尝试提前到午饭前。');
  }
  if (latest.screenWithin1h) {
    instantTips.push('睡前1小时看屏幕，今晚可改成纸质阅读或呼吸放松。');
  }
  if (latest.intenseEveningExercise) {
    instantTips.push('晚间剧烈运动可能推迟入睡，建议改到白天或傍晚。');
  }
  if (toSafeNumber(latest.napMin) > 30) {
    instantTips.push('白天小睡超过30分钟，建议缩短到20-30分钟内。');
  }
  if (!latest.daytimeExercise && !latest.exerciseDay) {
    instantTips.push('白天加入轻度活动（步行也可以），有助于提升夜间睡意。');
  }
  if (!latest.morningSunlight20min) {
    instantTips.push('晨间20分钟户外光照，有助于稳定生物钟。');
  }
  if (!instantTips.length) {
    instantTips.push('今天的习惯执行不错，继续保持这个节奏。');
  }

  const metrics = recent.map(calculateRecordMetrics);
  const latest3 = metrics.slice(0, 3);
  const prev3 = metrics.slice(3, 6);
  const avgLatest3Sleep = average(latest3.map((m) => m.totalSleepMin));
  const avgLatest3Eff = average(latest3.map((m) => m.sleepEfficiency));
  const avgPrev3Sleep = average(prev3.map((m) => m.totalSleepMin));
  const avgPrev3Eff = average(prev3.map((m) => m.sleepEfficiency));

  let encouragement = '前1-2周出现波动很常见，不代表方法无效，先守住固定起床时间。';
  if (prev3.length >= 2) {
    const sleepDrop = avgPrev3Sleep - avgLatest3Sleep;
    const effDrop = avgPrev3Eff - avgLatest3Eff;
    if (sleepDrop >= 30 || effDrop >= 0.05) {
      encouragement = '最近看起来更难睡是常见过渡期，请继续按计划执行7天再评估，不要提前放弃。';
    } else if (avgLatest3Eff >= 0.88 || latestMetrics.sleepEfficiency >= 0.9) {
      encouragement = '你正在建立稳定节律，这通常是后续改善的关键起点。';
    }
  }

  return {
    instantTips: instantTips.slice(0, 3),
    encouragement
  };
}

function getRecommendation(records, options) {
  let wakeTime = '07:00';
  let activeWindowMin = 435;
  let cycleStartDate = '';
  let hasCustomWindow = false;

  if (typeof options === 'string') {
    wakeTime = options || wakeTime;
  } else if (options && typeof options === 'object') {
    wakeTime = options.fixedWakeTime || wakeTime;
    activeWindowMin = toSafeNumber(options.activeWindowMin) || activeWindowMin;
    cycleStartDate = options.cycleStartDate || '';
    hasCustomWindow = !!options.hasCustomWindow;
  }

  const baseMinWindow = 330;
  const baseMaxWindow = 540;
  activeWindowMin = roundToQuarter(clamp(activeWindowMin, baseMinWindow, baseMaxWindow));

  const cycleRecords = getCycleRecords(records || [], cycleStartDate);
  const recent = cycleRecords.slice(0, 7);
  const cycleDays = recent.length;
  const canApplyWindow = cycleDays >= 7;
  const remainingDays = Math.max(0, 7 - cycleDays);

  if (!recent.length) {
    const startWindow = activeWindowMin;
    const useManualWindow = hasCustomWindow;
    const reason = cycleStartDate
      ? '新周期已开始，请先积累7天记录，再生成下一周期窗口建议。'
      : useManualWindow
        ? '你已手动设置当前睡眠窗口，先执行并持续记录满7天。'
        : '第一周先只记录睡眠日记；满7天后系统才会给出建议执行时段。';
    return {
      hasData: false,
      suggestedBedtime: useManualWindow ? subtractMinutes(wakeTime, startWindow) : '-',
      wakeTime: useManualWindow ? wakeTime : '-',
      sleepWindowMin: useManualWindow ? startWindow : 0,
      activeWindowMin: startWindow,
      candidateWindowMin: startWindow,
      candidateBedtime: useManualWindow ? subtractMinutes(wakeTime, startWindow) : '-',
      avgSleepMin: 0,
      avgEfficiency: 0,
      cycleDays,
      remainingDays,
      canApplyWindow,
      analysisStartDate: '',
      analysisEndDate: '',
      reason,
      habitTips: []
    };
  }

  const metrics = recent.map(calculateRecordMetrics);
  const avgSleepMin = average(metrics.map((m) => m.totalSleepMin));
  const avgEfficiency = average(metrics.map((m) => m.sleepEfficiency));
  const bufferedWindowMin = roundToQuarter(clamp(avgSleepMin + 15, baseMinWindow, baseMaxWindow));

  if (!canApplyWindow) {
    const useManualWindow = hasCustomWindow;
    return {
      hasData: false,
      suggestedBedtime: useManualWindow ? subtractMinutes(wakeTime, activeWindowMin) : '-',
      wakeTime: useManualWindow ? wakeTime : '-',
      sleepWindowMin: useManualWindow ? activeWindowMin : 0,
      activeWindowMin,
      candidateWindowMin: bufferedWindowMin,
      candidateBedtime: subtractMinutes(wakeTime, bufferedWindowMin),
      avgSleepMin,
      avgEfficiency,
      cycleDays,
      remainingDays,
      canApplyWindow,
      analysisStartDate: recent[recent.length - 1].date,
      analysisEndDate: recent[0].date,
      reason: useManualWindow
        ? `当前已记录${cycleDays}天，还需${remainingDays}天完成本周期。当前执行窗口维持${minutesToDuration(activeWindowMin)}。`
        : `当前已记录${cycleDays}天，还需${remainingDays}天完成本周期。第一周先记录，满7天再自动给出建议窗口。`,
      habitTips: buildHabitTips(recent)
    };
  }

  const hasActiveWindow = hasCustomWindow || !!cycleStartDate;
  const reason = !hasActiveWindow
    ? `已满7天：首个建议窗口为${minutesToDuration(bufferedWindowMin)}，点击“生效本周窗口”后开始执行。`
    : bufferedWindowMin === activeWindowMin
      ? '已满7天：本周建议窗口与当前一致，点击“生效本周窗口”进入下一周期。'
      : `已满7天：本周建议窗口为${minutesToDuration(bufferedWindowMin)}，点击“生效本周窗口”后用于下一周期。`;

  return {
    hasData: true,
    suggestedBedtime: hasActiveWindow ? subtractMinutes(wakeTime, activeWindowMin) : '-',
    wakeTime: hasActiveWindow ? wakeTime : '-',
    sleepWindowMin: hasActiveWindow ? activeWindowMin : 0,
    activeWindowMin,
    candidateWindowMin: bufferedWindowMin,
    candidateBedtime: subtractMinutes(wakeTime, bufferedWindowMin),
    avgSleepMin,
    avgEfficiency,
    cycleDays,
    remainingDays,
    canApplyWindow,
    analysisStartDate: recent[recent.length - 1].date,
    analysisEndDate: recent[0].date,
    reason,
    habitTips: buildHabitTips(recent)
  };
}

module.exports = {
  calculateRecordMetrics,
  getRecommendation,
  buildCoachingFeedback
};
