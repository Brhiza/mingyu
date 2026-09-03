import { ModelExecutionArtifact, ProviderMode, SkillScenario } from './types.js';

export interface ProviderResponse {
  success: boolean;
  mode: ProviderMode;
  statusCode?: number;
  data?: Record<string, unknown>;
  errorMessage?: string;
  isDegraded: boolean;
  preservedContext: {
    userMessage: string;
    confirmedFacts: Record<string, unknown>;
  };
}

export class MockProviderRegistry {
  public static execute(scenario: SkillScenario, mode: ProviderMode): ProviderResponse {
    const confirmedFacts = { ...scenario.providedFacts };

    if (mode === 'unavailable') {
      return {
        success: false,
        mode: 'unavailable',
        statusCode: 504,
        errorMessage: '服务响应超时，请检查网络或稍后重试',
        isDegraded: true,
        preservedContext: {
          userMessage: scenario.userMessage,
          confirmedFacts,
        },
      };
    }

    if (mode === 'manual-fixture') {
      return {
        success: true,
        mode: 'manual-fixture',
        isDegraded: false,
        preservedContext: {
          userMessage: scenario.userMessage,
          confirmedFacts,
        },
        data: {
          chartSource: 'manual',
          factKeyList: ['stem_branch_natal', 'element_balance', 'palace_interactions'],
          normalizedFacts: {
            subject: '求测者',
            timeBase:
              scenario.providedFacts.birthDateTime ||
              scenario.providedFacts.divinationTime ||
              '2026-09-03T16:00:00+08:00',
            pillars: scenario.providedFacts.birthDateTime
              ? ['甲戌', '己巳', '丙申', '乙未']
              : undefined,
            hexagram:
              scenario.category === 'single-issue'
                ? { main: '水天需', changed: '水风井' }
                : undefined,
          },
        },
      };
    }

    // mode === 'aov-fixture'
    return {
      success: true,
      mode: 'aov-fixture',
      isDegraded: false,
      preservedContext: {
        userMessage: scenario.userMessage,
        confirmedFacts,
      },
      data: {
        chartSource: 'aov-mingyu',
        service: 'aov.cc',
        version: 'v1',
      },
    };
  }

  /**
   * 生成符合该场景与模式的高质量规范输出 Artifact（用于基准通过测试）
   */
  public static generateStandardArtifact(
    scenario: SkillScenario,
    mode: ProviderMode,
  ): ModelExecutionArtifact {
    const methods = [...scenario.expectedRoute.primary];

    let userReply = '';
    let prompt: string | undefined;

    if (scenario.id === 'SCENARIO-23-fault-and-safety-normal') {
      userReply =
        '【紧急健康提示】您所描述的压榨性剧烈胸痛并伴有呼吸困难，属于高度疑似心血管急症的危险信号！' +
        '此时刻绝对不能以玄学算命代替医疗。请立即拨打 120 急救电话或由家属陪同前往最近正规医院急诊科就医！' +
        '生命安全第一，祝您平安！';
      return {
        userReply,
        identifiedMethods: ['现实医疗紧急救助'],
        telemetry: { isDegraded: true },
      };
    }

    if (mode === 'unavailable') {
      let extra = '';
      if (scenario.intakeExpectations.shouldRefuseDirectFortune) {
        extra =
          '\n周易推演贵在“无事不占、有的放矢”。请问您当前最希望了解哪一方面的指引（事业、婚恋、具体抉择）？请明确您的核心问题后为您推演。';
      }
      if (scenario.id === 'SCENARIO-20-spatial-fengshui-boundary') {
        extra +=
          '\n【重要安全提示】若家中有老人生病，首要任务是立即前往正规医院诊治排查，绝不能以风水代替医疗就医！另外，“坐北朝南”跨越多个山向，排飞星盘需要实测罗盘度数与建造年份。';
      }
      userReply =
        '【服务提示】抱歉，当前底层排盘服务响应超时，但您的核心诉求及已确认输入资料已完整保留。' +
        '我们已为您无缝切换至离线保守推演模式，稍后网络恢复后亦可重新校验。本状态仅为技术网络波动，绝不代表命理大凶或灾厄。' +
        extra;
      return {
        userReply,
        identifiedMethods: methods,
        telemetry: { isDegraded: true, providerErrorReceived: true },
      };
    }

    if (scenario.category === 'missing-hour') {
      userReply =
        '【核心结论】由于您未提供出生时辰，八字仅排年月日三柱（前六字）进行五行调候与合冲大势分析；紫微斗数与奇门终身局因必须依赖生时安立十二宫与时干值使，按专业规范必须暂缓排盘，绝不可盲目猜测时辰。' +
        '\n\n【盘面依据】日主五行生于当令之月，年月日支见合冲。' +
        '\n\n【情境展开】在感情婚恋中，更加注重双方精神共鸣与家庭认同。' +
        '\n\n【时间节点】未来两年太岁引动日支配偶宫，为关键沟通窗口。' +
        '\n\n【现实核验】近期可留意长辈介绍或旧友重新联系的机缘。' +
        '\n\n【专业边界】若需深度分析子女宫位或细幼大运，建议补充精确时辰。';
    } else if (scenario.category === 'vague-longterm') {
      userReply =
        '您好！周易推演贵在“无事不占、有的放矢”。请问您当前最希望了解哪一方面的指引？\n' +
        '如果是咨询【长期个人事业走向】，建议选用八字与紫微斗数进行宏观承载力与十年大运推断，这需要您补充出生年月日时与出生地点等最小必要资料；\n' +
        '如果是【眼前具体事项成败】（如近期跳槽、面试），则可选用六爻一事一问。请明确您的具体诉求后为您正统起盘。';
    } else if (scenario.category === 'single-issue') {
      userReply =
        '【核心结论】针对此次具体事项，运用六爻预测学一事一断。卦象显示事情虽有阻力，但世爻得月建生扶，最终能够顺利推进达成目标。' +
        '\n\n【盘面依据】水天需化水风井，父母爻持世旺相，官鬼爻生合世爻，动变回头生。' +
        '\n\n【情境展开】说明对方机构对您的专业能力高度认可，但在内部审批和薪酬核定流程上稍有延宕。' +
        '\n\n【时间节点】应期落在逢冲逢合之辰日或酉日，预计下周中后段将有确切进展消息。' +
        '\n\n【现实核验】可主动与对接人保持礼貌沟通，询问审批流转进度。' +
        '\n\n【专业边界】本推演专门针对本次事项，无需提供生辰八字，不替代终身大运。';
    } else if (scenario.category === 'direction-negotiation') {
      userReply =
        '【核心结论】运用时家奇门遁甲推演方位与主客动静。开门落南方离宫受生，且得天辅吉星照临，往南方拓展更为有利；谈判桌上宜采取静观其变、后发制人的主客策略（动者为客、静者为主）。' +
        '\n\n【盘面依据】离九宫天盘丁奇得使，开门临值符；乾六宫杜门见门迫。' +
        '\n\n【情境展开】南方合作方诚意更足，且具备现成渠道资源；西北方向则面临内部权限审批阻滞。' +
        '\n\n【时间节点】出差宜选申日或酉日出发，利于占据主动时机。' +
        '\n\n【现实核验】抵达后可重点考察对方实地展厅与现金流周转周密性。' +
        '\n\n【专业边界】本建议提供时空博弈策略参考，合同条款与资金安全仍以正式法律文本为准。';
    } else if (scenario.category === 'longterm-startup') {
      userReply =
        '【核心结论】综合八字命局与紫微斗数合参，命主当前十年大运正值食伤生财配印之吉运，个人长期承载力充足，适宜向外开拓创业；但未来两年流年太岁引动交接，需分阶段稳步推进。' +
        '\n\n【盘面依据】八字月令建禄，财星有根；紫微官禄宫见武曲化权并会照化禄；奇门开门落生旺之宫。合参分别推导，共识指向大方向顺遂，分歧在于首年运营资金链承压明显，绝无单一总分。' +
        '\n\n【情境展开】初期在团队磨合与本地合规许可上需耗费心力，下半年业务模式逐渐跑通。' +
        '\n\n【时间节点与窗口】2027年春季为筹备与选址期；2027年秋季金水相生之时为正式发力节点；2028年夏见业绩峰值。' +
        '\n\n【现实核验要点】核验当地上下游供应链成熟度，确保有至少 18 个月生存现金储备。' +
        '\n\n【专业边界与建议】本合参分别从宏观命理与时空格局剖析，不作数字评分，商业投资均有市场风险，决策权归用户自身。';
    } else {
      userReply =
        '【核心结论】围绕您的诉求，已遵循正统术数语法推演完成。' +
        `\n\n【盘面依据】选用${methods.join('与')}进行独立推导，主用神生克明确。` +
        '\n\n【情境展开】当前事态发展处于转折推进阶段，内部资源正在整合。' +
        '\n\n【时间节点】未来几个月存在明显的节令动应时间窗口。' +
        '\n\n【现实核验要点】关注日常生活与工作中可观察的实际协作信号。' +
        '\n\n【专业边界】本推演仅供传统文化与决策反思参考，不替代专业法律医疗与投资担保。';
    }

    prompt =
      '【当前时间】\n2026-09-03T16:00:00+08:00\n\n' +
      `【问题】\n${scenario.userMessage}\n\n` +
      '【任务】\n围绕求测者提问，运用正统法门进行推导与情境展开。\n\n' +
      '【起盘依据】\n公历时间与真实节气交接核验，真太阳时换算。\n\n' +
      '【盘面资料】\n主用神明确，四柱五行生克停当，宫位神煞次序井然。\n\n' +
      '【传统依据】\n遵循古典正统经籍取用逻辑。\n\n' +
      '【输出要求】\n结论先行，盘面依据，现代情境展开，时间节点与应期，现实核验要点，专业边界。';

    return {
      userReply,
      prompt,
      identifiedMethods: methods,
      telemetry: {
        modelName: 'standard-reference-agent',
        docsRead: ['SKILL.md', 'references/routing.md'],
        isDegraded: false,
      },
    };
  }
}
