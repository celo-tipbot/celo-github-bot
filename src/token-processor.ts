import { Result, Err, Ok } from '@celo/base/lib/result'

interface ActionConsumeToken {
  type: 'consume'
}

const CONSUME: ActionConsumeToken = { type: 'consume' }

interface ActionRememberToken {
  type: 'remember',
  key: string,
  value: string
}

const REMEMBER = (key: string, value: string): ActionRememberToken => {
  return {
    type: 'remember',
    key,
    value
  }
}

interface ActionError {
  type: 'error',
  error: string
}

const ERROR = (error: string): ActionError => {
  return {
    type: 'error',
    error
  }
}

type Action = ActionConsumeToken | ActionRememberToken | ActionError

export interface Values {
  [key: string]: string
}

type ProcessorResult = Result<Values, Error>

export class TokenProcessor {
  error: null | string
  tokens: string[]
  currentToken: number
  values: { [key: string]: string }

  constructor(tokens: string[]) {
    this.tokens = tokens
    this.error = null
    this.currentToken = 0
    this.values = {}
  }

  static processString(str: string) {
    return this.process(str.split(' '))
  }

  static process(tokens: string[]) {
    return new TokenProcessor(tokens)
  }

  finish(): ProcessorResult {
    if (this.error) {
      return Err(new Error(this.error))
    } else {
      return Ok(this.values)
    }
  }

  step(fn: (token: string) => Action) {
    if (this.error) {
      return this
    } else if (this.currentToken >= this.tokens.length) {
      this.error = 'Critical error in token parser: incomplete command'
    } else {
      const action = fn(this.tokens[this.currentToken])
      switch (action.type) {
      case 'consume':
        this.currentToken++
        break;
      case 'remember':
        this.values[action.key] = action.value
        this.currentToken++
        break;
      case 'error':
        this.error = action.error
        break;
      default:
        this.error = 'Critical error in token parser: unknown action'
      }
    }

    return this
  }

  literal(expected: string) {
    return this.step((token: string) => {
      if (token === expected) {
        return CONSUME
      } else {
        return ERROR(`Expected ${expected} but saw ${token}`)
      }
    })
  }

  identifier(id: string) {
    return this.step((token: string) => {
      return REMEMBER(id, token)
    })
  }

  gitHubUsername(id: string) {
    return this.step((token: string) => {
      if (/^@[a-zA-Z0-9\-]+$/.test(token)) {
        return REMEMBER(id, token.slice(1))
      } else {
        return ERROR(`Expected a GitHub username, got ${token}`)
      }
    })
  }

  number(id: string) {
    return this.step((token: string) => {
      if (/^(\d+)(\.\d+)?$/.test(token)) {
        return REMEMBER(id, token)
      } else {
        return ERROR(`Expected a number, got ${token}`)
      }
    })
  }

  address(id: string) {
    return this.step((token: string) => {
      if (/^0x[0-9a-fA-F]{40}$/.test(token)) {
        return REMEMBER(id, token)
      } else {
        return ERROR(`Expected a Celo address, got ${token}`)
      }
    })
  }
}
