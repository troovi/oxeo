import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '../../../lib'
import { dataScheme, AppScheme } from '@oxeo/devkit'
import { DataSource } from '@oxeo/server'
import {
  CreateBankCardDto,
  CreateBankDetailDto,
  CreateDictionaryDto,
  CreateOptionDto,
  CreateRoleDto,
  CreateScanDto,
  CreateWorkerDto,
  UpdateOptionDto
} from './app.dto'
import { MongoCollectionDriver } from '../../../lib/drivers/collection.driver'
import { SystemService } from '../system/system.service'

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource(dataScheme)
    private readonly dataSource: DataSource<AppScheme, MongoCollectionDriver<AppScheme>>,
    private readonly systemService: SystemService
  ) {}

  async addWorker({ worker }: CreateWorkerDto) {
    return this.dataSource.collections.worker.create(worker)
  }

  async addScan({ scan }: CreateScanDto) {
    return this.dataSource.collections.scan.create(scan)
  }

  async addBankCard({ bankCard }: CreateBankCardDto) {
    return this.dataSource.collections.bankCard.create(bankCard)
  }

  async addBankDetail({ bankDetail }: CreateBankDetailDto) {
    return this.dataSource.collections.bankDetail.create(bankDetail)
  }

  async addRole({ role }: CreateRoleDto) {
    return this.dataSource.collections.role.create(role)
  }

  async addDictionary({ dictionary }: CreateDictionaryDto) {
    return this.dataSource.collections.dictionaries.create(dictionary)
  }

  async addOption({ option }: CreateOptionDto) {
    return this.dataSource.collections.options.create(option)
  }

  async updateOption({ option }: UpdateOptionDto) {
    return this.dataSource.collections.options.update(option.value, (target) => {
      target.dictionary = option.dictionary
      target.title = option.title
    })
  }

  async getState() {
    const settings = await this.systemService.getSettings()

    return {
      settings,
      worker: await this.dataSource.collections.worker.getAll(),
      scan: await this.dataSource.collections.scan.getAll(),
      bankCard: await this.dataSource.collections.bankCard.getAll(),
      bankDetail: await this.dataSource.collections.bankDetail.getAll(),
      // role
      role: await this.dataSource.collections.role.getAll(),
      // options
      dictionaries: await this.dataSource.collections.dictionaries.getAll(),
      options: await this.dataSource.collections.options.getAll()
    }
  }

  async getTables() {
    return this.dataSource.driver.tables.getTables()
  }
}
