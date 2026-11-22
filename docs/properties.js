const unit = (label, factor = 1, offset = 0) => ({ label, toSI: value => value * factor + offset });

export const inputs = {
  T: { label: 'Temperature', units: [unit('°C', 1, 273.15), unit('K'), unit('°F', 5 / 9, 273.15 - 32 * 5 / 9)] },
  P: { label: 'Absolute pressure', units: [unit('kPa', 1000), unit('Pa'), unit('bar', 100000), unit('MPa', 1e6), unit('psia', 6894.757293168)] },
  Q: { label: 'Vapour quality (Q)', units: [unit('Fraction'), unit('%', .01)] },
  H: { label: 'Specific enthalpy', units: [unit('kJ/kg', 1000), unit('J/kg')] },
  S: { label: 'Specific entropy', units: [unit('kJ/(kg·K)', 1000), unit('J/(kg·K)')] },
  D: { label: 'Density', units: [unit('kg/m³'), unit('g/cm³', 1000)] },
  U: { label: 'Specific internal energy', units: [unit('kJ/kg', 1000), unit('J/kg')] },
};

export const outputs = [
  { key: 'T', label: 'Temperature', unit: '°C', convert: value => value - 273.15 },
  { key: 'P', label: 'Absolute pressure', unit: 'kPa', convert: value => value / 1e3 },
  { key: 'D', label: 'Density', unit: 'kg/m³' },
  { key: 'H', label: 'Specific enthalpy', unit: 'kJ/kg', convert: value => value / 1e3 },
  { key: 'S', label: 'Specific entropy', unit: 'kJ/(kg·K)', convert: value => value / 1e3 },
  { key: 'U', label: 'Specific internal energy', unit: 'kJ/kg', convert: value => value / 1e3 },
  { key: 'Q', label: 'Vapour quality (Q)', unit: '' },
  { key: 'V', label: 'Dynamic viscosity', unit: 'Pa·s', phaseProperty: true },
  { key: 'L', label: 'Thermal conductivity', unit: 'W/(m·K)', phaseProperty: true },
  { key: 'C', label: 'Specific heat (Cp)', unit: 'kJ/(kg·K)', convert: value => value / 1e3, phaseProperty: true },
  { key: 'O', label: 'Specific heat (Cv)', unit: 'kJ/(kg·K)', convert: value => value / 1e3, phaseProperty: true },
];

export const examples = {
  water: { fluid: 'Water', a: ['P', 101.325, 0], b: ['Q', 0, 0] },
  r134a: { fluid: 'R134a', a: ['T', 300, 1], b: ['Q', 0, 0] },
  mix: { fluid: 'Water', a: ['P', 101.325, 0], b: ['Q', .5, 0] },
  air: { fluid: 'Air', a: ['T', 25, 0], b: ['P', 101.325, 0] },
};

export function stateValue(key, unitIndex, value) {
  const input = inputs[key];
  const selectedUnit = input.units[unitIndex];
  if (!Number.isFinite(value) || !selectedUnit) throw new Error('Enter a finite value for ' + input.label.toLowerCase() + '.');
  const result = selectedUnit.toSI(value);
  if (!Number.isFinite(result)) throw new Error('The selected unit conversion is outside the numeric range.');
  if ('TPD'.includes(key) && result <= 0) throw new Error(input.label + ' must be positive in absolute SI units.');
  if (key === 'Q' && (result < 0 || result > 1)) throw new Error('Vapour quality must be between 0 and 1, or 0% and 100%.');
  return result;
}

function readProperty(engine, key, args) {
  const result = engine.PropsSI(key, ...args);
  if (!Number.isFinite(result) || Math.abs(result) > 1e90) {
    const error = engine.get_global_param_string('errstring');
    throw new Error(error || 'CoolProp returned no finite value.');
  }
  return result;
}

const phaseNames = ['Liquid', 'Supercritical', 'Supercritical gas', 'Supercritical liquid', 'Critical point', 'Gas', 'Liquid–vapour equilibrium'];

export function compute(engine, state) {
  const args = [state.keyA, state.valueA, state.keyB, state.valueB, state.fluid];
  // Validate the input pair before querying outputs individually.
  const density = readProperty(engine, 'D', args);
  let quality = null;
  let phaseName = 'State calculated';
  try {
    const q = readProperty(engine, 'Q', args);
    if (q >= 0 && q <= 1) quality = q;
  } catch { /* Some backend states do not provide vapour quality. */ }
  if (quality === 0) phaseName = 'Saturated liquid';
  else if (quality === 1) phaseName = 'Saturated vapour';
  else if (quality !== null) phaseName = 'Two-phase liquid and vapour';
  else {
    try { phaseName = phaseNames[readProperty(engine, 'Phase', args)] || phaseName; }
    catch { /* The other outputs are still available when phase cannot be queried. */ }
  }
  const twoPhase = quality !== null && quality > 0 && quality < 1;
  const rows = outputs.map(output => {
    let value = null;
    if (output.key === 'D') value = density;
    else if (output.key === 'Q') value = quality;
    else if (!(output.phaseProperty && twoPhase)) {
      try { value = readProperty(engine, output.key, args); }
      catch { /* Keep other valid properties if this individual output is unavailable. */ }
    }
    return { key: output.key, label: output.label, unit: output.unit, value: value !== null && output.convert ? output.convert(value) : value };
  });
  return { rows, phaseName, twoPhase };
}

export function matlabCall(state, key) {
  const rounded = value => String(Number(value.toPrecision(14)));
  const fluid = state.fluid.replaceAll("'", "''");
  return "getFluidProperty(lib, '" + key + "', '" + state.keyA + "', " + rounded(state.valueA)
    + ", '" + state.keyB + "', " + rounded(state.valueB) + ", '" + fluid + "')";
}
