import { copyText, createHistory } from './history.js';
import { examples, inputs, matlabCall, stateValue } from './properties.js';

const byId = id => document.getElementById(id);
const form = byId('state');
const fluid = byId('fluid');
const example = byId('example');
const error = byId('state-error');
const engineState = byId('engine-state');
const calculateButton = byId('calculate');
const copy = byId('copy');
const copyResults = byId('copy-result');
const resultArea = byId('result');
const field = Object.fromEntries(['a', 'b'].map(name => [name, {
  key: byId('key-' + name), value: byId('value-' + name), unit: byId('unit-' + name),
}]));
const formatter = new Intl.NumberFormat('en', { maximumSignificantDigits: 8 });
const format = number => number !== 0 && Math.abs(number) < 0.001 ? number.toExponential(5) : formatter.format(number);
let engineReady = false;
let request = 0;
let calculation;
let clipboardResult = '';
let worker;

function setField(target, key, value = '', unit = 0) {
  target.key.value = key;
  target.unit.replaceChildren(...inputs[key].units.map((item, index) => new Option(item.label, index)));
  target.unit.value = unit;
  target.value.value = value;
}

function renderResult(result, state) {
  const phase = document.createElement('p');
  phase.className = 'result-note result-title';
  phase.textContent = result.phaseName;

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'results-table';
  const headings = table.createTHead().insertRow();
  for (const name of ['Property', 'Value', 'Unit']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = name;
    headings.append(cell);
  }
  const body = table.createTBody();
  for (const item of result.rows) {
    const row = body.insertRow();
    const property = document.createElement('th');
    property.scope = 'row';
    property.textContent = item.label;
    row.append(property);
    const value = document.createElement('output');
    value.textContent = outputValue(item);
    row.insertCell().append(value);
    row.insertCell().textContent = item.unit;
  }
  tableWrap.append(table);
  resultArea.replaceChildren(phase, tableWrap);

  const matlab = document.createElement('div');
  matlab.className = 'result-note';
  if (result.twoPhase) {
    const note = document.createElement('p');
    note.className = 'status';
    note.textContent = 'Use Q = 0 or Q = 1 to obtain properties of each saturated phase.';
    matlab.append(note);
  }
  const picker = document.createElement('label');
  picker.className = 'output-picker';
  picker.textContent = 'MATLAB output';
  const output = document.createElement('select');
  output.id = 'matlab-output';
  output.replaceChildren(...result.rows.filter(item => item.value !== null).map(item => new Option(item.label, item.key)));
  output.value = 'T';
  if (output.selectedIndex === -1) output.selectedIndex = 0;
  picker.append(output);
  matlab.append(picker);
  const snippet = document.createElement('code');
  snippet.className = 'snippet';
  const showCall = () => {
    snippet.textContent = matlabCall(state, output.value);
    copy.textContent = 'Copy MATLAB call';
  };
  output.addEventListener('change', showCall);
  matlab.append(snippet);
  resultArea.append(matlab);
  showCall();
  const outputLines = result.rows.map(item => item.label + '\t' + outputValue(item) + '\t' + item.unit);
  clipboardResult = [state.fluid + ' · ' + result.phaseName, 'Property\tValue\tUnit', ...outputLines].join('\n');
  copyResults.hidden = false;
  copy.hidden = false;
}

function outputValue(item) {
  return item.value === null ? 'Unavailable' : format(item.value);
}

function resetResult(message = 'Enter two independent properties and click Calculate.') {
  const hint = document.createElement('p');
  hint.className = 'panel-body muted';
  hint.textContent = message;
  resultArea.replaceChildren(hint);
  clipboardResult = '';
  copyResults.hidden = true;
  copyResults.textContent = 'Copy results';
  copy.hidden = true;
  copy.textContent = 'Copy MATLAB call';
}

function clearResult() {
  request++;
  calculation = undefined;
  calculateButton.disabled = !engineReady;
  error.textContent = '';
  resetResult();
}

function applySettings(settings) {
  if (!Array.from(fluid.options).some(option => option.value === settings.fluid)) {
    fluid.add(new Option(settings.fluid, settings.fluid));
  }
  fluid.value = settings.fluid;
  setField(field.a, ...settings.a);
  setField(field.b, ...settings.b);
}

function buildState({ fluid, a: [keyA, rawA, unitA], b: [keyB, rawB, unitB] }) {
  if (keyA === keyB) throw new Error('Choose two different input properties.');
  return { fluid, keyA, keyB, valueA: stateValue(keyA, unitA, rawA), valueB: stateValue(keyB, unitB, rawB) };
}

function restoreCalculation({ settings, result }) {
  clearResult();
  applySettings(settings);
  calculation = { settings, state: buildState(settings) };
  renderResult(result, calculation.state);
}

const history = createHistory('fluid-properties-history', { restore: restoreCalculation });

function submitState() {
  if (!engineReady) return;
  clearResult();
  try {
    const settings = {
      fluid: fluid.value,
      a: [field.a.key.value, field.a.value.valueAsNumber, field.a.unit.value],
      b: [field.b.key.value, field.b.value.valueAsNumber, field.b.unit.value],
    };
    calculation = { settings, state: buildState(settings) };
    resetResult('Calculating…');
    calculateButton.disabled = true;
    worker.postMessage({ type: 'calculate', id: request, state: calculation.state });
  } catch (failure) {
    error.textContent = failure.message;
  }
}

function engineFailed() {
  engineReady = false;
  clearResult();
  engineState.textContent = 'CoolProp could not start. Reload the page to retry.';
}

form.addEventListener('submit', event => { event.preventDefault(); submitState(); });
byId('give-example').addEventListener('click', () => {
  applySettings(examples[example.value]);
  clearResult();
});
for (const target of Object.values(field)) {
  target.key.addEventListener('change', () => {
    setField(target, target.key.value);
    clearResult();
  });
  target.value.addEventListener('input', clearResult);
  target.unit.addEventListener('change', clearResult);
}
fluid.addEventListener('change', clearResult);

copy.addEventListener('click', async () => {
  const currentRequest = request;
  const key = byId('matlab-output').value;
  const copied = await copyText(matlabCall(calculation.state, key));
  if (currentRequest === request && byId('matlab-output').value === key) {
    copy.textContent = copied ? 'Copied' : 'Select the call to copy';
  }
});
copyResults.addEventListener('click', async () => {
  const currentRequest = request;
  const copied = await copyText(clipboardResult);
  if (currentRequest === request) copyResults.textContent = copied ? 'Copied' : 'Copy failed';
});

const keys = Object.entries(inputs);
for (const target of Object.values(field)) {
  target.key.replaceChildren(...keys.map(([key, entry]) => new Option(entry.label, key)));
}
setField(field.a, 'P');
setField(field.b, 'Q');
try {
  worker = new Worker(new URL('./engine.js', import.meta.url), { type: 'module' });
  worker.onerror = engineFailed;
  worker.onmessage = ({ data }) => {
    if (data.type === 'init-error') return engineFailed();
    if (data.type === 'ready') {
      const selected = fluid.value;
      const placeholder = new Option('Choose a fluid', '');
      fluid.replaceChildren(placeholder, ...data.fluids.sort((a, b) => a.localeCompare(b)).map(name => new Option(name, name)));
      fluid.value = data.fluids.includes(selected) ? selected : '';
      engineState.textContent = 'CoolProp ' + data.version + ' · Runs in this browser';
      engineReady = true;
      calculateButton.disabled = false;
      return;
    }
    if (data.id !== request) return;
    calculateButton.disabled = false;
    if (data.type === 'result') {
      const { settings, state } = calculation;
      renderResult(data.result, state);
      const describe = ([key, value, unit]) => {
        const label = inputs[key].units[unit].label;
        return key + ' ' + format(value) + (label === 'Fraction' ? '' : ' ' + label);
      };
      const summary = state.fluid + ' · ' + describe(settings.a) + ' · ' + describe(settings.b) + ' · ' + data.result.phaseName;
      history.add(summary, { settings, result: data.result }, clipboardResult);
    } else if (data.type === 'calculation-error') {
      resetResult('Enter a supported pair of properties and calculate again.');
      error.textContent = data.message;
    }
  };
} catch {
  engineFailed();
}
