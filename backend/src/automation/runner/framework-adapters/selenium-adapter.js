export async function buildSeleniumCommand(input) {
  if (input.command) {
    return {
      command: input.command,
      args: [],
      displayCommand: input.command,
      custom: true,
    }
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['test'],
    displayCommand: 'npm test',
  }
}

export async function collectSeleniumArtifacts() {
  return {
    screenshots: [],
    videos: [],
    traces: [],
    reports: [],
  }
}

