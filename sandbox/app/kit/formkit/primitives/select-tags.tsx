import { createForm } from '@companix/formkit'
import { OptionsSource, SelectTags } from '@companix/uikit'
import { ErrorsMessages } from '../layouts/ErrorsMessages'

type Params<T> = OptionsSource<T> & {
  placeholder?: string
}

export const SelectTagsForm = <T extends string | number>() => {
  return createForm<T[], Params<T>>({
    defaultValue: [],
    getRequireCheck: () => (value) => {
      if (value.length === 0) {
        throw 'Выберите минимум один вариант'
      }
    },
    getForm: (params) => {
      return ({ field: { ref, onChange, value }, error, disabled }) => {
        return (
          <div className="form-field">
            <SelectTags<T>
              {...params}
              value={value}
              onChange={onChange}
              inputRef={ref}
              required={error !== null}
              disabled={disabled}
            />
            {error && <ErrorsMessages error={error} />}
          </div>
        )
      }
    }
  })
}
