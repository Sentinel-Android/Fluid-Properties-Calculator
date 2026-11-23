// Generated from src/. Run npm run build after changing calculator source.
(() => {
  // src/history.js
  var databaseName = "aditusan-calculation-history";
  var database;
  function openDatabase() {
    database ??= new Promise((resolve, reject) => {
      const request2 = indexedDB.open(databaseName, 1);
      request2.onupgradeneeded = () => {
        const db = request2.result;
        const records = db.createObjectStore("records", { keyPath: "id", autoIncrement: true });
        records.createIndex("scope", "scope");
        db.createObjectStore("snapshots");
      };
      request2.onsuccess = () => resolve(request2.result);
      request2.onerror = () => reject(request2.error);
      request2.onblocked = () => reject(new Error("Calculation history storage is blocked."));
    });
    return database;
  }
  function resultOf(request2) {
    return new Promise((resolve, reject) => {
      request2.onsuccess = () => resolve(request2.result);
      request2.onerror = () => reject(request2.error);
    });
  }
  async function changeHistory(scope, update) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["records", "snapshots"], "readwrite");
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error ?? new Error("History storage is unavailable."));
      const records = transaction.objectStore("records");
      const snapshots = transaction.objectStore("snapshots");
      const matches = records.index("scope").getAll(scope);
      matches.onsuccess = () => update(matches.result, records, snapshots);
    });
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const focused = document.activeElement;
      const field2 = document.createElement("textarea");
      field2.value = text;
      field2.readOnly = true;
      field2.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      document.body.append(field2);
      field2.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      } finally {
        field2.remove();
        focused?.focus({ preventScroll: true });
      }
    }
  }
  function createHistory(id, { restore, limit = 20 }) {
    const panel = document.getElementById(id);
    const list = panel.querySelector(".history-list");
    const empty = panel.querySelector(".history-empty");
    const clear = panel.querySelector(".history-clear");
    const note = panel.querySelector(".history-message");
    const scope = location.pathname.replace(/(?:index|local-preview)\.html$/, "").replace(/\/?$/, "/") + "#" + id;
    let pending = Promise.resolve();
    let temporary = [];
    function render(entries) {
      list.replaceChildren();
      empty.hidden = entries.length > 0;
      clear.disabled = entries.length === 0;
      for (const entry of entries) {
        const row = document.createElement("li");
        const description = document.createElement("span");
        description.textContent = entry.summary;
        const when = document.createElement("small");
        when.className = "history-time";
        when.textContent = new Date(entry.time).toLocaleString(void 0, { dateStyle: "short", timeStyle: "short" });
        description.append(when);
        const actions = document.createElement("div");
        actions.className = "history-actions";
        const restoreButton = document.createElement("button");
        restoreButton.type = "button";
        restoreButton.textContent = "Restore";
        restoreButton.setAttribute("aria-label", "Restore " + entry.summary);
        restoreButton.addEventListener("click", async () => {
          try {
            const snapshot = entry.snapshot ?? await resultOf((await openDatabase()).transaction("snapshots").objectStore("snapshots").get(entry.id));
            if (!snapshot) throw new Error("That calculation was cleared.");
            restore(snapshot);
            note.textContent = "Calculation restored.";
          } catch (error2) {
            note.textContent = error2.message;
          }
        });
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.textContent = "Copy";
        copyButton.setAttribute("aria-label", "Copy result for " + entry.summary);
        copyButton.addEventListener("click", async () => {
          note.textContent = await copyText(entry.clipboardText) ? "Copied to clipboard." : "Clipboard access was unavailable.";
        });
        actions.append(restoreButton, copyButton);
        row.append(description, actions);
        list.append(row);
      }
    }
    async function refresh() {
      let entries = [];
      try {
        const db = await openDatabase();
        entries = await resultOf(db.transaction("records").objectStore("records").index("scope").getAll(scope));
      } catch {
        if (!note.textContent) note.textContent = "History is available for this tab only.";
      }
      render([...temporary, ...entries.reverse()].slice(0, limit));
    }
    clear.addEventListener("click", () => {
      pending = pending.then(async () => {
        temporary = [];
        try {
          await changeHistory(scope, (entries, records, snapshots) => {
            for (const entry of entries) {
              records.delete(entry.id);
              snapshots.delete(entry.id);
            }
          });
          note.textContent = "History cleared.";
        } catch {
          note.textContent = "Tab history cleared.";
        }
        await refresh();
      });
    });
    pending = refresh();
    return {
      add(summary, snapshot, clipboardText) {
        const record = { scope, summary, time: Date.now(), bytes: 0, clipboardText };
        pending = pending.then(async () => {
          try {
            await changeHistory(scope, (entries, records, snapshots) => {
              for (const entry of entries.slice(0, Math.max(0, entries.length - limit + 1))) {
                records.delete(entry.id);
                snapshots.delete(entry.id);
              }
              const insert = records.add(record);
              insert.onsuccess = () => snapshots.add(snapshot, insert.result);
            });
            note.textContent = "";
          } catch {
            temporary = [{ ...record, snapshot }, ...temporary].slice(0, limit);
            note.textContent = "History is available for this tab only.";
          }
          await refresh();
        });
      }
    };
  }

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
  var examples = {
    water: { fluid: "Water", a: ["P", 101.325, 0], b: ["Q", 0, 0] },
    r134a: { fluid: "R134a", a: ["T", 300, 1], b: ["Q", 0, 0] },
    mix: { fluid: "Water", a: ["P", 101.325, 0], b: ["Q", 0.5, 0] },
    air: { fluid: "Air", a: ["T", 25, 0], b: ["P", 101.325, 0] }
  };
  function stateValue(key, unitIndex, value) {
    const input = inputs[key];
    const selectedUnit = input.units[unitIndex];
    if (!Number.isFinite(value) || !selectedUnit) throw new Error("Enter a finite value for " + input.label.toLowerCase() + ".");
    const result = selectedUnit.toSI(value);
    if (!Number.isFinite(result)) throw new Error("The selected unit conversion is outside the numeric range.");
    if ("TPD".includes(key) && result <= 0) throw new Error(input.label + " must be positive in absolute SI units.");
    if (key === "Q" && (result < 0 || result > 1)) throw new Error("Vapour quality must be between 0 and 1, or 0% and 100%.");
    return result;
  }
  function matlabCall(state, key) {
    const rounded = (value) => String(Number(value.toPrecision(14)));
    const fluid2 = state.fluid.replaceAll("'", "''");
    return "getFluidProperty(lib, '" + key + "', '" + state.keyA + "', " + rounded(state.valueA) + ", '" + state.keyB + "', " + rounded(state.valueB) + ", '" + fluid2 + "')";
  }

  // src/calculator.js
  var assetURL = document.currentScript.src;
  var byId = (id) => document.getElementById(id);
  var form = byId("state");
  var fluid = byId("fluid");
  var example = byId("example");
  var error = byId("state-error");
  var engineState = byId("engine-state");
  var calculateButton = byId("calculate");
  var copy = byId("copy");
  var copyResults = byId("copy-result");
  var resultArea = byId("result");
  var field = Object.fromEntries(["a", "b"].map((name) => [name, {
    key: byId("key-" + name),
    value: byId("value-" + name),
    unit: byId("unit-" + name)
  }]));
  var formatter = new Intl.NumberFormat("en", { maximumSignificantDigits: 8 });
  var format = (number) => number !== 0 && Math.abs(number) < 1e-3 ? number.toExponential(5) : formatter.format(number);
  var engineReady = false;
  var request = 0;
  var calculation;
  var clipboardResult = "";
  var worker;
  function setField(target, key, value = "", unit2 = 0) {
    target.key.value = key;
    target.unit.replaceChildren(...inputs[key].units.map((item, index) => new Option(item.label, index)));
    target.unit.value = unit2;
    target.value.value = value;
  }
  function renderResult(result, state) {
    const phase = document.createElement("p");
    phase.className = "result-note result-title";
    phase.textContent = result.phaseName;
    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "results-table";
    const headings = table.createTHead().insertRow();
    for (const name of ["Property", "Value", "Unit"]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = name;
      headings.append(cell);
    }
    const body = table.createTBody();
    for (const item of result.rows) {
      const row = body.insertRow();
      const property = document.createElement("th");
      property.scope = "row";
      property.textContent = item.label;
      row.append(property);
      const value = document.createElement("output");
      value.textContent = outputValue(item);
      row.insertCell().append(value);
      row.insertCell().textContent = item.unit;
    }
    tableWrap.append(table);
    resultArea.replaceChildren(phase, tableWrap);
    const matlab = document.createElement("div");
    matlab.className = "result-note";
    if (result.twoPhase) {
      const note = document.createElement("p");
      note.className = "status";
      note.textContent = "Use Q = 0 or Q = 1 to obtain properties of each saturated phase.";
      matlab.append(note);
    }
    const picker = document.createElement("label");
    picker.className = "output-picker";
    picker.textContent = "MATLAB output";
    const output = document.createElement("select");
    output.id = "matlab-output";
    output.replaceChildren(...result.rows.filter((item) => item.value !== null).map((item) => new Option(item.label, item.key)));
    output.value = "T";
    if (output.selectedIndex === -1) output.selectedIndex = 0;
    picker.append(output);
    matlab.append(picker);
    const snippet = document.createElement("code");
    snippet.className = "snippet";
    const showCall = () => {
      snippet.textContent = matlabCall(state, output.value);
      copy.textContent = "Copy MATLAB call";
    };
    output.addEventListener("change", showCall);
    matlab.append(snippet);
    resultArea.append(matlab);
    showCall();
    const outputLines = result.rows.map((item) => item.label + "	" + outputValue(item) + "	" + item.unit);
    clipboardResult = [state.fluid + " \xB7 " + result.phaseName, "Property	Value	Unit", ...outputLines].join("\n");
    copyResults.hidden = false;
    copy.hidden = false;
  }
  function outputValue(item) {
    return item.value === null ? "Unavailable" : format(item.value);
  }
  function resetResult(message = "Enter two independent properties and click Calculate.") {
    const hint = document.createElement("p");
    hint.className = "panel-body muted";
    hint.textContent = message;
    resultArea.replaceChildren(hint);
    clipboardResult = "";
    copyResults.hidden = true;
    copyResults.textContent = "Copy results";
    copy.hidden = true;
    copy.textContent = "Copy MATLAB call";
  }
  function clearResult() {
    request++;
    calculation = void 0;
    calculateButton.disabled = !engineReady;
    error.textContent = "";
    resetResult();
  }
  function applySettings(settings) {
    if (!Array.from(fluid.options).some((option) => option.value === settings.fluid)) {
      fluid.add(new Option(settings.fluid, settings.fluid));
    }
    fluid.value = settings.fluid;
    setField(field.a, ...settings.a);
    setField(field.b, ...settings.b);
  }
  function buildState({ fluid: fluid2, a: [keyA, rawA, unitA], b: [keyB, rawB, unitB] }) {
    if (keyA === keyB) throw new Error("Choose two different input properties.");
    return { fluid: fluid2, keyA, keyB, valueA: stateValue(keyA, unitA, rawA), valueB: stateValue(keyB, unitB, rawB) };
  }
  function restoreCalculation({ settings, result }) {
    clearResult();
    applySettings(settings);
    calculation = { settings, state: buildState(settings) };
    renderResult(result, calculation.state);
  }
  var history = createHistory("fluid-properties-history", { restore: restoreCalculation });
  function submitState() {
    if (!engineReady) return;
    clearResult();
    try {
      const settings = {
        fluid: fluid.value,
        a: [field.a.key.value, field.a.value.valueAsNumber, field.a.unit.value],
        b: [field.b.key.value, field.b.value.valueAsNumber, field.b.unit.value]
      };
      calculation = { settings, state: buildState(settings) };
      resetResult("Calculating\u2026");
      calculateButton.disabled = true;
      worker.postMessage({ type: "calculate", id: request, state: calculation.state });
    } catch (failure) {
      error.textContent = failure.message;
    }
  }
  function engineFailed() {
    engineReady = false;
    clearResult();
    engineState.textContent = "CoolProp could not start. Reload the page to retry.";
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitState();
  });
  byId("give-example").addEventListener("click", () => {
    applySettings(examples[example.value]);
    clearResult();
  });
  for (const target of Object.values(field)) {
    target.key.addEventListener("change", () => {
      setField(target, target.key.value);
      clearResult();
    });
    target.value.addEventListener("input", clearResult);
    target.unit.addEventListener("change", clearResult);
  }
  fluid.addEventListener("change", clearResult);
  copy.addEventListener("click", async () => {
    const currentRequest = request;
    const key = byId("matlab-output").value;
    const copied = await copyText(matlabCall(calculation.state, key));
    if (currentRequest === request && byId("matlab-output").value === key) {
      copy.textContent = copied ? "Copied" : "Select the call to copy";
    }
  });
  copyResults.addEventListener("click", async () => {
    const currentRequest = request;
    const copied = await copyText(clipboardResult);
    if (currentRequest === request) copyResults.textContent = copied ? "Copied" : "Copy failed";
  });
  var keys = Object.entries(inputs);
  for (const target of Object.values(field)) {
    target.key.replaceChildren(...keys.map(([key, entry]) => new Option(entry.label, key)));
  }
  setField(field.a, "P");
  setField(field.b, "Q");
  try {
    worker = new Worker(new URL("./engine.js", assetURL), { type: "module" });
    worker.onerror = engineFailed;
    worker.onmessage = ({ data }) => {
      if (data.type === "init-error") return engineFailed();
      if (data.type === "ready") {
        const selected = fluid.value;
        const placeholder = new Option("Choose a fluid", "");
        fluid.replaceChildren(placeholder, ...data.fluids.sort((a, b) => a.localeCompare(b)).map((name) => new Option(name, name)));
        fluid.value = data.fluids.includes(selected) ? selected : "";
        engineState.textContent = "CoolProp " + data.version + " \xB7 Runs in this browser";
        engineReady = true;
        calculateButton.disabled = false;
        return;
      }
      if (data.id !== request) return;
      calculateButton.disabled = false;
      if (data.type === "result") {
        const { settings, state } = calculation;
        renderResult(data.result, state);
        const describe = ([key, value, unit2]) => {
          const label = inputs[key].units[unit2].label;
          return key + " " + format(value) + (label === "Fraction" ? "" : " " + label);
        };
        const summary = state.fluid + " \xB7 " + describe(settings.a) + " \xB7 " + describe(settings.b) + " \xB7 " + data.result.phaseName;
        history.add(summary, { settings, result: data.result }, clipboardResult);
      } else if (data.type === "calculation-error") {
        resetResult("Enter a supported pair of properties and calculate again.");
        error.textContent = data.message;
      }
    };
  } catch {
    engineFailed();
  }
  byId("state").dataset.initialized = "true";
})();
