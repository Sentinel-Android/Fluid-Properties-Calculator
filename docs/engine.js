import createEngine from './vendor/coolprop.js';
import { compute } from './properties.js';

let engine;
try {
  engine = await createEngine();
  self.postMessage({
    type: 'ready',
    version: engine.get_global_param_string('version'),
    fluids: engine.get_global_param_string('FluidsList').split(',').filter(Boolean),
  });
} catch {
  self.postMessage({ type: 'init-error' });
}

self.onmessage = ({ data }) => {
  if (!engine || data.type !== 'calculate') return;
  try {
    self.postMessage({ type: 'result', id: data.id, result: compute(engine, data.state) });
  } catch (failure) {
    let message = failure?.message;
    if (!message) {
      try { message = engine.getExceptionMessage(failure).at(-1); }
      catch { /* Non-C++ errors can be reported without low-level detail. */ }
    }
    self.postMessage({
      type: 'calculation-error', id: data.id,
      message: message ? String(message).slice(0, 350) : 'CoolProp could not resolve this fluid state. Check the input pair and units.',
    });
  }
};
