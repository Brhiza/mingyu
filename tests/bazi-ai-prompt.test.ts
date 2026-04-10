import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('八字 AI 系统规则明确要求复核命盘中已给出的喜忌结论', () => {
  const source = readFileSync(resolve('src/utils/ai/aiPrompts.ts'), 'utf8')

  assert.match(source, /应把它们当作待校验结论/)
  assert.match(source, /逐项复核后再下判断/)
  assert.match(source, /普通格局先看身强身弱与扶抑/)
  assert.match(source, /只有专旺格、从格等特殊格局才按顺势或从势解释/)
  assert.match(source, /若命盘中已给出的喜忌结论与推理结果不一致，必须明确指出冲突点/)
  assert.doesNotMatch(source, /本地/)
})

test('八字盘面格式化会把喜忌五行和十神清单直接写进提示词', () => {
  const source = readFileSync(resolve('src/utils/bazi/baziAnalysisFormatter.ts'), 'utf8')

  assert.match(source, /喜神五行:/)
  assert.match(source, /忌神五行:/)
  assert.match(source, /喜用十神:/)
  assert.match(source, /忌神十神:/)
})

test('八字提示词各场景默认保留规则与取用路径信息', () => {
  const source = readFileSync(resolve('src/utils/bazi/baziAnalysisFormatter.ts'), 'utf8')
  const includeRulesTrueCount = (source.match(/includeRules: true/g) || []).length

  assert.ok(includeRulesTrueCount >= 5)
  assert.doesNotMatch(source, /includeRules: false/)
})

test('五行分布计算不再派生独立的旺衰与用忌结论', () => {
  const typesSource = readFileSync(resolve('src/utils/bazi/baziTypes.ts'), 'utf8')
  const calculatorSource = readFileSync(resolve('src/utils/bazi/WuxingCalculator.ts'), 'utf8')
  const resultPageSource = readFileSync(resolve('src/pages/ResultPage.tsx'), 'utf8')
  const wuxingStrengthDetailsBlock = typesSource.match(/export interface WuxingStrengthDetails \{[\s\S]*?\n\}/)?.[0] || ''

  assert.doesNotMatch(wuxingStrengthDetailsBlock, /yongShen:/)
  assert.doesNotMatch(wuxingStrengthDetailsBlock, /jiShen:/)
  assert.doesNotMatch(wuxingStrengthDetailsBlock, /suggestions:/)
  assert.doesNotMatch(wuxingStrengthDetailsBlock, /status: string;/)
  assert.doesNotMatch(calculatorSource, /_determineStrengthStatus/)
  assert.doesNotMatch(calculatorSource, /_determineYongShen/)
  assert.doesNotMatch(resultPageSource, /wuxingStrength\.status/)
})

test('分析结果结构不再保留重复字段', () => {
  const typesSource = readFileSync(resolve('src/utils/bazi/baziTypes.ts'), 'utf8')
  const pipelineSource = readFileSync(resolve('src/utils/bazi/baziAnalysisPipeline.ts'), 'utf8')
  const resultPageSource = readFileSync(resolve('src/pages/ResultPage.tsx'), 'utf8')
  const analysisResultBlock = typesSource.match(/export interface BaziAnalysisResult \{[\s\S]*?\n\}/)?.[0] || ''

  assert.doesNotMatch(analysisResultBlock, /^\s{2}dayMasterStatus:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}patternType:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}patternDescription:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}favorableElements:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}unfavorableElements:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}rootAnalysis:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}supportAnalysis:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}seasonalStatus:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}avoidGod:/m)
  assert.doesNotMatch(analysisResultBlock, /^\s{2}circulation:/m)
  assert.doesNotMatch(analysisResultBlock, /dayMasterStatus:/)
  assert.doesNotMatch(pipelineSource, /dayMasterStatus:\s*state\.dayMasterStrength\.status/)
  assert.doesNotMatch(pipelineSource, /dayMasterStatus:\s*state\.seasonalStatus/)
  assert.doesNotMatch(pipelineSource, /patternType:\s*state\.pattern\.type/)
  assert.doesNotMatch(pipelineSource, /patternDescription:\s*state\.pattern\.description/)
  assert.doesNotMatch(pipelineSource, /favorableElements:\s*state\.usefulGod\.favorableWuxing/)
  assert.doesNotMatch(pipelineSource, /unfavorableElements:\s*state\.usefulGod\.unfavorableWuxing/)
  assert.doesNotMatch(pipelineSource, /rootAnalysis:\s*state\.rootAnalysis/)
  assert.doesNotMatch(pipelineSource, /supportAnalysis:\s*state\.supportAnalysis/)
  assert.doesNotMatch(pipelineSource, /seasonalStatus:\s*\{/)
  assert.doesNotMatch(pipelineSource, /avoidGod:\s*state\.usefulGod\.avoid/)
  assert.doesNotMatch(pipelineSource, /circulation:\s*state\.usefulGod\.circulation/)
  assert.doesNotMatch(resultPageSource, /analysis\.avoidGod/)
  assert.doesNotMatch(resultPageSource, /analysis\.favorableElements/)
  assert.doesNotMatch(resultPageSource, /analysis\.unfavorableElements/)
})

test('日主旺衰只保留 status 字段且管道不暴露未使用阶段接口', () => {
  const typesSource = readFileSync(resolve('src/utils/bazi/baziTypes.ts'), 'utf8')
  const formatterSource = readFileSync(resolve('src/utils/bazi/baziAnalysisFormatter.ts'), 'utf8')
  const pipelineSource = readFileSync(resolve('src/utils/bazi/baziAnalysisPipeline.ts'), 'utf8')
  const usefulGodBlock = typesSource.match(/export interface UsefulGodAnalysis \{[\s\S]*?\n\}/)?.[0] || ''
  const dayMasterStrengthBlock = typesSource.match(/export interface DayMasterStrengthAnalysis \{[\s\S]*?\n\}/)?.[0] || ''

  assert.match(dayMasterStrengthBlock, /^\s{2}status:\s*string;/m)
  assert.doesNotMatch(dayMasterStrengthBlock, /^\s{2}strength:\s*string;/m)
  assert.doesNotMatch(usefulGodBlock, /^\s{2}circulation:\s*string;/m)
  assert.doesNotMatch(usefulGodBlock, /^\s{2}matchedRuleIds:/m)
  assert.match(formatterSource, /dayMasterStrength\.status/)
  assert.doesNotMatch(formatterSource, /dayMasterStrength\.strength/)
  assert.doesNotMatch(pipelineSource, /runStages\s*\(/)
})

test('格局结构不再保留未消费的成功标记字段', () => {
  const typesSource = readFileSync(resolve('src/utils/bazi/baziTypes.ts'), 'utf8')
  const patternSource = readFileSync(resolve('src/utils/bazi/baziPatternStrategy.ts'), 'utf8')
  const calculatorSource = readFileSync(resolve('src/utils/bazi/baziCalculator.ts'), 'utf8')
  const patternBlock = typesSource.match(/export interface PatternAnalysis \{[\s\S]*?\n\}/)?.[0] || ''

  assert.doesNotMatch(patternBlock, /success:/)
  assert.doesNotMatch(patternBlock, /successReason:/)
  assert.doesNotMatch(patternBlock, /type:/)
  assert.doesNotMatch(patternBlock, /description:/)
  assert.doesNotMatch(patternSource, /successReason/)
  assert.doesNotMatch(patternSource, /success:\s*true/)
  assert.doesNotMatch(patternSource, /type:\s*['"]/)
  assert.doesNotMatch(patternSource, /description\s*=/)
  assert.doesNotMatch(patternSource, /if\s*\(tenGod\s*===/)
  assert.doesNotMatch(calculatorSource, /successReason:/)
  assert.doesNotMatch(calculatorSource, /success:\s*false/)
  assert.doesNotMatch(calculatorSource, /mingGe:\s*\{\s*pattern:\s*'未知',\s*type:/)
})
