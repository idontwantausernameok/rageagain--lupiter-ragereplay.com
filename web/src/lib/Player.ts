import EventEmitter from "./EventEmitter"

export type PlayerEvents = {
  playing: { event: YT.OnStateChangeEvent },
  ready: { event: YT.PlayerEvent },
  error: { event: YT.OnErrorEvent },
  ended: { event: YT.OnStateChangeEvent },
  paused: { event: YT.OnStateChangeEvent },
  buffering: { event: YT.OnStateChangeEvent },
  cued: { event: YT.OnStateChangeEvent }
}

type PlayerEventNames = keyof PlayerEvents

export type PlayerQuality = 'hd720' | 'default' | 'small' | 'medium' | 'large' | 'hd1080' | 'highres'

const getIdFromYoutubeUrl = (url: string) => {
  const re = /^(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)([_0-9a-z-]+)/i
  return url.match(re)?.[7]
}

export default class Player {
  private playheadInterval: number = 0
  private endSeconds: number | null = null
  private playerReady: boolean = false
  private ytPlayer: YT.Player | null = null

  private emitter: EventEmitter<PlayerEvents>
  on: <K extends PlayerEventNames>(event: K, listener: (event: PlayerEvents[K]) => void) => { dispose: () => void }
  off: <K extends PlayerEventNames>(event: K, listener: (event: PlayerEvents[K]) => void) => void

  constructor() {
    this.emitter = new EventEmitter<PlayerEvents>()
    this.on = this.emitter.on
    this.off = this.emitter.off
  }

  ///////////////////////////////
  //           EVENTS
  ///////////////////////////////
  onPlayerError = (event: YT.OnErrorEvent) => {
    this.emitter.emit('error', {event})
  }

  onPlayerReady = (event: YT.PlayerEvent) => {
    console.log('Player is ready')

    this.playerReady = true
    this.ytPlayer = event.target
    this.emitter.emit('ready', {event})
  }

  onPlayerStateChange = (event: YT.OnStateChangeEvent) => {
    switch (event.data) {
      case YT.PlayerState.PLAYING:
        console.log("Player state change: playing");
        this.startPlayhead()
        this.emitter.emit('playing', {event})
        break;
      case YT.PlayerState.ENDED:
        console.log("Player state change: ended");
        this.stopPlayhead()
        this.emitter.emit('ended', {event})
        break;
      case YT.PlayerState.PAUSED:
        console.log("Player state change: paused");
        this.stopPlayhead()
        this.emitter.emit('paused', {event})
        break;
      case YT.PlayerState.BUFFERING:
        console.log("Player state change: buffering");
        this.stopPlayhead()
        this.emitter.emit('buffering', {event})
        break;
      case YT.PlayerState.CUED:
        console.log("Player state change: cued");
        this.emitter.emit('cued', {event})
        break;
      case YT.PlayerState.UNSTARTED:
        console.log("Player state change: unstarted");

      default:
        break;
    }
  }

  ///////////////////////////////
  //          PLAYHEAD
  ///////////////////////////////
  startPlayhead() {
    this.playheadInterval = setInterval(this.updatePlayhead, 100)
  }

  stopPlayhead() {
    clearInterval(this.playheadInterval)
  }

  updatePlayhead() {
    if (typeof (this.ytPlayer?.getCurrentTime()) == 'undefined') {
      clearInterval(this.playheadInterval)
      return
    }

    const playerCurrentTime = this.ytPlayer.getCurrentTime()

    if (this.endSeconds !== null && playerCurrentTime >= this.endSeconds) {
      this.endSeconds = null
      this.stop()
    }
  }

  seekToPercent(percent: number) {
    const time = percent * (this.ytPlayer?.getDuration() ?? 0)
    this.ytPlayer?.seekTo(time, true)
  }

  ///////////////////////////////
  //       CORE FUNCTIONS
  ///////////////////////////////
  isReady() {
    return this.playerReady
  }

  play(reset: boolean = false) {
    if (!this.isReady()) {
      this.on("ready", () => {
        this.play(reset)
      })
      return
    }

    if (reset)
      this.ytPlayer?.seekTo(0, true)

    this.ytPlayer?.playVideo()
  }

  stop() {
    if (!this.isReady()) {
      this.on("ready", function () {
        stop()
      })
      return
    }

    this.ytPlayer?.stopVideo()
  }

  pause() {
    if (!this.isReady()) {
      this.on("ready", () => {
        this.pause()
      })
      return
    }

    this.ytPlayer?.pauseVideo()
  }

  unPause() {
    if (!this.isReady()) {
      this.on("ready", () => {
        this.unPause()
      })
      return
    }

    this.ytPlayer?.playVideo()
  }

  togglePause() {
    if (!this.isReady())
      return

    if (this.isPaused())
      this.ytPlayer?.playVideo()
    else
      this.ytPlayer?.pauseVideo()
  }

  isPaused() {
    if (!this.isReady())
      return false

    return (this.getState() == YT.PlayerState.PAUSED)
  }

  isPlaying() {
    if (!this.isReady())
      return false

    return (this.getState() == YT.PlayerState.PLAYING)
  }

  getState(): YT.PlayerState {
    return this.ytPlayer?.getPlayerState() ?? YT.PlayerState.UNSTARTED
  }

  cueVideoById(videoId: string, startSeconds?: number, suggestedQuality?: PlayerQuality) {
    if (!this.isReady()) {
      this.on("ready", () => {
        this.cueVideoById(videoId, startSeconds, suggestedQuality)
      })
      return
    }

    this.ytPlayer?.cueVideoById(videoId, startSeconds, suggestedQuality)
  }

  cueVideoByUrl(videoUrl: string, startSeconds?: number, suggestedQuality?: PlayerQuality) {
    const id = getIdFromYoutubeUrl(videoUrl)

    if (!id)
      throw new Error('Failed to extract ID for videoUrl ' + videoUrl)

    this.cueVideoById(id, startSeconds, suggestedQuality)
  }

  loadVideoById(videoId: string, startSeconds?: number, suggestedQuality?: PlayerQuality) {
    console.log('loadVideoById', videoId, startSeconds, suggestedQuality)

    if (!this.isReady()) {
      console.log('Player is not ready')
      this.on("ready", () => {
        console.log('After ready triggered', videoId)
        this.loadVideoById(videoId, startSeconds, suggestedQuality)
      })
      return
    }

    this.ytPlayer?.loadVideoById(videoId, startSeconds, suggestedQuality)
  }

  loadVideoByUrl(videoUrl: string, startSeconds?: number, suggestedQuality?: PlayerQuality) {
    const id = getIdFromYoutubeUrl(videoUrl)

    if (!id)
      throw new Error('Failed to extract ID for videoUrl ' + videoUrl)

    this.loadVideoById(id, startSeconds, suggestedQuality)
  }

  getCurrentTime() {
    return this.ytPlayer?.getCurrentTime() ?? 0
  }

  getDuration() {
    return this.ytPlayer?.getDuration() ?? 0
  }

  seekTo(seconds: number, allowSeekAhead: boolean) {
    this.ytPlayer?.seekTo(seconds, allowSeekAhead)
  }

  clearVideo() {
    this.ytPlayer?.stopVideo()
  }

  mute() {
    if (!this.isReady()) {
      this.on("ready", () => {
        this.mute()
      })
      return
    }

    this.ytPlayer?.mute()
  }

  unMute() {
    if (!this.isReady()) {
      this.on("ready", () => {
        this.unMute()
      })
      return
    }

    this.ytPlayer?.unMute()
  }

  isMuted() {
    return this.ytPlayer?.isMuted() ?? false
  }

  toggleMute() {
    if (this.isMuted())
      this.unMute()
    else
      this.mute()
  }

  setVolume(volume: number) {
    if (!this.isReady()) {
      this.on("ready", () => {
        this.setVolume(volume)
      })
      return
    }

    this.ytPlayer?.setVolume(volume)
  }

  getVolume() {
    return this.ytPlayer?.getVolume() ?? 100
  }
}