export interface CommandTip {
  type: 'tip'
  sender: string
  receiver: string
  value: string
}

export interface CommandRegister {
  type: 'register'
  sender: string
  address: string
}

export interface CommandRedeem {
  type: 'redeem',
  sender: string
}

export type Command = CommandTip | CommandRegister | CommandRedeem
