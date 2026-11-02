import denoiseWorkletProcessorUrl from './gtcrn/gtcrn-worklet-processor.js?url'
import denoiseWasmUrl from './gtcrn/gtcrn.wasm?url'

// processor 注册名，必须与 src/gtcrn/gtcrn-worklet-processor.js 内 registerProcessor 一致
const PROCESSOR_NAME = '@sapphi-red/web-noise-suppressor/gtcrn'

// 默认支持的最大声道数，需要覆盖输入声道数，否则多通道会被丢掉、输出变单声道
const DEFAULT_MAX_CHANNELS = 2

/**
 * GTCRN 降噪引擎
 * 48kHz 下帧长 768（16ms），48kHz / 16kHz 均支持，这里按 48kHz 使用
 * wasm 与 worklet 位于 src/gtcrn，构建时内联进产物，不依赖 CDN 或 npm 包运行时
 */
export class DenoiseWorklet {
  // 音频上下文实例
  audioContext: AudioContext

  // 降噪节点
  denoiseWorkletNode?: AudioWorkletNode

  // wasm 二进制缓存，避免重复下载
  denoiseWasmBinary?: ArrayBuffer

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  /**
   * 创建降噪节点（PrAudioStream 通过 use() 注入后调用）
   */
  createDenoiseWorkletNode = async () => {
    this.destroy()

    await this.audioContext.audioWorklet.addModule(denoiseWorkletProcessorUrl)

    if (!this.denoiseWasmBinary) {
      const response = await fetch(denoiseWasmUrl)
      this.denoiseWasmBinary = await response.arrayBuffer()
    }

    this.denoiseWorkletNode = new AudioWorkletNode(this.audioContext, PROCESSOR_NAME, {
      processorOptions: { maxChannels: DEFAULT_MAX_CHANNELS, wasmBinary: this.denoiseWasmBinary }
    })

    return this.denoiseWorkletNode
  }

  /**
   * 销毁节点并释放 processor 侧资源
   */
  destroy = () => {
    this.denoiseWorkletNode?.disconnect()
    // 与 worklet processor 约定：发字符串 'destroy' 让它自行释放
    this.denoiseWorkletNode?.port.postMessage('destroy')
    this.denoiseWorkletNode = undefined
  }
}
