import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildComprehensiveFengShuiPrompt,
  buildPlainLayoutSummary,
  computeAnnualFengShuiSha,
  computeWorkbenchSnapshot,
  evaluateFloorPlanMarkers,
  evaluateRoomPlacements,
} from '../src/app/components/fengshui/fengshui-engine';
import {
  createDefaultHouseProfile,
  getSimpleDirectionLabel,
  personalCaseToResident,
} from '../src/app/components/fengshui/fengshui-store';
import { createDefaultPersonalCase } from '../src/v2-ui/cases-store';

test('personalCaseToResident 正确将农历档案转为公历年月日', () => {
  const lunarCase = createDefaultPersonalCase({
    id: 'c_lunar',
    name: '农历成员',
    gender: 'female',
    calendar: 'lunar',
    isLeapMonth: false,
    year: '1990',
    month: '1',
    day: '1',
  });
  const res = personalCaseToResident(lunarCase);
  assert.equal(res.birthYear, 1990);
  assert.equal(res.birthMonth, 1);
  assert.equal(res.birthDay, 27);
  assert.equal(res.gender, 'female');
});

test('computeWorkbenchSnapshot 同步生成九宫融合盘与多家人配房且替卦自动兜底', () => {
  const profile = createDefaultHouseProfile({
    sitMountain: '午',
    constructionYear: 2024,
    xuankongMode: '替卦',
    orientationKind: 'degree',
    degreeReading: 'sit',
    degree: 180,
    northReference: 'unspecified',
    uncertaintyDegrees: 2,
    residents: [
      { id: 'r1', name: '男主', birthYear: 1990, gender: 'male', role: '宅主' },
      { id: 'r2', name: '女主', birthYear: 1992, birthMonth: 2, birthDay: 4, gender: 'female' },
    ],
    primaryResidentId: 'r1',
  });

  const snap = computeWorkbenchSnapshot(profile);
  assert.equal(snap.palaces.length, 9);
  assert.equal(snap.residentAnalyses.length, 2);
  assert.equal(snap.effectiveMode, '下卦');
  assert.ok(snap.fallbackNotice);
  assert.equal(snap.sitMountain, '午');
  assert.equal(snap.facingMountain, '子');
  assert.equal(snap.houseGua, '离');
});

test('computeAnnualFengShuiSha 正确算出丙午年太岁/岁破/三煞与十二节气月飞星', () => {
  const sha2026 = computeAnnualFengShuiSha(2026);
  assert.equal(sha2026.ganZhi, '丙午');
  assert.equal(sha2026.taiSui.direction, '南');
  assert.equal(sha2026.suiPo.direction, '北');
  assert.equal(sha2026.sanSha.direction, '北');
  assert.equal(sha2026.monthlyPlates.length, 12);
  assert.equal(sha2026.annualPalaces.length, 9);
});

test('evaluateFloorPlanMarkers 按图片矩形宽高比与旋转角精确映射方位并生成综合提示词', () => {
  const profile = createDefaultHouseProfile({
    name: '测试住宅',
    sitMountain: '子',
    constructionYear: 2024,
  });
  profile.floorPlan.imageWidth = 2000;
  profile.floorPlan.imageHeight = 1000;
  profile.floorPlan.compassCenterX = 50;
  profile.floorPlan.compassCenterY = 50;
  profile.floorPlan.topDirection = 'east'; // 图纸上方为东，正北在图纸左侧
  profile.floorPlan.markers = [
    { id: 'm1', kind: 'door', label: '大门', x: 25, y: 50 }, // 相对中心左侧 -> 正北
    { id: 'm2', kind: 'masterBed', label: '主卧', x: 50, y: 15 }, // 相对中心上方 -> 正东
  ];

  const snap = computeWorkbenchSnapshot(profile);
  const reports = evaluateFloorPlanMarkers(profile, snap);
  assert.equal(reports.length, 2);
  assert.equal(reports[0]!.direction, '北');
  assert.equal(reports[1]!.direction, '东');

  const sha = computeAnnualFengShuiSha(2026);
  const prompt = buildComprehensiveFengShuiPrompt(profile, snap, sha, reports);
  assert.match(prompt, /测试住宅/);
  assert.match(prompt, /户型图实景功能标点诊断/);
  assert.match(prompt, /大门/);
});

test('buildPlainLayoutSummary 与默认朝向生成普通人易懂的大白话建议', () => {
  const profile = createDefaultHouseProfile({
    orientationKind: 'mountain',
    sitMountain: '卯',
    residents: [{ id: 'r1', name: '小明', birthYear: 1990, gender: 'male' }],
    primaryResidentId: 'r1',
  });
  assert.equal(profile.floorPlan.topDirection, 'north');
  assert.equal(getSimpleDirectionLabel('卯'), '坐东朝西');

  const snap = computeWorkbenchSnapshot(profile);
  const sha = computeAnnualFengShuiSha(2026);
  const plain = buildPlainLayoutSummary(snap, sha);
  assert.equal(plain.directionLabel, '坐东朝西');
  assert.equal(plain.isMatch, true);
  assert.match(plain.headline, /人宅合拍/);
  assert.equal(plain.palacePlainCards.length, 9);
  assert.ok(plain.bedroomDirs.length > 0 && plain.avoidDirs.length > 0);
});

test('默认面向朝向自动换算坐山、支持房间方位诊断与跨周期入住提示', () => {
  const profile = createDefaultHouseProfile({
    degree: 270, // 面向正西 -> 坐东卯山
    constructionYear: 2015,
    moveInYear: 2025,
    roomPlacements: {
      door: '东',
      masterBed: '中',
      bath: '西',
    },
  });
  const snap = computeWorkbenchSnapshot(profile);
  assert.equal(snap.sitMountain, '卯');
  assert.equal(snap.facingMountain, '酉');
  assert.ok(snap.moveInCycleNotice && snap.moveInCycleNotice.includes('2025'));

  const roomDiags = evaluateRoomPlacements(profile.roomPlacements, snap);
  assert.equal(roomDiags.length, 3);
  assert.equal(roomDiags.find((r) => r.kind === 'masterBed')?.direction, '房子中心');
  assert.equal(roomDiags.find((r) => r.kind === 'masterBed')?.status, '平');
});
