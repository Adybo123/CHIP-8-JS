const font = [
  0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
  0x20, 0x60, 0x20, 0x20, 0x70, // 1
  0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
  0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
  0x90, 0x90, 0xF0, 0x10, 0x10, // 4
  0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
  0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
  0xF0, 0x10, 0x20, 0x40, 0x40, // 7
  0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
  0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
  0xF0, 0x90, 0xF0, 0x90, 0x90, // A
  0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
  0xF0, 0x80, 0x80, 0x80, 0xF0, // C
  0xE0, 0x90, 0x90, 0x90, 0xE0, // D
  0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
  0xF0, 0x80, 0xF0, 0x80, 0x80 //  F
]

function numToInstruction (n) {
  return `0x${n.toString(16).toUpperCase()}`
}

function add8bit (a, b) {
  let c = a + b
  while (c > 255) c -= 255
  return c
}

function sub8bit (a, b) {
  let c = a - b
  while (c < 0) c += 255
  return c
}

class Chip8Core {
  constructor (drawFunction, p) {
    this.drawFunction = drawFunction
    if (p) this.loadProgram(p)
  }

  initialise () {
    this.memory = {}
    this.stack = []
    this.vR = []
    this.gfx = []
    this.iR = 0
    this.stackPointer = -1
    this.pC = 0x200
    this.delayTimer = 60
    this.soundTimer = 60
    this.skipFlag = false

    for (let i = 0; i < 16; i++) {
      this.vR.push(0)
    }

    // Copy font into memory
    for (let i = 0; i < font.length; i++) {
      this.memory[i] = font[i]
    }

    this.initialiseGraphics()
  }

  start () {
    setInterval(() => {
      // TODO: Keys
      this.doCycle()
    }, 16)
  }

  initialiseGraphics () {
    // Fill screen with 0s
    for (let y = 0; y < 32; y++) {
      let row = []
      for (let x = 0; x < 64; x++) {
        row.push(0)
      }
      this.gfx.push(row)
    }
    this.drawFunction(this.gfx)
  }

  loadProgram (p) {
    this.initialise()
    // Load programs from 0x200 onwards
    for (let i = 0; i < p.length; i++) {
      this.memory[0x200 + i] = Number(p[i])
    }
  }

  getAlong (num, along) {
    num = num || 0
    num = num >> (3 - along)
    num = num & 1
    return num
  }

  drawSprite (x, y, n) {
    /* THIS DRAW FUNCTION IS BROKEN! FIX IT!!! */
    console.log(`Draw op 8x${n} at [${x}, ${y}]`)
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < 8; c++) {
        let newVal = this.getAlong(this.memory[this.iR + r], c)
        let oldVal = this.gfx[y + r][x + c]

        // console.log(`Draw op for [${x + c}, ${y + r}], from ${oldVal} to ${newVal} PRE-XOR`)

        if (oldVal && newVal) {
          // Collision
          this.vR[0xF] = 1
          newVal = 0
        }

        this.gfx[y + r][x + c] = newVal
      }
    }
    this.drawFunction(this.gfx)
  }

  doCycle () {
    if (this.skipFlag) {
      this.pC++
      this.skipFlag = false
    }

    this.delayTimer--
    this.soundTimer--
    if (this.delayTimer === 0) this.delayTimer = 60
    if (this.soundTimer === 0) {
      this.soundTimer = 60
      console.log('Chip 8 says BEEP!')
    }

    if (this.pC < 0x200) {
      console.log(`WARNING - Jumped below program memory (pointer: ${this.pC}).
  This *might* indicate a bug - or just an interesting program.`)
    }

    if (!Object.keys(this.memory).includes(String(this.pC))) {
      // The program counter is outside the memory,
      // there is no instruction here
      return
    }

    let instruction = (this.memory[this.pC] << 8) | this.memory[this.pC + 1]
    let opcode = instruction >> 12

    console.log(`DEBUG - ${numToInstruction(instruction)} at ${this.pC}`)

    switch (opcode) {
      case 0:
        switch (instruction) {
          case 0x00E0:
            this.initialiseGraphics()
            break
          case 0x00EE:
            if (this.stackPointer === -1) {
              console.log(`ERROR - Return without enclosing subroutine!`)
            }
            this.pC = this.stack[this.stackPointer] - 2
            this.stackPointer--
            break
          default:
            console.log('WARNING - The 0x0NNN instruction is not supported')
        }
        break
      case 1:
        this.pC = (instruction & 0x0FFF) - 2
        break
      case 2:
        this.stack.push(this.pC)
        this.stackPointer++
        this.pC = (instruction & 0x0FFF) - 2
        break
      case 3:
        if (
          this.vR[(instruction & 0x0F00) >> 8] ===
          instruction & 0x00FF
        ) this.skipFlag = true
        break
      case 4:
        if (
          this.vR[(instruction & 0x0F00) >> 8] !==
          instruction & 0x00FF
        ) this.skipFlag = true
        break
      case 5:
        if (
          this.vR[(instruction & 0x0F00) >> 8] ===
          this.vR[(instruction & 0x00F0) >> 4]
        ) this.skipFlag = true
        break
      case 6:
        this.vR[(instruction & 0x0F00) >> 8] = instruction & 0x00FF
        break
      case 7:
        let v = (instruction & 0x0F00) >> 8
        this.vR[v] = add8bit(this.vR[v], instruction & 0x00FF)
        break
      case 8:
        let n = instruction & 0x000F

        let x = (instruction & 0x0F00) >> 8
        let y = (instruction & 0x00F0) >> 4
        let vX = this.vR[x]
        let vY = this.vR[y]

        switch (n) {
          case 0:
            this.vR[x] = vY
            break
          case 1:
            this.vR[x] = vX | vY
            break
          case 2:
            this.vR[x] = vX & vY
            break
          case 3:
            this.vR[x] = vX ^ vY
            break
          case 4:
            this.vR[x] = add8bit(vX, vY)
            // Carry flag
            this.vR[0xF] = (vX + vY > 255) ? 1 : 0
            break
          case 5:
            this.vR[x] = sub8bit(vX, vY)
            // Carry flag
            this.vR[0xF] = (vX - vY < 0) ? 0 : 1
            break
          case 6:
            this.vR[0xF] = vX & 0x1
            this.vR[x] >>= 1
            break
          case 7:
            this.vR[x] = sub8bit(vY, vX)
            // Carry flag
            this.vR[0xF] = (vY - vX < 0) ? 1 : 0
            break
          case 0xE:
            this.vR[0xF] = vX & 0x8
            this.vR[x] <<= 1
            break
        }
        break
      case 9:
        let x2 = (instruction & 0x0F00) >> 8
        let y2 = (instruction & 0x00F0) >> 4
        if (this.vR[x2] !== this.vR[y2]) this.skipFlag = true
        break
      case 0xA:
        this.iR = instruction & 0x0FFF
        break
      case 0xB:
        this.pC = -2 + (instruction & 0x0FFF) + this.vR[0]
        break
      case 0xC:
        let x3 = (instruction & 0x0F00) >> 8
        let nn = instruction & 0x00FF
        this.vR[x3] = Math.random() * 244 + 1 & nn
        break
      case 0xD:
        let dX = (instruction & 0x0F00) >> 8
        let dY = (instruction & 0x00F0) >> 4
        let dN = instruction & 0x000F
        // Draw sprite at dX, dY, 8xdN
        this.drawSprite(this.vR[dX], this.vR[dY], dN)
        break
      case 0xF:
        let end = instruction & 0x00FF
        let x4 = (instruction & 0x0F00) >> 8

        switch (end) {
          case 0x07:
            this.vR[x4] = this.delayTimer
            break
          case 0x15:
            this.delayTimer = this.vR[x4]
            break
          case 0x18:
            this.soundTimer = this.vR[x4]
            break
          case 0x1E:
            this.iR += this.vR[x4]
            while (this.iR > 65535) this.iR -= 65535
            break
          case 0x29:
            this.iR = this.vR[x4] * 5
            break
          case 0x55:
            let x5 = (instruction & 0x0F00) >> 8
            for (let i = 0; i <= x5; i++) {
              this.memory[this.iR + i] = this.vR[i]
            }
            break
          case 0x65:
            let iN = (instruction & 0x0F00) >> 8
            for (let i = 0; i <= iN; i++) {
              this.vR[i] = this.memory[this.iR + i]
            }
            break
        }
        break
      default:
        console.log(`WARNING - ${numToInstruction(opcode)} is not a supported opcode.`)
        break
    }

    this.pC += 2
  }
}

window.Chip8Core = Chip8Core
