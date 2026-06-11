const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  lampHours: 0,
  port: 4352,
  projectorName: 'PJLink Emulator',
  manufacturer: 'Generic',
  productName: 'EMU-1000',
}

// PJLink ERST error items, in the fixed order they appear in the response.
// Each value is 0 = OK, 1 = Warning, 2 = Error.
const ERROR_ITEMS = ['fan', 'lamp', 'temperature', 'cover', 'filter', 'other']

const runtime = {
  power: 0,
  avMute: false,
  input: 11,
  fastTick: false,
  errors: { fan: 0, lamp: 0, temperature: 0, cover: 0, filter: 0, other: 0 },
  _transitionTimer: null,
  _lampInterval: null,
  _userDataPath: null,
}

let persisted = { ...DEFAULTS }

function statePath() {
  return path.join(runtime._userDataPath, 'state.json')
}

function loadState(userDataPath) {
  runtime._userDataPath = userDataPath
  try {
    const raw = fs.readFileSync(statePath(), 'utf8')
    const saved = JSON.parse(raw)
    persisted = { ...DEFAULTS, ...saved }
  } catch {
    persisted = { ...DEFAULTS }
  }
}

function saveState() {
  try {
    fs.mkdirSync(runtime._userDataPath, { recursive: true })
    fs.writeFileSync(statePath(), JSON.stringify(persisted, null, 2))
  } catch (e) {
    console.error('Failed to save state:', e.message)
  }
}

function getState() {
  return {
    power: runtime.power,
    avMute: runtime.avMute,
    input: runtime.input,
    fastTick: runtime.fastTick,
    errors: { ...runtime.errors },
    lampHours: persisted.lampHours,
    port: persisted.port,
    projectorName: persisted.projectorName,
    manufacturer: persisted.manufacturer,
    productName: persisted.productName,
  }
}

function startLampTick() {
  stopLampTick()
  const interval = runtime.fastTick ? 60_000 : 3_600_000
  runtime._lampInterval = setInterval(() => {
    persisted.lampHours += 1
    saveState()
  }, interval)
}

function stopLampTick() {
  if (runtime._lampInterval) {
    clearInterval(runtime._lampInterval)
    runtime._lampInterval = null
  }
}

function setPower(target, onChange) {
  if (runtime.power === 2 || runtime.power === 3) return 'ERR3'
  if (target === runtime.power) return 'OK'

  if (runtime._transitionTimer) {
    clearTimeout(runtime._transitionTimer)
    runtime._transitionTimer = null
  }

  if (target === 1) {
    runtime.power = 3
    onChange()
    runtime._transitionTimer = setTimeout(() => {
      runtime.power = 1
      runtime._transitionTimer = null
      startLampTick()
      onChange()
    }, 10_000)
  } else if (target === 0) {
    stopLampTick()
    runtime.power = 2
    onChange()
    runtime._transitionTimer = setTimeout(() => {
      runtime.power = 0
      runtime._transitionTimer = null
      onChange()
    }, 10_000)
  } else {
    return 'ERR2'
  }

  return 'OK'
}

function setLampHours(hours, onChange) {
  persisted.lampHours = Math.max(0, Math.floor(hours))
  saveState()
  onChange()
}

function setFastTick(enabled, onChange) {
  runtime.fastTick = enabled
  if (runtime.power === 1) {
    startLampTick()
  }
  onChange()
}

function setPort(port, onChange) {
  const p = parseInt(port, 10)
  if (isNaN(p) || p < 1024 || p > 65535) return false
  persisted.port = p
  saveState()
  onChange()
  return true
}

function setProjectorName(name, onChange) {
  persisted.projectorName = String(name).slice(0, 64)
  saveState()
  onChange()
}

function setManufacturer(name, onChange) {
  persisted.manufacturer = String(name).slice(0, 64)
  saveState()
  onChange()
}

function setProductName(name, onChange) {
  persisted.productName = String(name).slice(0, 64)
  saveState()
  onChange()
}

function setAvMute(enabled, onChange) {
  runtime.avMute = enabled
  onChange()
}

function setError(item, value, onChange) {
  if (!Object.prototype.hasOwnProperty.call(runtime.errors, item)) return false
  const v = parseInt(value, 10)
  if (v !== 0 && v !== 1 && v !== 2) return false
  runtime.errors[item] = v
  onChange()
  return true
}

function queryLamp() {
  return `${persisted.lampHours} ${runtime.power === 1 ? 1 : 0}`
}

function queryErrors() {
  return ERROR_ITEMS.map((item) => runtime.errors[item]).join('')
}

module.exports = {
  loadState,
  saveState,
  getState,
  setPower,
  setLampHours,
  setFastTick,
  setPort,
  setProjectorName,
  setManufacturer,
  setProductName,
  setAvMute,
  setError,
  queryLamp,
  queryErrors,
  get power() { return runtime.power },
  get errors() { return { ...runtime.errors } },
  get avMute() { return runtime.avMute },
  get input() { return runtime.input },
  get fastTick() { return runtime.fastTick },
  get lampHours() { return persisted.lampHours },
  get port() { return persisted.port },
  get projectorName() { return persisted.projectorName },
  get manufacturer() { return persisted.manufacturer },
  get productName() { return persisted.productName },
}
