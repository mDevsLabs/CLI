import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window.js'
import { createPty, writePty, resizePty, killPty, killAllPtys } from './pty.js'

let mainWindow: BrowserWindow | null = null

// Single instance lock
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

function registerIpc() {
  ipcMain.handle('pty:create', (event, id: string, cols: number, rows: number, cwd?: string) => {
    try {
      const inst = createPty(id, cols, rows, cwd)
      const wc = event.sender
      inst.pty.onData((data: string) => {
        if (!wc.isDestroyed()) wc.send('pty:data', id, data)
      })
      inst.pty.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        if (!wc.isDestroyed()) wc.send('pty:exit', id, exitCode, signal)
      })
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      dialog.showErrorBox('mAI — erreur de lancement', `Impossible de lancer mAI:\n${msg}\n\nVérifiez que mAI est installé (npm i -g @mdevs/mai-cli) ou que le bundle CLI est présent.`)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('pty:write', (_e, id: string, data: string) => {
    writePty(id, data)
  })

  ipcMain.handle('pty:resize', (_e, id: string, cols: number, rows: number) => {
    resizePty(id, cols, rows)
  })

  ipcMain.handle('pty:kill', (_e, id: string) => {
    killPty(id)
  })

  ipcMain.handle('app:getPath', (_e, name: 'home' | 'userData' | 'temp') => {
    return app.getPath(name)
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mdevslabs.mai-desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()

  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    } else {
      mainWindow?.focus()
    }
  })
})

app.on('window-all-closed', () => {
  killAllPtys()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  killAllPtys()
})

// Sécurité: désactive navigation
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (e, url) => {
    const allowed = url.startsWith('http://localhost:') || url.startsWith('file://')
    if (!allowed) e.preventDefault()
  })
})
