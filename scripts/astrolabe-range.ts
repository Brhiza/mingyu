import { astrolabeRangeInput } from '../src/schema';
import { collectAstrolabeRange } from '../src/astrolabe-range-client';
import { astrolabeRange, renderAstrolabeRange } from '../src/systems/astrolabe-range';
import { runRangeCli } from './range-cli';

await runRangeCli({
  method: 'astrolabe-range', parse: (value) => astrolabeRangeInput.parse(value),
  calculate: async (input) => (await astrolabeRange(input)).data, collect: collectAstrolabeRange,
  render: (data, question, options) => renderAstrolabeRange(data, question, astrolabeRangeInput.shape.prompt.parse(options)),
});
