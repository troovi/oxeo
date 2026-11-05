import { createForm } from '@companix/formkit'
import { OptionsSource, Select } from '@companix/uikit'
import { ErrorsMessages } from '../layouts/ErrorsMessages'

type Params<T> = OptionsSource<T> & {
  placeholder?: string
}

export const SelectForm = <T,>() => {
  return createForm<T | null, Params<T>>({
    defaultValue: null,
    getRequireCheck: () => (value) => {
      if (value === null) {
        throw ''
      }
    },
    getForm: (params) => {
      return ({ field: { ref, onChange, value }, error, disabled }) => {
        return (
          <div className="form-field">
            <Select<T>
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
