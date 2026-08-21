declare module 'node-pty' {
  export interface IPty {
    pid: number
    cols: number
    rows: number
    write(data: string): void
    resize(cols: number, rows: number): void
    kill(signal?: string): void
    onData(cb: (data: string) => void): { dispose(): void }
    onExit(cb: (e: { exitCode: number; signal?: number }) => void): { dispose(): void }
  }
  export function spawn(
    file: string,
    args: string[],
    options: { name?: string; cols?: number; rows?: number; cwd?: string; env?: Record<string, string> }
  ): IPty
  export function fork(
    file: string,
    args: string[],
    options: { name?: string; cols?: number; rows?: number; cwd?: string; env?: Record<string, string> }
  ): IPty
}
