import { Injectable } from '@nestjs/common'
import { InjectDataSource, MongoCollectionDriver } from '../../../lib'
import { SystemDataScheme, SystemScheme } from '../server.scheme'
import { DataSource } from '@oxeo/server'

@Injectable()
export class SystemService {
  private defined = false
  private source = 'app'

  constructor(
    @InjectDataSource(SystemDataScheme)
    private readonly systemDataSource: DataSource<SystemScheme, MongoCollectionDriver<SystemScheme>>
  ) {}

  async getSettings() {
    if (!this.defined) {
      if (!(await this.systemDataSource.collections.settings.get(this.source))) {
        await this.systemDataSource.collections.settings.create({ id: this.source, lastNofitReadId: 0 })
      }

      this.defined = true
    }

    const source = await this.systemDataSource.collections.settings.get(this.source)

    return source!
  }
}
