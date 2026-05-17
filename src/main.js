const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const state = require('./state')
const PJLinkServer = require('./pjlink-server')

let win = null
let serverError = null

function onChange() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('state-update', { ...state.getState(), serverError })
  }
}

function onLog(entry) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('log-entry', entry)
  }
}

// Pass a no-op onChange to the server's AVMT/INPT handlers since those
// mutations come from TCP clients and don't need to update state (already handled
// via the live getters). Power changes from TCP do need onChange — we wrap it.
const server = new PJLinkServer(
  {
    get power() { return state.power },
    get avMute() { return state.avMute },
    get input() { return state.input },
    get lampHours() { return state.lampHours },
    get projectorName() { return state.projectorName },
    get manufacturer() { return state.manufacturer },
    get productName() { return state.productName },
    setPower: (target, _cb) => state.setPower(target, onChange),
    setAvMute: (enabled, _cb) => state.setAvMute(enabled, onChange),
    queryLamp: () => state.queryLamp(),
  },
  onLog
)

function createMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [{ label: 'Exit', click: () => app.quit() }],
    },
  ]))
}

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 520,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'PJLink Emulator',
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.on('closed', () => { win = null })

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('state-update', { ...state.getState(), serverError })
  })
}

ipcMain.handle('get-state', () => ({ ...state.getState(), serverError }))

ipcMain.handle('set-power', (_e, target) => {
  return state.setPower(target, onChange)
})

ipcMain.handle('set-lamp-hours', (_e, hours) => {
  state.setLampHours(hours, onChange)
})

ipcMain.handle('set-fast-tick', (_e, enabled) => {
  state.setFastTick(enabled, onChange)
})

ipcMain.handle('set-port', async (_e, port) => {
  const ok = state.setPort(port, () => {})
  if (!ok) return false
  try {
    await server.restart(state.port)
    serverError = null
  } catch (err) {
    serverError = err.message
  }
  onChange()
  return ok
})

ipcMain.handle('set-name', (_e, name) => {
  state.setProjectorName(name, onChange)
})

ipcMain.handle('set-manufacturer', (_e, name) => {
  state.setManufacturer(name, onChange)
})

ipcMain.handle('set-product-name', (_e, name) => {
  state.setProductName(name, onChange)
})

app.whenReady().then(async () => {
  state.loadState(app.getPath('userData'))

  try {
    await server.start(state.port)
    serverError = null
  } catch (err) {
    serverError = err.message
    console.error('Server start failed:', err.message)
  }

  createMenu()
  createWindow()
})

app.on('window-all-closed', async () => {
  await server.stop()
  app.quit()
})
