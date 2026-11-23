// Generated from src/engine.js and src/properties.js. Run npm run build to update.

// src/engine.js
import createEngine from "./vendor/coolprop.js";

// src/properties.js
var unit = (label, factor = 1, offset = 0) => ({ label, toSI: (value) => value * factor + offset });
var inputs = {
  T: { label: "Temperature", units: [unit("\xB0C", 1, 273.15), unit("K"), unit("\xB0F", 5 / 9, 273.15 - 32 * 5 / 9)] },
  P: { label: "Absolute pressure", units: [unit("kPa", 1e3), unit("Pa"), unit("bar", 1e5), unit("MPa", 1e6), unit("psia", 6894.757293168)] },
  Q: { label: "Vapour quality (Q)", units: [unit("Fraction"), unit("%", 0.01)] },
  H: { label: "Specific enthalpy", units: [unit("kJ/kg", 1e3), unit("J/kg")] },
  S: { label: "Specific entropy", units: [unit("kJ/(kg\xB7K)", 1e3), unit("J/(kg\xB7K)")] },
  D: { label: "Density", units: [unit("kg/m\xB3"), unit("g/cm\xB3", 1e3)] },
  U: { label: "Specific internal energy", units: [unit("kJ/kg", 1e3), unit("J/kg")] }
};
var outputs = [
  { key: "T", label: "Temperature", unit: "\xB0C", convert: (value) => value - 273.15 },
  { key: "P", label: "Absolute pressure", unit: "kPa", convert: (value) => value / 1e3 },
  { key: "D", label: "Density", unit: "kg/m\xB3" },
  { key: "H", label: "Specific enthalpy", unit: "kJ/kg", convert: (value) => value / 1e3 },
  { key: "S", label: "Specific entropy", unit: "kJ/(kg\xB7K)", convert: (value) => value / 1e3 },
  { key: "U", label: "Specific internal energy", unit: "kJ/kg", convert: (value) => value / 1e3 },
  { key: "Q", label: "Vapour quality (Q)", unit: "" },
  { key: "V", label: "Dynamic viscosity", unit: "Pa\xB7s", phaseProperty: true },
  { key: "L", label: "Thermal conductivity", unit: "W/(m\xB7K)", phaseProperty: true },
  { key: "C", label: "Specific heat (Cp)", unit: "kJ/(kg\xB7K)", convert: (value) => value / 1e3, phaseProperty: true },
  { key: "O", label: "Specific heat (Cv)", unit: "kJ/(kg\xB7K)", convert: (value) => value / 1e3, phaseProperty: true }
];
function readProperty(engine2, key, args) {
  const result = engine2.PropsSI(key, ...args);
  if (!Number.isFinite(result) || Math.abs(result) > 1e90) {
    const error = engine2.get_global_param_string("errstring");
    throw new Error(error || "CoolProp returned no finite value.");
  }
  return result;
}
var phaseNames = ["Liquid", "Supercritical", "Supercritical gas", "Supercritical liquid", "Critical point", "Gas", "Liquid\u2013vapour equilibrium"];
function compute(engine2, state) {
  const args = [state.keyA, state.valueA, state.keyB, state.valueB, state.fluid];
  const density = readProperty(engine2, "D", args);
  let quality = null;
  let phaseName = "State calculated";
  try {
    const q = readProperty(engine2, "Q", args);
    if (q >= 0 && q <= 1) quality = q;
  } catch {
  }
  if (quality === 0) phaseName = "Saturated liquid";
  else if (quality === 1) phaseName = "Saturated vapour";
  else if (quality !== null) phaseName = "Two-phase liquid and vapour";
  else {
    try {
      phaseName = phaseNames[readProperty(engine2, "Phase", args)] || phaseName;
    } catch {
    }
  }
  const twoPhase = quality !== null && quality > 0 && quality < 1;
  const rows = outputs.map((output) => {
    let value = null;
    if (output.key === "D") value = density;
    else if (output.key === "Q") value = quality;
    else if (!(output.phaseProperty && twoPhase)) {
      try {
        value = readProperty(engine2, output.key, args);
      } catch {
      }
    }
    return { key: output.key, label: output.label, unit: output.unit, value: value !== null && output.convert ? output.convert(value) : value };
  });
  return { rows, phaseName, twoPhase };
}

// src/engine.js
var engine;
try {
  engine = await createEngine();
  self.postMessage({
    type: "ready",
    version: engine.get_global_param_string("version"),
    fluids: engine.get_global_param_string("FluidsList").split(",").filter(Boolean)
  });
} catch {
  self.postMessage({ type: "init-error" });
}
self.onmessage = ({ data }) => {
  if (!engine || data.type !== "calculate") return;
  try {
    self.postMessage({ type: "result", id: data.id, result: compute(engine, data.state) });
  } catch (failure) {
    let message = failure?.message;
    if (!message) {
      try {
        message = engine.getExceptionMessage(failure).at(-1);
      } catch {
      }
    }
    self.postMessage({
      type: "calculation-error",
      id: data.id,
      message: message ? String(message).slice(0, 350) : "CoolProp could not resolve this fluid state. Check the input pair and units."
    });
  }
};
