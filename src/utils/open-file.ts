import { exec } from 'child_process';
import * as path from 'path';

export async function openFile(filePath: string): Promise<void> {
  const abs = path.resolve(filePath);
  return new Promise((resolve) => {
    let cmd: string;
    if (process.platform === 'darwin') {
      cmd = `open "${abs}"`;
    } else if (process.platform === 'win32') {
      cmd = `start "" "${abs}"`;
    } else {
      cmd = `xdg-open "${abs}"`;
    }
    exec(cmd, () => resolve());
  });
}
