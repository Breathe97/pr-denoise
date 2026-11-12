import { DenoiseWorklet } from './DenoiseWorklet'

/**
 * 降噪插件（GTCRN 引擎）
 *
 * 使用方式：
 * ```ts
 * import { prDenoise } from 'pr-denoise'
 * prAudio.use({ denoise: prDenoise })
 * ```
 */
export const prDenoise = {
  DenoiseWorklet,
  // 供 PrAudioStream.use() 做采样率校验，未提供时库会默认视为支持
  isSupported: DenoiseWorklet.isSupported
}
