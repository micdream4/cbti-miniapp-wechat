const assert = require('assert');
const base = '/Users/huanglu/Documents/Code/18-CBTI/wechat-miniapp';
const { getRecommendation, buildWeeklySummaries, calculateRecordMetrics, buildCoachingFeedback } = require(`${base}/utils/cbti`);
const { addDays } = require(`${base}/utils/time`);

function rec(date, overrides = {}) {
  return {
    date,
    inBedTime: '23:30',
    outBedTime: '07:00',
    sleepLatencyMin: 20,
    wakeAfterSleepOnsetMin: 20,
    earlyWakeMin: 10,
    outOfBedAwakeMin: 10,
    napMin: 0,
    caffeineAfter2pm: false,
    alcoholTonight: false,
    screenWithin1h: false,
    intenseEveningExercise: false,
    daytimeExercise: true,
    morningSunlight20min: true,
    relaxationPractice: true,
    screenFree30min: true,
    bedroomComfort: true,
    note: '',
    ...overrides
  };
}

function buildRange(start, count, overrides) {
  const arr = [];
  let date = start;
  for (let i = 0; i < count; i += 1) {
    arr.push(rec(date, typeof overrides === 'function' ? overrides(i, date) : overrides));
    date = addDays(date, 1);
  }
  return arr;
}

function run() {
  let result = getRecommendation([], { fixedWakeTime: '07:00', activeWindowMin: 435, hasCustomWindow: false });
  assert.equal(result.suggestedBedtime, '-');
  assert.equal(result.cycleDays, 0);

  result = getRecommendation(buildRange('2026-03-03', 4), { fixedWakeTime: '07:00', activeWindowMin: 435, hasCustomWindow: false });
  assert.equal(result.canApplyWindow, false);
  assert.equal(result.cycleDays, 4);
  assert.equal(result.suggestedBedtime, '-');

  result = getRecommendation(buildRange('2026-03-03', 4), { fixedWakeTime: '07:00', activeWindowMin: 420, hasCustomWindow: true });
  assert.equal(result.suggestedBedtime, '00:00');
  assert.equal(result.sleepWindowMin, 420);

  result = getRecommendation(buildRange('2026-03-03', 7), { fixedWakeTime: '07:00', activeWindowMin: 435, hasCustomWindow: false });
  assert.equal(result.canApplyWindow, true);
  assert.equal(result.candidateWindowMin, 405);

  let metrics = calculateRecordMetrics(rec('2026-03-03', { outOfBedAwakeMin: 30 }));
  assert.equal(metrics.rawTimeInBedMin, 450);
  assert.equal(metrics.timeInBedMin, 420);
  assert.equal(metrics.totalSleepMin, 370);

  metrics = calculateRecordMetrics({
    inBedTime: '',
    outBedTime: '',
    sleepLatencyMin: 30,
    wakeAfterSleepOnsetMin: 10,
    earlyWakeMin: 5,
    outOfBedAwakeMin: 0
  });
  assert.equal(metrics.timeInBedMin, 0);
  assert.equal(metrics.totalSleepMin, 0);

  const weekly = buildWeeklySummaries(buildRange('2026-03-03', 15), { fixedWakeTime: '07:00', activeWindowMin: 435 });
  assert.equal(weekly.length, 2);
  assert.equal(weekly[0].periodText, '2026-03-03 ~ 2026-03-09');
  assert.equal(weekly[1].periodText, '2026-03-10 ~ 2026-03-16');

  const cycleRecords = buildRange('2026-03-03', 14);
  result = getRecommendation(cycleRecords, { fixedWakeTime: '07:00', activeWindowMin: 435, cycleStartDate: '2026-03-10', hasCustomWindow: true });
  assert.equal(result.cycleDays, 7);
  assert.equal(result.canApplyWindow, true);

  const poorRecords = buildRange('2026-03-03', 7, (i) => {
    if (i < 3) {
      return { sleepLatencyMin: 60, wakeAfterSleepOnsetMin: 60 };
    }
    return { sleepLatencyMin: 15, wakeAfterSleepOnsetMin: 10 };
  }).reverse();
  const coaching = buildCoachingFeedback(poorRecords);
  assert.ok(coaching.instantTips.length >= 1);
  assert.ok(typeof coaching.encouragement === 'string' && coaching.encouragement.length > 0);

  console.log('Smoke tests passed');
}

run();
