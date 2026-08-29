import type { LocalCommandResult } from '../../types/command.js'
import { openBrowser } from '../../utils/browser.js'

const SUPPORT_URL = 'https://mai-docs.vercel.app/support'

export async function call(): Promise<LocalCommandResult> {
  try {
    await openBrowser(SUPPORT_URL)
    return {
      type: 'text',
      value: `Opened the mAI CLI support page: ${SUPPORT_URL}`,
    }
  } catch {
    return {
      type: 'text',
      value: `Unable to open the browser. Please visit ${SUPPORT_URL}`,
    }
  }
}
