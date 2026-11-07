import { Type } from '@nestjs/common'
import { VersionModule as V0132Module } from '../versions/v-0.1.32/server/version.module'
import { VersionModule as V041Module } from '../versions/v-0.4.1/server/version.module'
import { VersionModule as VNextModule } from '../versions/v-next/server/version.module'

export interface ServerVersion {
  /** Ключ версии — префикс маршрутов и папка `versions/<key>`. */
  key: string
  module: Type<unknown>
}

/** Реестр серверных модулей версий; клиентские — `app/versions.ts`. */
export const versions: ServerVersion[] = [
  { key: 'v-0.1.32', module: V0132Module },
  { key: 'v-0.4.1', module: V041Module },
  { key: 'v-next', module: VNextModule }
]
