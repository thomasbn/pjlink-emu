const net = require('net')

class PJLinkServer {
  constructor(state, onLog) {
    this._state = state
    this._onLog = onLog
    this._server = null
    this._sockets = new Set()
  }

  start(port) {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => this._handleConnection(socket))
      server.on('error', (err) => reject(err))
      server.listen(port, () => {
        this._server = server
        resolve()
      })
    })
  }

  stop() {
    return new Promise((resolve) => {
      for (const socket of this._sockets) socket.destroy()
      this._sockets.clear()
      if (this._server) {
        this._server.close(() => {
          this._server = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  async restart(port) {
    await this.stop()
    await this.start(port)
  }

  _handleConnection(socket) {
    this._sockets.add(socket)
    socket.on('close', () => this._sockets.delete(socket))
    socket.on('error', () => socket.destroy())
    socket.setEncoding('utf8')

    socket.write('PJLINK 0\r')

    let buf = ''
    socket.on('data', (chunk) => {
      buf += chunk
      const parts = buf.split('\r')
      buf = parts.pop()
      for (const part of parts) {
        const line = part.replace(/\n$/, '').trim()
        if (line) this._handleCommand(line, socket)
      }
    })
  }

  _handleCommand(line, socket) {
    const clientAddr = socket.remoteAddress || 'unknown'
    let response

    if (!line.startsWith('%1')) {
      return
    }

    const body = line.slice(2)
    const spaceIdx = body.indexOf(' ')
    if (spaceIdx === -1) {
      response = '%1ERR2\r'
      this._log(clientAddr, line, response)
      socket.write(response)
      return
    }

    const cmd = body.slice(0, spaceIdx).toUpperCase()
    const param = body.slice(spaceIdx + 1)

    response = this._route(cmd, param)
    this._log(clientAddr, line, response.replace(/\r$/, ''))
    socket.write(response)
  }

  _route(cmd, param) {
    const s = this._state

    switch (cmd) {
      case 'POWR':
        if (param === '?') return `%1POWR=${s.power}\r`
        if (param === '0' || param === '1') {
          const result = s.setPower(parseInt(param, 10), () => {})
          if (result === 'ERR3') return '%1POWR=ERR3\r'
          if (result === 'ERR2') return '%1POWR=ERR2\r'
          return '%1POWR=OK\r'
        }
        return '%1POWR=ERR2\r'

      case 'LAMP':
        if (param === '?') return `%1LAMP=${s.queryLamp()}\r`
        return '%1LAMP=ERR2\r'

      case 'CLSS':
        if (param === '?') return '%1CLSS=1\r'
        return '%1CLSS=ERR2\r'

      case 'NAME':
        if (param === '?') return `%1NAME=${s.projectorName}\r`
        return '%1NAME=ERR2\r'

      case 'ERST':
        if (param === '?') return `%1ERST=${s.queryErrors()}\r`
        return '%1ERST=ERR2\r'

      case 'AVMT':
        if (param === '?') return `%1AVMT=${s.avMute ? '31' : '30'}\r`
        if (param === '30') { s.setAvMute(false, () => {}); return '%1AVMT=OK\r' }
        if (param === '31') { s.setAvMute(true, () => {}); return '%1AVMT=OK\r' }
        return '%1AVMT=ERR2\r'

      case 'INPT':
        if (param === '?') return `%1INPT=${s.input}\r`
        if (param === '11') return '%1INPT=OK\r'
        return '%1INPT=ERR2\r'

      case 'INST':
        if (param === '?') return '%1INST=11\r'
        return '%1INST=ERR2\r'

      case 'INF1':
        if (param === '?') return `%1INF1=${s.manufacturer}\r`
        return '%1INF1=ERR2\r'

      case 'INF2':
        if (param === '?') return `%1INF2=${s.productName}\r`
        return '%1INF2=ERR2\r'

      default:
        return `%1${cmd}=ERR2\r`
    }
  }

  _log(client, raw, response) {
    const ts = new Date().toTimeString().slice(0, 8)
    this._onLog({ ts, client, raw, response })
  }
}

module.exports = PJLinkServer
