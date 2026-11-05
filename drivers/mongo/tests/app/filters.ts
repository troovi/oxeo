import { AppScheme, dataScheme } from '@oxeo/devkit'
import { CoreError, RelationRestrictInfo } from '@oxeo/server'
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()

    // core conflicts
    if (exception instanceof CoreError) {
      console.log('core exception:', exception)
      response.status(HttpStatus.BAD_REQUEST).json({ message: this.getErrorMessage(exception) })
      return
    }

    // internal server errors
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse())
      return
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(exception?.response)
  }

  private getErrorMessage({ model, data }: CoreError) {
    const collectionsNames: { [name in keyof AppScheme]: string } = {
      worker: 'Сотрудник',
      scan: 'Скан',
      bankCard: 'Карта',
      bankDetail: 'Реквизит',
      // chat
      chat: 'Чат',
      // client
      client: 'Клиент',
      contact: 'Контакт',
      legal: 'Юридический адрес',
      location: 'Объект',
      // project
      project: 'Проект',
      // role
      role: 'Должность',
      // options
      dictionaries: 'Словарь',
      options: 'Опция',
      // shift
      seat: 'Место',
      shift: 'Смена'
    }

    const modelsNames: { [model: string]: string } = {}

    for (const collectionName in collectionsNames) {
      const name = collectionName as keyof AppScheme
      modelsNames[dataScheme.collectionsScheme[name].name] = collectionsNames[name]
    }

    const getModelTitle = (modelName: string) => {
      return modelsNames[modelName] ?? modelName
    }

    if (data.reason === 'EXISTS') {
      return `${getModelTitle(model)} уже существует`
    }

    if (data.reason === 'NOT_EXISTS') {
      return `${getModelTitle(model)} не найден`
    }

    if (data.reason === 'DEPENDENCY_RESTRICT') {
      return `Нельзя удалить ${getModelTitle(model)}: есть связанные сущности "${getModelTitle(
        data.model
      )}"`
    }

    if (data.reason === 'RELATION_RESTRICT') {
      const relationReasons: Record<RelationRestrictInfo, string> = {
        unique: `Поле "${data.address}" должно содержать уникальные значения`,
        owner: `Поле "${data.address}" недоступно для изменения`,
        'owner-fallback': `Нельзя удалить ${getModelTitle(model)}: нарушена обязательная связь "${
          data.address
        }"`,
        'belongs-to': `Поле "${data.address}" недоступно для изменения`,
        'has-many': `Поле "${data.address}" недоступно для изменения`,
        'has-many >0': `Поле "${data.address}" должно быть пустым при создании`,
        'has-many !== 0': `Нельзя удалить ${getModelTitle(model)}: поле "${
          data.address
        }" содержит связанные элементы`,
        'invalid discriminator': `Поле "${data.address}" ссылается на сущность недопустимого типа`,
        'discriminator-immutable': `Поле "${data.address}" нельзя менять через update (используйте changeDiscriminator)`,
        'not-discriminated': `Коллекция не является дискриминированной`,
        'unknown-discriminator': `Недопустимое значение дискриминатора для поля "${data.address}"`,
        'same-discriminator': `Целевой дискриминатор совпадает с текущим`
      }

      return (
        relationReasons[data.info] ??
        `Ограничение связи: поле "${data.address}", причина "${data.info}"`
      )
    }

    return `Ошибка обработки данных для "${getModelTitle(model)}"`
  }
}
