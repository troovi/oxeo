import { z } from 'zod'
import { Collections, Ids, Params, System, notFound } from '../../../lib/scheme'
import { Domain } from '../../../lib/di'
import { AppKey, AppKeys } from '../../keys'
import { DictionaryEntities } from '../../scheme'
import { invariant } from '../context'
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
@Domain()
export class DictionaryDomain {
  constructor(
    private collections: Collections,
    private ids: Ids
  ) {}

  // ------------------------------------------- operations --------------------------------------------

  /** Посев: идемпотентно заводит словари перечня `AppKeys.Dictionary`. Только система. */
  @System('Справочники заводит система')
  @Params(DictionaryParams.EnsureDictionaries)
  async ensureDictionaries(_params: z.infer<typeof DictionaryParams.EnsureDictionaries>) {
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
  @Params(DictionaryParams.AddOption)
  async addOption(params: z.infer<typeof DictionaryParams.AddOption>) {
    const options = await this.collections.option.findBy({ dictionary: params.dictionary })

    if (DictionaryDomain.hasTitle(options, params.title)) {
      throw invariant(`Значение «${params.title}» уже есть в справочнике`)
    }

    const value = this.ids.string('option')

    await this.collections.option.create({
      value,
      dictionary: params.dictionary,
      title: params.title
    })

    return value
  }

  /** Новое название значения; уникально в его словаре. */
  @Params(DictionaryParams.RenameOption)
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
  @Params(DictionaryParams.RemoveOption)
  async removeOption({ value }: z.infer<typeof DictionaryParams.RemoveOption>) {
    await this.getOption(value)
    await this.collections.option.remove(value)
  }

  // --------------------------------------------- helpers ---------------------------------------------

  /** Значения `values` принадлежат словарю `dictionary`, иначе отказ — для доменов, которые ссылаются на них. */
  static async expectOptions(collections: Collections, check: OptionsCheck) {
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
