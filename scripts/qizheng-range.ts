import { qizhengRangeInput } from '../src/schema';
import { collectQizhengRange } from '../src/qizheng-range-client';
import { qizhengRange, renderQizhengRange } from '../src/systems/qizheng-range';
import { runRangeCli } from './range-cli';

await runRangeCli({
  method: 'qizheng-range', parse: (value) => qizhengRangeInput.parse(value),
  calculate: async (input) => (await qizhengRange(input)).data, collect: collectQizhengRange,
  render: (data, question, options) => renderQizhengRange(data, question, qizhengRangeInput.shape.prompt.parse(options)),
});
