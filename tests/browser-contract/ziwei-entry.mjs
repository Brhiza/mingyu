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
  const birthdayInput = {
    ...input,
    birthDate: '2000-06-15',
    ageDivide: 'birthday',
  };
  const birthdayChart = await buildAstrolabeFromInput(birthdayInput);
  const birthdayHoroscope = await buildHoroscopeFromInput(
    birthdayChart,
    birthdayInput,
    '2001-07-04',
    6,
  );
  return {
    soul: astrolabe.soul,
    palaceCount: astrolabe.palaces.length,
    horoscopeAge: horoscope.age,
    birthdayAge: birthdayHoroscope.age.nominalAge,
  };
}
