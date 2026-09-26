import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';

test('住宅门向与额外坐向必须描述同一住宅，不能分别用于八宅和玄空', () => {
  for (const mingGua of [undefined, '坎']) {
    for (const extra of [
      { facingDegree: 0 },
      { sitDegree: 180 },
      { sitMountain: '子' },
      { facingMountain: '午' },
    ]) {
      assert.throws(
        () =>
          generateResidentialFengshui({
            mingGua,
            year: 2024,
            doorToInteriorDegree: 90,
            ...extra,
          }),
        /不一致|相差180度/,
      );
    }
  }
});

test('缺少宅运年份时仍按已有朝向或坐向独立计算八宅宅卦', () => {
  for (const orientation of [
    { sitMountain: '子' },
    { facingMountain: '午' },
    { sitDegree: 0 },
    { facingDegree: 180 },
  ]) {
    const result = generateResidentialFengshui({ mingGua: '坎', ...orientation });
    assert.equal(result.bazhai?.houseGua, '坎');
    assert.equal(result.bazhai?.match, '相合');
    assert.equal(result.xuankong, null);
    assert.equal(result.inputSummary.hasHouseOrientation, true);
    assert.equal(result.inputSummary.orientationText, '坐子向午');
    assert.match(result.prompt, /宅卦：坎/);
  }
  assert.throws(
    () =>
      generateResidentialFengshui({
        mingGua: '坎',
        sitMountain: '子',
        facingMountain: '酉',
      }),
    /严格相对/,
  );
});

test('住宅坐向度数与等效门向使用相同磁偏角并保留测量候选', () => {
  const input = {
    mingGua: '坎',
    year: 2024,
    northReference: 'magnetic' as const,
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  };
  const door = generateResidentialFengshui({ ...input, doorToInteriorDegree: 21 });
  const facing = generateResidentialFengshui({ ...input, facingDegree: 201 });
  const all = generateResidentialFengshui({
    ...input,
    doorToInteriorDegree: 21,
    sitDegree: 21,
    facingDegree: 201,
  });
  assert.deepEqual(facing.xuankong?.plates, door.xuankong?.plates);
  assert.deepEqual(all.xuankong?.measurement, door.xuankong?.measurement);
  assert.equal(facing.xuankong?.measurement?.sitDegree, 22);
  assert.equal(facing.bazhai?.evidenceAnalysis.measurementFact.status, '宅卦不稳定');
  assert.deepEqual(
    facing.bazhai?.evidenceAnalysis.measurementFact.candidates,
    door.bazhai?.evidenceAnalysis.measurementFact.candidates,
  );
  assert.equal(facing.bazhai?.evidenceAnalysis.measurementFact.method, '按住宅坐山度数换算');
});

test('住宅合参保留各方向完整盘面并只呈现一次', () => {
  const directions = {
    坎: '北',
    艮: '东北',
    震: '东',
    巽: '东南',
    离: '南',
    坤: '西南',
    兑: '西',
    乾: '西北',
  };
  for (const mingGua of Object.keys(directions)) {
    const result = generateResidentialFengshui({ mingGua, year: 2024, sitMountain: '子' });
    const lines = result.prompt.split('\n');
    for (const [gua, direction] of Object.entries(directions)) {
      const palace = result.bazhai!.mingPalace.find((item) => item.gua === gua)!;
      const flying = result.xuankong!.palaces.find((item) => item.name.startsWith(gua))!;
      assert.equal(flying.direction, direction);
      const matching = lines.filter((line) => line.startsWith(`${flying.name}（${direction}）：`));
      assert.equal(matching.length, 1, `${mingGua}命${gua}宫完整飞星只呈现一次`);
      assert.ok(matching[0].includes(`运${flying.yunStar}（`));
      assert.ok(matching[0].includes(`山${flying.shanStar}（`));
      assert.ok(matching[0].includes(`向${flying.xiangStar}（`));
      assert.ok(result.prompt.includes(`${palace.direction}${palace.label}（${palace.luck}`));
    }
    for (const chart of [result.xuankong!, result.bazhai!]) {
      const facts = chart.prompt.split('\n').filter((line) => !/^【.+】$/.test(line.trim()));
      for (const fact of facts) assert.ok(result.prompt.includes(fact));
    }
    assert.doesNotMatch(result.prompt, /方位合参：|^玄空：|^八宅：/m);
  }
});

test('住宅风水保留显式山名并拒绝与坐向度数冲突', () => {
  for (const extra of [{ sitMountain: '卯' }, { facingMountain: '酉' }, { facingDegree: 181 }]) {
    assert.throws(
      () => generateResidentialFengshui({ year: 2024, sitDegree: 0, ...extra }),
      /不一致|相差180度/,
    );
  }
  const result = generateResidentialFengshui({
    year: 2024,
    sitDegree: 0,
    sitMountain: '子',
    facingMountain: '午',
  });
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.xuankong?.facingMountain, '午');
});

test('住宅风水入口传递替卦并保留玄空替星完整盘面', () => {
  const result = generateResidentialFengshui({
    year: 2008,
    sitDegree: 339,
    facingDegree: 159,
    guaType: '替卦',
  });
  assert.equal(result.xuankong?.guaType, '替卦');
  assert.equal(result.xuankong?.replacement?.mountain.referenceMountain, '辰');
  assert.equal(result.xuankong?.replacement?.facing.referenceMountain, '甲');
  assert.match(result.prompt, /玄空完整盘面：[\s\S]*卦型：替卦/);
});

test('添加居住人资料不改变门向测量及玄空候选山向', () => {
  const input = {
    year: 2024,
    doorToInteriorDegree: 64,
    northReference: 'magnetic' as const,
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  };
  const alone = generateResidentialFengshui(input);
  const withPerson = generateResidentialFengshui({ ...input, mingGua: '坎' });
  assert.equal(alone.xuankong?.measurement?.stability, '山向边界敏感');
  assert.deepEqual(withPerson.xuankong?.measurement, alone.xuankong?.measurement);
  assert.deepEqual(withPerson.xuankong?.plates, alone.xuankong?.plates);
  assert.match(withPerson.prompt, /候选山向/);
});

test('住宅风水仅有出生信息时可出八宅，不出玄空', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
  });
  assert.equal(result.key, 'residential-fengshui');
  assert.ok(result.bazhai);
  assert.equal(result.xuankong, null);
  assert.match(result.prompt, /八宅/);
  assert.match(result.prompt, /玄空：未排盘/);
  assert.equal(result.inputSummary.xuankongStatus, '缺少山向');
});

test('住宅风水有居住人与山向但缺少建造或起运年时不得静默套用当前年', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
    sitMountain: '子',
  });

  assert.ok(result.bazhai);
  assert.equal(result.xuankong, null);
  assert.equal(result.inputSummary.houseYear, null);
  assert.equal(result.inputSummary.xuankongStatus, '缺少建造年或起运年');
  assert.ok(result.agreements.some((item) => /缺少住宅建造年或起运年/.test(item.detail)));
  assert.ok(result.advice.some((item) => /补充住宅建造年或起运年/.test(item)));
  assert.match(result.prompt, /玄空：未排盘（缺少建造年或起运年）/);
  assert.doesNotMatch(result.prompt, new RegExp(`宅运年份：${new Date().getFullYear()}`));
});

test('住宅风水只有山向却缺少建造或起运年时应明确报错', () => {
  assert.throws(
    () => generateResidentialFengshui({ sitMountain: '子' }),
    /必须提供住宅建造年或起运年/,
  );
});

test('住宅风水仅有山向时可出玄空，不出八宅', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    sitMountain: '子',
  });
  assert.ok(result.xuankong);
  assert.equal(result.bazhai, null);
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.inputSummary.xuankongStatus, '已排盘');
  assert.match(result.prompt, /玄空/);
});

test('住宅风水门向度数会同步八宅与玄空山向', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
    year: 2024,
    doorToInteriorDegree: 0,
  });
  assert.ok(result.bazhai?.houseGua);
  assert.ok(result.xuankong);
  assert.ok(result.agreements.length >= 1);
  assert.ok(result.advice.length >= 1);
  const measurement = (
    result.bazhai as { directionMeasurement?: { sitMountain: string; facingMountain: string } }
  ).directionMeasurement;
  assert.ok(measurement);
  assert.equal(result.xuankong?.sitMountain, measurement?.sitMountain);
  assert.equal(result.xuankong?.facingMountain, measurement?.facingMountain);
  assert.match(result.prompt, /玄空完整盘面：/);
  assert.match(result.prompt, /三盘九宫：/);
  assert.match(result.prompt, /八宅完整盘面：/);
  assert.match(result.prompt, /命卦八方：/);
  assert.match(result.prompt, /宅卦八方：/);
  assert.doesNotMatch(result.prompt, /合参要点|命宅相合可提高关注优先级/);
});

test('住宅风水缺少山向与居住人时应报错', () => {
  assert.throws(() => generateResidentialFengshui({}), /至少需要提供山向|出生年/);
});

test('住宅风水仅有门向度数时可出玄空，不依赖出生信息', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    doorToInteriorDegree: 0,
  });
  assert.equal(result.bazhai, null);
  assert.ok(result.xuankong);
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.xuankong?.facingMountain, '午');
  assert.match(result.prompt, /仅完成玄空宅运层|玄空/);
});

test('住宅风水无居住人时门向磁北应换算真北并同步玄空盘', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });

  assert.equal(result.bazhai, null);
  assert.ok(result.xuankong);
  assert.equal(result.xuankong?.measurement?.sitDegree, 65);
  assert.equal(result.xuankong?.measurement?.stability, '山向边界敏感');
  assert.equal(result.xuankong?.sitMountain, '寅');
  assert.equal(result.xuankong?.facingMountain, '申');
  assert.ok(result.xuankong?.measurement?.candidateMountains?.length === 2);
});

test('住宅风水无居住人时门向测量参数应执行与八宅一致的校验', () => {
  for (const input of [
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'magnetic' as const,
    },
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'true' as const,
      magneticDeclinationDegrees: 1,
    },
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'invalid' as never,
    },
    {
      year: 2024,
      doorToInteriorDegree: 361,
    },
  ]) {
    assert.throws(() => generateResidentialFengshui(input));
  }
});
