import { DiscriminatedModel, Discriminator, Identifier, ModelToModel, Prop } from '@oxeo/scheme'
import { FilesTypes } from '@companix/utils-js'
import { ShiftEntities } from './shifts'

export interface Message {
  messageId: string
  fromId: number
  cmid: number
  text: string
  date: number
  attachments: FilesTypes[]
}

export namespace ChatEntities {
  @DiscriminatedModel({ name: 'Chat', discriminatorKey: 'type' })
  export class BaseChat {
    @Identifier({ type: 'string' })
    chatId: string

    @Prop({ type: 'literal', values: ['notechat', 'seatchat'] })
    type: 'notechat' | 'seatchat'

    @Prop({ type: 'number' })
    unreadCount: number

    @Prop({ type: 'number' })
    lastReadCmid: number

    @Prop({ type: 'json', nullable: true })
    lastMessage: Message | null

    @Prop({ type: 'number' })
    lastCmid: number

    @Prop({ type: 'json' })
    messages: Message[]
  }

  @Discriminator('notechat')
  export class NoteChat extends BaseChat {
    // @ts-ignore
    type: 'notechat'

    @ModelToModel.OwnerFallback(() => ShiftEntities.Shift, (shift) => shift.chatId)
    shiftId: ShiftEntities.Shift['shiftId']
  }

  @Discriminator('seatchat')
  export class SeatChat extends BaseChat {
    // @ts-ignore
    type: 'seatchat'

    @ModelToModel.OwnerFallback(() => ShiftEntities.Seat, (seat) => seat.chatId)
    seatId: ShiftEntities.Seat['seatId']
  }
}
