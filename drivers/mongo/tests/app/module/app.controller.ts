import { Body, Controller, Get, Post } from '@nestjs/common'
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
import { AppService } from './app.service'

@Controller('app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('addWorker')
  async addWorker(@Body() dto: CreateWorkerDto) {
    return this.appService.addWorker(dto)
  }

  @Post('addScan')
  async addScan(@Body() dto: CreateScanDto) {
    return this.appService.addScan(dto)
  }

  @Post('addBankCard')
  async addBankCard(@Body() dto: CreateBankCardDto) {
    return this.appService.addBankCard(dto)
  }

  @Post('addBankDetail')
  async addBankDetail(@Body() dto: CreateBankDetailDto) {
    return this.appService.addBankDetail(dto)
  }

  @Post('addRole')
  async addRole(@Body() dto: CreateRoleDto) {
    return this.appService.addRole(dto)
  }

  @Post('addDictionary')
  async addDictionary(@Body() dto: CreateDictionaryDto) {
    return this.appService.addDictionary(dto)
  }

  @Post('addOption')
  async addOption(@Body() dto: CreateOptionDto) {
    return this.appService.addOption(dto)
  }

  @Post('updateOption')
  async updateOption(@Body() dto: UpdateOptionDto) {
    return this.appService.updateOption(dto)
  }

  @Get()
  async getState() {
    return this.appService.getState()
  }

  @Get('tables')
  async getTables() {
    return this.appService.getTables()
  }
}
