import { buildAstrolabeFromInput, buildHoroscopeFromInput } from 'mingyu-core/ziwei';

export async function runZiweiBrowserContract() {
  const input = {
    name: '浏览器契约',
    dateType: 'solar',
    birthDate: '1998-08-13',
    birthTimeIndex: 0,
    gender: '女',
  };
  const astrolabe = await buildAstrolabeFromInput(input);
  const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2026-08-10', 6);
  return {
    soul: astrolabe.soul,
    palaceCount: astrolabe.palaces.length,
    horoscopeAge: horoscope.age,
  };
}
