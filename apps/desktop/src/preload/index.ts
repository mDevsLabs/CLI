import { contextBridge, ipcRenderer } from 'electron'

export interface MaiApi {
  createPty: (id: string, cols: number, rows: number, cwd?: string) => Promise<{ ok: boolean; error?: string }>
  writePty: (id: string, data: string) => Promise<void>
  resizePty: (id: string, cols: number, rows: number) => Promise<void>
  killPty: (id: string) => Promise<void>
  onPtyData: (cb: (id: string, data: string) => void) => () => void
  onPtyExit: (cb: (id: string, exitCode: number, signal?: number) => void) => () => void
  getPath: (name: 'home' | 'userData' | 'temp') => Promise<string>
  getVersion: () => Promise<string>
}

const maiApi: MaiApi = {
  createPty: (id, cols, rows, cwd) => ipcRenderer.invoke('pty:create', id, cols, rows, cwd),
  writePty: (id, data) => ipcRenderer.invoke('pty:write', id, data),
  resizePty: (id, cols, rows) => ipcRenderer.invoke('pty:resize', id, cols, rows),
  killPty: id => ipcRenderer.invoke('pty:kill', id),
  onPtyData: cb => {
    const handler = (_: unknown, id: string, data: string) => cb(id, data)
    ipcRenderer.on('pty:data', handler as any)
    return () => ipcRenderer.removeListener('pty:data', handler as any)
  },
  onPtyExit: cb => {
    const handler = (_: unknown, id: string, code: number, signal?: number) => cb(id, code, signal)
    ipcRenderer.on('pty:exit', handler as any)
    return () => ipcRenderer.removeListener('pty:exit', handler as any)
  },
  getPath: name => ipcRenderer.invoke('app:getPath', name),
  getVersion: () => ipcRenderer.invoke('app:getVersion')
}

contextBridge.exposeInMainWorld('mai', maiApi)

// Types globaux pour le renderer
declare global {
  interface Window {
    mai: MaiApi
  }
}
