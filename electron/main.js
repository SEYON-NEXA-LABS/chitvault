const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path  = require('path')
const http  = require('http')

// ── Config ────────────────────────────────────────────────────
const APP_NAME   = 'ChitVault'   // ← change per client
const DEV_PORT   = 3000          // Next.js dev port
const PROD_PORT  = 3456          // Port used when running built Next.js

let mainWindow
let nextServer   // child process for Next.js server in prod

// ── Detect environment ────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Wait for Next.js server to be ready ──────────────────────
function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      const req = http.get(`http://localhost:${port}`, res => {
        if (res.statusCode < 500) resolve()
        else { if (++attempts < retries) setTimeout(check, 1000); else reject() }
      })
      req.on('error', () => {
        if (++attempts < retries) setTimeout(check, 1000); else reject()
      })
    }
    check()
  })
}

// ── Start bundled Next.js server (production) ─────────────────
function startNextServer() {
  const { fork } = require('child_process')
  const serverPath = path.join(process.resourcesPath, 'server', 'server.js')

  nextServer = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(PROD_PORT),
      NODE_ENV: 'production',
      NEXTJS_STANDALONE: '1',
    },
    silent: true,
  })

  nextServer.stdout?.on('data', d => console.log('[next]', d.toString()))
  nextServer.stderr?.on('data', d => console.error('[next]', d.toString()))
}

// ── Create main window ────────────────────────────────────────
async function createWindow() {
  const port = isDev ? DEV_PORT : PROD_PORT

  mainWindow = new BrowserWindow({
    width: 1280, height: 820,
    minWidth: 900, minHeight: 600,
    title: APP_NAME + ' — Chit Fund Manager',
    icon: path.join(__dirname, 'build', process.platform === 'darwin' ? 'icon.icns' : 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#0d0f14',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  })

  // Loading screen while Next.js boots
  if (!isDev) {
    mainWindow.loadFile(path.join(__dirname, 'loading.html'))
    mainWindow.show()
    try {
      await waitForServer(port)
    } catch {
      dialog.showErrorBox('Startup Error', 'Failed to start the app server. Please restart.')
      app.quit(); return
    }
  }

  mainWindow.loadURL(`http://localhost:${port}`)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // External links → browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' }
  })

  // DevTools - usually only needed manually
  // if (isDev) mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── App menu ──────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { label: 'About ' + APP_NAME, role: 'about' },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
        { type: 'separator' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Open in Browser', click: () => {
          const port = isDev ? DEV_PORT : PROD_PORT
          shell.openExternal(`http://localhost:${port}`)
        }},
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Lifecycle ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (!isDev) startNextServer()
  buildMenu()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  nextServer?.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => nextServer?.kill())

// Single instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
