import { createForm } from '@companix/formkit'
import { NumberInput } from '@companix/uikit'
import { ErrorsMessages } from '../layouts/ErrorsMessages'

interface Params {
  placeholder?: string
}

export const NumberInputForm = createForm<number | null, Params>({
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
          <NumberInput
            {...params}
            value={value}
            onValueChange={onChange}
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
