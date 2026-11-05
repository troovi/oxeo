import { z } from 'zod'
import { Collections } from '../../../lib/scheme'
import { AppKey, AppKeys } from '../../keys'
import { AppScheme, DictionaryEntities } from '../../scheme'
import { DomainContext, invariant, notFound } from '../context'
import { DictionaryParams } from './dictionary.params'

interface OptionsCheck {
  dictionary: AppKey.Dictionary
  values: string[]
}

/** Названия словарей перечня — как их видит экран. */
const DICTIONARY_NAMES: Record<AppKey.Dictionary, string> = {
  regions: 'Регионы',
  citizenships: 'Гражданство'
}

/**
 * Справочники, как в CRM: перечень словарей фиксирован, значения заводятся операциями. В отличие от CRM
 * значение удаляется, а не архивируется: схема сама снимает его с записей — из набора ссылка уходит,
 * одиночная ссылка становится `null`. Названия значений словаря уникальны без учёта регистра.
 */
export class DictionaryDomain {
  constructor(private collections: Collections<AppScheme>) {}

  // ------------------------------------------- operations --------------------------------------------

  /** Посев: идемпотентно заводит словари перечня `AppKeys.Dictionary`. Только система. */
  async ensureDictionaries(
    _params: z.infer<typeof DictionaryParams.EnsureDictionaries>,
    ctx: DomainContext
  ) {
    if (ctx.actor !== null) {
      throw invariant('Справочники заводит система')
    }

    for (const dictionary of AppKeys.Dictionary) {
      const isExisting = await this.collections.dictionary.exists(dictionary)

      if (!isExisting) {
        await this.collections.dictionary.create({
          dictionary,
          name: DICTIONARY_NAMES[dictionary],
          options: []
        })
      }
    }
  }

  /** Новое значение словаря; название уникально в словаре. Возвращает сгенерированный `value`. */
  async addOption(params: z.infer<typeof DictionaryParams.AddOption>, ctx: DomainContext) {
    const options = await this.collections.option.findBy({ dictionary: params.dictionary })

    if (DictionaryDomain.hasTitle(options, params.title)) {
      throw invariant(`Значение «${params.title}» уже есть в справочнике`)
    }

    const value = ctx.ids.string('option')

    await this.collections.option.create({
      value,
      dictionary: params.dictionary,
      title: params.title
    })

    return value
  }

  /** Новое название значения; уникально в его словаре. */
  async renameOption({ value, title }: z.infer<typeof DictionaryParams.RenameOption>) {
    const option = await this.getOption(value)
    const options = await this.collections.option.findBy({ dictionary: option.dictionary })
    const others = options.filter((item) => item.value !== value)

    if (DictionaryDomain.hasTitle(others, title)) {
      throw invariant(`Значение «${title}» уже есть в справочнике`)
    }

    await this.collections.option.update(value, (draft) => {
      draft.title = title
    })
  }

  /** Удаление значения: схема снимает его с записей, которые на него ссылаются. */
  async removeOption({ value }: z.infer<typeof DictionaryParams.RemoveOption>) {
    await this.getOption(value)
    await this.collections.option.remove(value)
  }

  // --------------------------------------------- helpers ---------------------------------------------

  /** Значения `values` принадлежат словарю `dictionary`, иначе отказ — для доменов, которые ссылаются на них. */
  static async expectOptions(collections: Collections<AppScheme>, check: OptionsCheck) {
    const { dictionary, values } = check

    for (const value of values) {
      const option = await collections.option.get(value)

      if (!option || option.dictionary !== dictionary) {
        throw invariant(`Значение ${value} не из справочника ${dictionary}`)
      }
    }
  }

  // --------------------------------------------- private ---------------------------------------------

  private async getOption(value: string) {
    const option = await this.collections.option.get(value)

    if (!option) {
      throw notFound(`значение справочника ${value}`)
    }

    return option
  }

  /** Название уже есть среди значений — без учёта регистра. */
  private static hasTitle(options: DictionaryEntities.Option[], title: string) {
    return options.some((option) => option.title.toLowerCase() === title.toLowerCase())
  }
}
