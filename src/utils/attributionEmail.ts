const MODEL_EMAIL_MAP: Array<{ keywords: string[]; email: string }> = [
  { keywords: ['claude'], email: 'noreply@anthropic.com' },
  // 由于找不到他们的邮箱和头像, 所以改为了使用我们的邮箱先记录, 后续官方有 github 能用的邮箱可以替换
  // github 组织是不能用 co author 的
  {
    keywords: ['gpt', 'dall-e', 'o1-', 'o3-', 'o4-'],
    email: 'openai@mai.win',
  },
  { keywords: ['gemini'], email: 'google-gemini@mai.win' },
  { keywords: ['grok'], email: 'xai-org@mai.win' },
  { keywords: ['glm'], email: 'zai-org@mai.win' },
  { keywords: ['deepseek'], email: 'deepseek-ai@mai.win' },
  { keywords: ['qwen'], email: 'QwenLM@mai.win' },
  { keywords: ['minimax'], email: 'MiniMax-AI@mai.win' },
  { keywords: ['mimo'], email: 'XiaomiMiMo@mai.win' },
  { keywords: ['kimi'], email: 'MoonshotAI@mai.win' },
]

export function getAttributionEmail(modelName: string): string {
  const lower = modelName.toLowerCase()
  for (const { keywords, email } of MODEL_EMAIL_MAP) {
    if (keywords.some(kw => lower.includes(kw))) {
      return email
    }
  }
  return 'noreply@anthropic.com'
}
