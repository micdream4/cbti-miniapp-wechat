const {
  toMinutes,
  diffMinutes,
  clamp,
  roundToQuarter,
  subtractMinutes,
  minutesToDuration,
  diffDateDays
} = require('./time');

function toSafeNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Math.round(num);
}

function isValidTimeText(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function calculateRecordMetrics(record) {
  const hasValidTimes = isValidTimeText(record.inBedTime) && isValidTimeText(record.outBedTime);
  const rawTimeInBedMin = hasValidTimes ? diffMinutes(record.inBedTime, record.outBedTime) : 0;
  const sleepLatencyMin = toSafeNumber(record.sleepLatencyMin);
  const wakeAfterSleepOnsetMin = toSafeNumber(record.wakeAfterSleepOnsetMin);
  const earlyWakeMin = toSafeNumber(record.earlyWakeMin);
  const outOfBedAwakeMin = toSafeNumber(record.outOfBedAwakeMin);
  const timeInBedMin = Math.max(0, rawTimeInBedMin - outOfBedAwakeMin);

  const totalWakeMin = sleepLatencyMin + wakeAfterSleepOnsetMin + earlyWakeMin;
  const totalSleepMin = Math.max(0, timeInBedMin - totalWakeMin);
  const sleepEfficiency = timeInBedMin === 0 ? 0 : totalSleepMin / timeInBedMin;

  return {
    rawTimeInBedMin,
    timeInBedMin,
    outOfBedAwakeMin,
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

function circularDistanceMinutes(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 1440 - diff);
}

function toChineseWeekIndex(index) {
  const map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  return map[index] || String(index);
}

function buildWeeklySummary(weekRecords, options, index) {
  const fixedWakeTime = (options && options.fixedWakeTime) || '07:00';
  const activeWindowMin = toSafeNumber(options && options.activeWindowMin) || 435;
  const metrics = weekRecords.map(calculateRecordMetrics);

  const avgSleepMin = average(metrics.map((m) => m.totalSleepMin));
  const avgEfficiency = average(metrics.map((m) => m.sleepEfficiency));
  const avgLatency = average(weekRecords.map((r) => toSafeNumber(r.sleepLatencyMin)));
  const avgNap = average(weekRecords.map((r) => toSafeNumber(r.napMin)));

  const anchorMin = toMinutes(fixedWakeTime);
  const anchorHitDays = weekRecords.filter((r) => {
    if (!r.outBedTime) {
      return false;
    }
    return circularDistanceMinutes(toMinutes(r.outBedTime), anchorMin) <= 20;
  }).length;

  const caffeineDays = weekRecords.filter((r) => !!r.caffeineAfter2pm).length;
  const screenDays = weekRecords.filter((r) => !!r.screenWithin1h).length;
  const intenseEveningExerciseDays = weekRecords.filter((r) => !!r.intenseEveningExercise).length;
  const daytimeExerciseDays = weekRecords.filter((r) => !!r.daytimeExercise || !!r.exerciseDay).length;
  const sunlightDays = weekRecords.filter((r) => !!r.morningSunlight20min).length;
  const relaxationDays = weekRecords.filter((r) => !!r.relaxationPractice).length;

  const strengths = [];
  if (anchorHitDays >= 5) {
    strengths.push(`固定起床执行较好（${anchorHitDays}/7 天接近锚点 ${fixedWakeTime}）。`);
  }
  if (avgEfficiency >= 0.85) {
    strengths.push(`本周平均睡眠效率 ${Math.round(avgEfficiency * 100)}%，节律正在稳定。`);
  }
  if (daytimeExerciseDays >= 4) {
    strengths.push('白天运动执行稳定，有助于提升夜间睡眠驱动力。');
  }
  if (sunlightDays >= 4) {
    strengths.push('晨间户外光照执行稳定，有助于稳住生物钟。');
  }
  if (!strengths.length) {
    strengths.push('你坚持记录了完整一周，这本身就是非常关键的进展。');
  }

  const risks = [];
  if (avgEfficiency < 0.8) {
    risks.push(`本周平均睡眠效率 ${Math.round(avgEfficiency * 100)}%，仍偏低。`);
  }
  if (avgLatency >= 35) {
    risks.push(`平均入睡耗时约 ${Math.round(avgLatency)} 分钟，入睡前唤醒水平偏高。`);
  }
  if (screenDays >= 4) {
    risks.push('睡前 1 小时看屏幕较多，可能推迟入睡。');
  }
  if (caffeineDays >= 2) {
    risks.push('14:00 后咖啡因摄入偏多，可能影响夜间连续睡眠。');
  }
  if (intenseEveningExerciseDays >= 2) {
    risks.push('晚间剧烈运动较多，可能延迟入睡。');
  }
  if (avgNap > 30) {
    risks.push(`白天小睡均值约 ${Math.round(avgNap)} 分钟，建议压缩到 20-30 分钟。`);
  }
  if (!risks.length) {
    risks.push('本周主要风险行为不明显，继续保持当前执行节奏。');
  }

  const nextFocus = [];
  if (anchorHitDays < 5) {
    nextFocus.push(`优先把起床时间固定在 ${fixedWakeTime}（允许误差约 20 分钟）。`);
  }
  if (screenDays >= 4 || avgLatency >= 35) {
    nextFocus.push('刺激控制：上床后约 20 分钟仍清醒，先离床做安静活动，困了再回床。');
  }
  if (relaxationDays < 4) {
    nextFocus.push('放松技巧：连续 7 天在睡前做 10 分钟呼吸放松或渐进肌肉放松。');
  }
  nextFocus.push('认知重构：把“今晚必须睡着”改成“先休息和守节律，睡眠会逐步回稳”。');
  if (daytimeExerciseDays < 4) {
    nextFocus.push('白天安排轻到中等强度活动（如快走），尽量不放在临睡前。');
  }

  const candidateWindowMin = roundToQuarter(clamp(avgSleepMin + 15, 330, 540));
  const windowDeltaMin = candidateWindowMin - activeWindowMin;
  let windowAdjustText = `建议下周睡眠窗口：${minutesToDuration(candidateWindowMin)}。`;
  if (windowDeltaMin >= 15) {
    windowAdjustText = `建议下周睡眠窗口调至 ${minutesToDuration(candidateWindowMin)}（较当前增加 ${minutesToDuration(windowDeltaMin)}）。`;
  } else if (windowDeltaMin <= -15) {
    windowAdjustText = `建议下周睡眠窗口调至 ${minutesToDuration(candidateWindowMin)}（较当前缩短 ${minutesToDuration(Math.abs(windowDeltaMin))}）。`;
  }

  const rangeText = `${subtractMinutes(fixedWakeTime, candidateWindowMin)} - ${fixedWakeTime}`;
  const earliest = weekRecords[0];
  const latest = weekRecords[weekRecords.length - 1];
  const title = `CBTI第${toChineseWeekIndex(index)}周总结`;
  const weekRows = weekRecords.map((record) => {
    const rowMetrics = calculateRecordMetrics(record);
    return {
      date: record.date,
      inBedTime: record.inBedTime || '-',
      outBedTime: record.outBedTime || '-',
      sleepText: minutesToDuration(rowMetrics.totalSleepMin),
      efficiencyText: `${Math.round(rowMetrics.sleepEfficiency * 100)}%`
    };
  });

  return {
    title,
    periodText: `${earliest.date} ~ ${latest.date}`,
    weekRows,
    avgSleepText: minutesToDuration(avgSleepMin),
    avgEfficiencyText: `${Math.round(avgEfficiency * 100)}%`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    nextFocus: nextFocus.slice(0, 4),
    windowAdjustText,
    suggestedRangeText: rangeText
  };
}

function buildWeeklySummaries(records, options) {
  const all = [...(records || [])].sort((a, b) => (a.date > b.date ? 1 : -1));
  if (all.length < 7) {
    return [];
  }

  const summaries = [];
  for (let i = 0; i + 6 < all.length; i += 7) {
    const weekRecords = all.slice(i, i + 7);
    summaries.push(buildWeeklySummary(weekRecords, options || {}, summaries.length + 1));
  }
  return summaries;
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
  const analysisStartDate = recent.length ? recent[recent.length - 1].date : '';
  const analysisEndDate = recent.length ? recent[0].date : '';
  const naturalCycleDays = analysisStartDate && analysisEndDate ? diffDateDays(analysisStartDate, analysisEndDate) + 1 : 0;
  const pendingSummaryHint = !canApplyWindow && naturalCycleDays >= 7
    ? '你已开始第 7 个自然日，但当前记录不足 7 条；周总结将在累计满 7 条记录后生成。'
    : '';

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
      naturalCycleDays,
      remainingDays,
      canApplyWindow,
      analysisStartDate: '',
      analysisEndDate: '',
      reason,
      habitTips: [],
      pendingSummaryHint: ''
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
      naturalCycleDays,
      remainingDays,
      canApplyWindow,
      analysisStartDate,
      analysisEndDate,
      reason: useManualWindow
        ? `当前已记录${cycleDays}天，还需${remainingDays}天完成本周期。当前执行窗口维持${minutesToDuration(activeWindowMin)}。`
        : `当前已记录${cycleDays}天，还需${remainingDays}天完成本周期。第一周先记录，满7天再自动给出建议窗口。`,
      habitTips: buildHabitTips(recent),
      pendingSummaryHint
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
    naturalCycleDays,
    remainingDays,
    canApplyWindow,
    analysisStartDate,
    analysisEndDate,
    reason,
    habitTips: buildHabitTips(recent),
    pendingSummaryHint: ''
  };
}

module.exports = {
  calculateRecordMetrics,
  getRecommendation,
  buildCoachingFeedback,
  buildWeeklySummaries
};
