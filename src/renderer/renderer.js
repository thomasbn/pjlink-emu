const POWER_LABELS = ['Standby', 'On', 'Cooling...', 'Warming...']
const POWER_CLASSES = ['state-standby', 'state-on', 'state-cooling', 'state-warming']

let _suppressInfoInputs = false

function applyState(state) {
  const { power, fastTick, lampHours, port, projectorName, manufacturer, productName, serverError } = state

  // Server status
  const statusEl = document.getElementById('server-status')
  if (serverError) {
    statusEl.textContent = `Error: ${serverError}`
    statusEl.className = 'server-status err'
  } else {
    statusEl.textContent = `Listening on port ${port}`
    statusEl.className = 'server-status ok'
  }

  // Power state
  const indicator = document.getElementById('power-indicator')
  indicator.className = `power-indicator ${POWER_CLASSES[power]}`
  document.getElementById('power-state-label').textContent = POWER_LABELS[power]

  const inTransition = power === 2 || power === 3
  document.getElementById('btn-standby').disabled = inTransition || power === 0
  document.getElementById('btn-power-on').disabled = inTransition || power === 1

  // Lamp
  document.getElementById('lamp-hours').textContent = lampHours.toLocaleString()
  document.getElementById('lamp-status').textContent = power === 1 ? 'On' : 'Off'
  document.getElementById('fast-tick-toggle').checked = fastTick

  // Info inputs (avoid triggering change handlers)
  _suppressInfoInputs = true
  document.getElementById('name-input').value = projectorName
  document.getElementById('mfr-input').value = manufacturer
  document.getElementById('model-input').value = productName
  document.getElementById('port-input').value = port
  _suppressInfoInputs = false
}

function appendLogEntry(entry) {
  const ul = document.getElementById('log-container')
  const li = document.createElement('li')
  li.innerHTML =
    `<span class="ts">${entry.ts}</span>  ` +
    `<span class="client">${entry.client.padEnd(15)}</span>  ` +
    `<span class="cmd">${entry.raw.padEnd(20)}</span>  ` +
    `<span class="resp">→ ${entry.response}</span>`
  ul.insertBefore(li, ul.firstChild)
  while (ul.children.length > 50) ul.removeChild(ul.lastChild)
}

// Wire up controls
document.getElementById('btn-power-on').addEventListener('click', () => {
  window.electronAPI.invoke('set-power', 1)
})

document.getElementById('btn-standby').addEventListener('click', () => {
  window.electronAPI.invoke('set-power', 0)
})

document.getElementById('fast-tick-toggle').addEventListener('change', (e) => {
  window.electronAPI.invoke('set-fast-tick', e.target.checked)
})

// Lamp edit
document.getElementById('btn-edit-lamp').addEventListener('click', () => {
  const cur = parseInt(document.getElementById('lamp-hours').textContent.replace(/,/g, ''), 10)
  document.getElementById('lamp-hours-input').value = cur
  document.getElementById('lamp-edit-form').classList.remove('hidden')
})

document.getElementById('btn-lamp-save').addEventListener('click', () => {
  const val = parseInt(document.getElementById('lamp-hours-input').value, 10)
  if (!isNaN(val) && val >= 0) {
    window.electronAPI.invoke('set-lamp-hours', val)
  }
  document.getElementById('lamp-edit-form').classList.add('hidden')
})

document.getElementById('btn-lamp-cancel').addEventListener('click', () => {
  document.getElementById('lamp-edit-form').classList.add('hidden')
})

// Info inputs — commit on blur or Enter
function makeInfoHandler(id, channel) {
  const el = document.getElementById(id)
  const commit = () => {
    if (_suppressInfoInputs) return
    window.electronAPI.invoke(channel, el.value)
  }
  el.addEventListener('blur', commit)
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commit(); el.blur() } })
}

makeInfoHandler('name-input', 'set-name')
makeInfoHandler('mfr-input', 'set-manufacturer')
makeInfoHandler('model-input', 'set-product-name')

// Port input
const portInput = document.getElementById('port-input')
const commitPort = () => {
  if (_suppressInfoInputs) return
  const p = parseInt(portInput.value, 10)
  if (p >= 1024 && p <= 65535) {
    window.electronAPI.invoke('set-port', p)
  } else {
    portInput.classList.add('error')
    setTimeout(() => portInput.classList.remove('error'), 800)
  }
}
portInput.addEventListener('blur', commitPort)
portInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commitPort(); portInput.blur() } })

// Subscribe to events from main process
window.electronAPI.onStateUpdate(applyState)
window.electronAPI.onLogEntry(appendLogEntry)

// Load initial state
window.electronAPI.invoke('get-state').then(applyState)
