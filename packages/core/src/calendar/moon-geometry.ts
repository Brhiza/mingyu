/** 由地心黄经、黄纬与距离计算日月球面角距和月面照明比例。 */
export function calculateMoonGeometry(input: {
  sunLongitude: number;
  sunLatitude: number;
  sunDistance: number;
  moonLongitude: number;
  moonLatitude: number;
  moonDistance: number;
}) {
  const radians = Math.PI / 180;
  const longitudeDifference = (input.moonLongitude - input.sunLongitude) * radians;
  const cosineElongation =
    Math.sin(input.sunLatitude * radians) * Math.sin(input.moonLatitude * radians) +
    Math.cos(input.sunLatitude * radians) *
      Math.cos(input.moonLatitude * radians) *
      Math.cos(longitudeDifference);
  const elongationRadians = Math.acos(Math.max(-1, Math.min(1, cosineElongation)));
  const sunMoonDistance = Math.hypot(
    input.sunDistance - input.moonDistance * Math.cos(elongationRadians),
    input.moonDistance * Math.sin(elongationRadians),
  );
  const cosineLunarPhase =
    (input.moonDistance - input.sunDistance * Math.cos(elongationRadians)) / sunMoonDistance;
  return {
    elongationDegrees: elongationRadians / radians,
    illuminationFraction: (1 + Math.max(-1, Math.min(1, cosineLunarPhase))) / 2,
  };
}
